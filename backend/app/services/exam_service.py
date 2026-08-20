import json
import logging
import re
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AnswerAttempt, Exam, PrepPlan, Question, User
from app.ai_policy import require_ai_result
from app.schemas.exam import (
    AnswerResult,
    ExamGenerateRequest,
    ExamResponse,
    ExamReviewResponse,
    ExamSubmissionRequest,
    ExamSubmissionResponse,
    ExamStoredAttemptResponse,
    QuestionResponse,
    QuestionReviewResponse,
)
from app.schemas.role_intelligence import RoleBlueprint
from app.services.gemini_service import generate_gemini_json
from app.services.role_intelligence_service import blueprint_context

logger = logging.getLogger(__name__)


class AIExamOption(BaseModel):
    label: str
    text: str
    is_correct: bool = False


class AIExamQuestion(BaseModel):
    question_type: str = Field(description="multiple_choice, short_answer, one_word, fill_blank, multiple_select, or coding")
    prompt: str
    topics: list[str]
    expected_answer: str
    options: Optional[list[AIExamOption]] = None


class AIExamOutput(BaseModel):
    questions: list[AIExamQuestion]


class AIAnswerScore(BaseModel):
    score: float = Field(ge=0, le=1)
    feedback: str


def generate_exam_for_plan(
    db: Session,
    request: ExamGenerateRequest,
    settings: Optional[Settings] = None,
    user: Optional[User] = None,
) -> Optional[ExamResponse]:
    """Generate and save an exam for a saved prep plan."""

    plan = db.get(PrepPlan, request.prep_plan_id)
    if plan is None or not _owns_plan(plan, user):
        return None

    scope, topics = _resolve_exam_scope(plan, request)
    role_blueprint = _role_blueprint_for_plan(plan)
    generation_blueprint = _build_exam_blueprint(topics, request, role_blueprint)
    db_exam = Exam(
        prep_plan_id=plan.id,
        title=_exam_title(request.day, request.difficulty, scope),
        day=request.day,
        scope=scope,
        time_limit_minutes=request.time_limit_minutes or max(20, request.question_count * 6),
        generation_blueprint=generation_blueprint,
    )
    db.add(db_exam)
    db.flush()

    generated = _generate_questions_with_ai(plan, topics, request, settings, scope, role_blueprint, generation_blueprint) or []
    if len(generated) < request.question_count:
        require_ai_result(
            "AI exam generation did not return enough questions. Enable local fallback in settings to fill the exam with offline questions."
        )
        generated.extend(_generate_questions(topics, request.question_count - len(generated), request.difficulty, request.question_types))
    generated = [_constrain_question_topics(question, topics, index) for index, question in enumerate(generated)]
    generated = _quality_review_with_ai(generated, plan, request, role_blueprint, settings)
    quality_report = _exam_quality_report(generated, topics, request.question_count)
    db_exam.quality_report = quality_report
    db_questions: list[Question] = []
    for index, question in enumerate(generated):
        db_question = Question(
            exam_id=db_exam.id,
            question_metadata=generation_blueprint[index] if index < len(generation_blueprint) else {},
            **question,
        )
        db.add(db_question)
        db_questions.append(db_question)

    db.commit()
    db.refresh(db_exam)
    for question in db_questions:
        db.refresh(question)

    return _exam_to_take_response(db_exam)


def get_exam_detail(db: Session, exam_id: int, user: Optional[User] = None) -> Optional[ExamResponse]:
    exam = db.get(Exam, exam_id)
    if exam is None or not _owns_plan(exam.prep_plan, user):
        return None
    return _exam_to_take_response(exam)


def list_exam_attempts(db: Session, user: Optional[User] = None, prep_plan_id: Optional[int] = None) -> list[ExamStoredAttemptResponse]:
    query = db.query(Exam).join(Exam.prep_plan).join(PrepPlan.job_post)
    query = query.filter(PrepPlan.job_post.has(user_id=user.id)) if user else query.filter(PrepPlan.job_post.has(user_id=None))
    if prep_plan_id is not None:
        query = query.filter(Exam.prep_plan_id == prep_plan_id)
    return [_stored_attempt_response(exam) for exam in query.order_by(Exam.created_at.desc(), Exam.id.desc()).all()]


def delete_exam(db: Session, exam_id: int, user: Optional[User] = None) -> bool:
    exam = db.get(Exam, exam_id)
    if exam is None or not _owns_plan(exam.prep_plan, user):
        return False
    db.delete(exam)
    db.commit()
    return True


def submit_exam_answers(
    db: Session,
    exam_id: int,
    request: ExamSubmissionRequest,
    settings: Optional[Settings] = None,
    user: Optional[User] = None,
) -> Optional[ExamSubmissionResponse]:
    exam = db.get(Exam, exam_id)
    if exam is None or not _owns_plan(exam.prep_plan, user):
        return None

    questions = {question.id: question for question in exam.questions}
    submitted_answers = {answer.question_id: answer.answer_text for answer in request.answers}
    results: list[AnswerResult] = []

    for question in sorted(questions.values(), key=lambda item: item.id):
        answer_text = (submitted_answers.get(question.id) or "").strip()

        if answer_text:
            ai_score = _score_answer_with_ai(question, answer_text, settings)
            if ai_score:
                score, feedback = ai_score
            else:
                if question.question_type not in {"multiple_choice", "multiple_select", "one_word", "fill_blank"}:
                    require_ai_result("AI exam scoring failed. Enable local fallback in settings to score written answers offline.")
                score, feedback = _score_answer(question, answer_text)
        else:
            score, feedback = 0.0, "Not answered. This question counts as zero so the exam score reflects the full attempt."
        db.add(
            AnswerAttempt(
                question_id=question.id,
                answer_text=answer_text,
                score=score,
                feedback=feedback,
            )
        )
        results.append(AnswerResult(question_id=question.id, score=score, feedback=feedback))

    db.commit()
    average = round(sum(result.score for result in results) / len(results), 2) if results else 0.0
    return ExamSubmissionResponse(
        exam_id=exam.id,
        average_score=average,
        results=results,
        review_exam=_exam_to_review_response(exam),
    )


def _topics_for_day(plan: PrepPlan, day: int) -> list[str]:
    topics: list[str] = []
    for task in plan.tasks:
        if task.day == day:
            for topic in task.topics:
                if topic not in topics:
                    topics.append(topic)
    if topics:
        return topics

    for task in plan.tasks:
        for topic in task.topics:
            if topic not in topics:
                topics.append(topic)
    return topics or ["Python", "Problem Solving"]


def _topics_through_day(plan: PrepPlan, day: int) -> list[str]:
    """Return ordered, de-duplicated topics learned through a plan day.

    The Plan page deliberately sends only the scope and selected day. This
    resolver is the source of truth, so an extra syllabus exam never includes
    later material simply because the browser supplied it.
    """

    topics: list[str] = []
    seen: set[str] = set()
    for task in sorted(plan.tasks, key=lambda item: (item.day, item.id)):
        if task.day > day:
            continue
        for topic in task.topics or []:
            clean = topic.strip()
            key = clean.casefold()
            if clean and key not in seen:
                seen.add(key)
                topics.append(clean)
    return topics or _topics_for_day(plan, day)


def _resolve_exam_scope(plan: PrepPlan, request: ExamGenerateRequest) -> tuple[str, list[str]]:
    custom_topics = [topic.strip() for topic in (request.focus_topics or []) if topic and topic.strip()]
    scope = request.scope or ("custom_topics" if custom_topics else "selected_day")

    if scope == "through_selected_day":
        return scope, _topics_through_day(plan, request.day)
    if scope == "custom_topics":
        return scope, custom_topics or _topics_for_day(plan, request.day)
    return "selected_day", _topics_for_day(plan, request.day)


def _exam_title(day: int, difficulty: str, scope: str) -> str:
    prefix = f"Syllabus through Day {day}" if scope == "through_selected_day" else f"Day {day}"
    return f"{prefix} {difficulty.title()} Interview Prep Exam"


def _role_blueprint_for_plan(plan: PrepPlan) -> Optional[RoleBlueprint]:
    record = plan.job_post.role_blueprint
    if record is None:
        return None
    try:
        return RoleBlueprint.model_validate(record.blueprint)
    except Exception:
        return None


def _build_exam_blueprint(
    topics: list[str],
    request: ExamGenerateRequest,
    role_blueprint: Optional[RoleBlueprint],
) -> list[dict]:
    """Create coverage before prose generation so question quality is measurable."""

    types = _effective_question_types(request.question_types, request.difficulty)
    if request.auto_question_types:
        types = {
            "easy": ["multiple_choice", "one_word", "fill_blank", "short_answer"],
            "medium": ["multiple_choice", "short_answer", "multiple_select", "coding"],
            "hard": ["short_answer", "coding", "multiple_select", "multiple_choice"],
        }.get(request.difficulty, types)
    cognitive_levels = {
        "easy": ["remember", "understand", "apply"],
        "medium": ["understand", "apply", "analyze"],
        "hard": ["apply", "analyze", "evaluate", "create"],
    }.get(request.difficulty, ["understand", "apply", "analyze"])
    competency_names = {item.name.casefold(): item.name for item in (role_blueprint.competencies if role_blueprint else [])}
    specs: list[dict] = []
    for index in range(request.question_count):
        topic = topics[index % len(topics)]
        specs.append({
            "number": index + 1,
            "topic": topic,
            "competency": competency_names.get(topic.casefold(), topic),
            "question_type": types[index % len(types)],
            "difficulty": request.difficulty,
            "cognitive_level": cognitive_levels[index % len(cognitive_levels)],
        })
    return specs


def _owns_plan(plan: PrepPlan, user: Optional[User]) -> bool:
    if user:
        return plan.job_post.user_id == user.id
    return plan.job_post.user_id is None


def _stored_attempt_response(exam: Exam) -> ExamStoredAttemptResponse:
    results: list[AnswerResult] = []
    answers: dict[int, str] = {}
    scores: list[float] = []
    has_attempt = False
    for question in sorted(exam.questions, key=lambda item: item.id):
        latest = max(question.attempts, key=lambda attempt: attempt.id, default=None)
        if latest is None:
            scores.append(0.0)
            continue
        has_attempt = True
        score = float(latest.score or 0)
        scores.append(score)
        answers[question.id] = latest.answer_text or ""
        results.append(AnswerResult(question_id=question.id, score=score, feedback=latest.feedback or ""))
    average = round(sum(scores) / len(exam.questions), 2) if has_attempt and exam.questions else None
    return ExamStoredAttemptResponse(
        exam=_exam_to_take_response(exam),
        review_exam=_exam_to_review_response(exam) if has_attempt else None,
        status="complete" if has_attempt else "ready",
        average_score=average,
        results=results,
        answers=answers,
        created_at=exam.created_at,
    )


def _generate_questions(topics: list[str], count: int, difficulty: str, question_types: list[str]) -> list[dict]:
    questions: list[dict] = []
    normalized_types = _effective_question_types(question_types, difficulty)
    template_map = {
        "multiple_choice": _multiple_choice_question,
        "short_answer": _short_answer_question,
        "one_word": _one_word_question,
        "fill_blank": _fill_blank_question,
        "multiple_select": _multiple_select_question,
        "coding": _coding_question,
    }
    templates = [template_map[kind] for kind in normalized_types if kind in template_map] or [_multiple_choice_question, _short_answer_question, _coding_question]

    for index in range(count):
        topic = topics[index % len(topics)]
        template = templates[index % len(templates)]
        questions.append(template(topic, difficulty, index + 1))

    return questions


def _effective_question_types(question_types: list[str], difficulty: str) -> list[str]:
    allowed = {"multiple_choice", "short_answer", "one_word", "fill_blank", "multiple_select", "coding"}
    requested = [item for item in question_types if item in allowed]
    if requested:
        return requested
    if difficulty == "easy":
        return ["multiple_choice", "one_word", "fill_blank", "short_answer"]
    if difficulty == "hard":
        return ["short_answer", "coding", "multiple_select", "fill_blank", "multiple_choice"]
    return ["multiple_choice", "short_answer", "fill_blank", "coding"]


def _constrain_question_topics(question: dict, allowed_topics: list[str], index: int) -> dict:
    filtered_topics = [topic for topic in question.get("topics", []) if topic in allowed_topics]
    return {**question, "topics": filtered_topics or [allowed_topics[index % len(allowed_topics)]]}


def _generate_questions_with_ai(
    plan: PrepPlan,
    topics: list[str],
    request: ExamGenerateRequest,
    settings: Optional[Settings],
    scope: str,
    role_blueprint: Optional[RoleBlueprint] = None,
    generation_blueprint: Optional[list[dict]] = None,
) -> Optional[list[dict]]:
    if not settings or not settings.ai_enabled:
        require_ai_result("No AI provider is configured for exam generation. Enable local fallback in settings to create an offline exam.")
        return None

    questions: list[dict] = []
    seen_prompts: set[str] = set()
    attempts_without_progress = 0
    batch_number = 1

    while len(questions) < request.question_count and attempts_without_progress < 3:
        batch_size = min(10, request.question_count - len(questions))
        prompt = _exam_prompt(
            plan,
            topics,
            request,
            scope=scope,
            batch_question_count=batch_size,
            batch_number=batch_number,
            existing_prompts=[question["prompt"] for question in questions[-12:]],
            role_blueprint=role_blueprint,
            generation_blueprint=(generation_blueprint or [])[len(questions):len(questions) + batch_size],
        )
        data = _request_exam_batch(prompt, settings, batch_size)
        normalized = _normalize_ai_exam_questions(data, topics, request)
        before = len(questions)

        for item in normalized:
            key = _question_dedupe_key(item["prompt"])
            if key in seen_prompts:
                continue
            seen_prompts.add(key)
            questions.append(item)
            if len(questions) >= request.question_count:
                break

        if len(questions) == before:
            attempts_without_progress += 1
        else:
            attempts_without_progress = 0
        batch_number += 1

    if len(questions) < request.question_count:
        require_ai_result(
            "AI exam generation did not return enough usable questions. Enable local fallback in settings to fill the exam with offline questions."
        )
        return None
    return questions[: request.question_count]


def _request_exam_batch(prompt: str, settings: Settings, question_count: int) -> object:
    data: object | None = None

    if settings.openai_enabled:
        for output_budget in (max(5000, question_count * 900), max(8000, question_count * 1200)):
            try:
                data = _generate_questions_with_openai(prompt, settings, question_count, output_budget)
                break
            except Exception as exc:
                logger.warning("OpenAI exam generation failed with output budget %s: %s", output_budget, exc)

    if data is None and settings.gemini_enabled:
        try:
            data = generate_gemini_json(settings, prompt, _gemini_exam_schema())
        except Exception as exc:
            logger.warning("Gemini exam generation failed: %s", exc)

    if data is None:
        require_ai_result("AI exam generation failed. Enable local fallback in settings to create an offline exam.")
    return data


def _normalize_ai_exam_questions(data: object, topics: list[str], request: ExamGenerateRequest) -> list[dict]:
    raw_questions = data if isinstance(data, list) else data.get("questions", [])
    questions: list[dict] = []
    for index, item in enumerate(raw_questions, start=1):
        if not isinstance(item, dict):
            continue
        question_type = _normalize_question_type(str(item.get("question_type") or item.get("type") or "short_answer"))
        if request.question_types and not request.auto_question_types:
            allowed = {_normalize_question_type(kind) for kind in request.question_types}
            if question_type not in allowed:
                question_type = next(iter(allowed))
        prompt_text = item.get("prompt") or item.get("question") or item.get("title")
        if not prompt_text:
            continue
        question_topics = item.get("topics") or topics[:2]
        if isinstance(question_topics, str):
            question_topics = [question_topics]
        if not isinstance(question_topics, list):
            question_topics = topics[:2]
        questions.append(
            {
                "question_type": question_type,
                "prompt": str(prompt_text),
                "topics": [str(topic) for topic in question_topics if str(topic).strip()] or topics[:2],
                "expected_answer": item.get("expected_answer") or item.get("answer") or "Evaluate correctness, clarity, tradeoffs, and examples.",
                "options": _normalize_options(item.get("options"), question_type, index),
            }
        )
    return questions


def _quality_review_with_ai(
    questions: list[dict],
    plan: PrepPlan,
    request: ExamGenerateRequest,
    role_blueprint: Optional[RoleBlueprint],
    settings: Optional[Settings],
) -> list[dict]:
    """Use one structured critic pass to repair ambiguity and weak distractors."""

    if not settings or not settings.openai_enabled or not questions:
        return questions
    prompt = (
        "Audit and repair this interview exam. Return the same number of questions in the same JSON schema. "
        "Preserve scope and topics. Remove ambiguity, repeated wording, answer clues, unsupported company claims, "
        "and weak distractors. Every expected answer must be accurate, concise, and usable for fair grading. "
        "For multiple choice, exactly one option is correct. For multiple select, at least one option is correct. "
        "Do not place the answer inside the question prompt.\n\n"
        f"Role intelligence:\n{blueprint_context(role_blueprint, include_sources=False)}\n\n"
        f"Exam to audit:\n{json.dumps({'questions': questions}, ensure_ascii=False)}"
    )
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key)
        response = client.responses.parse(
            model=settings.analysis_model,
            input=[
                {"role": "system", "content": "You are a strict interview-assessment editor. Return structured JSON only."},
                {"role": "user", "content": prompt},
            ],
            text_format=AIExamOutput,
            max_output_tokens=max(6000, len(questions) * 900),
        )
        allowed_topics = _resolve_exam_scope(plan, request)[1]
        repaired = _normalize_ai_exam_questions(response.output_parsed.model_dump(), allowed_topics, request)
        repaired = [
            _constrain_question_topics(question, allowed_topics, index)
            for index, question in enumerate(repaired)
        ]
        if len(repaired) != len(questions):
            return questions
        original_report = _exam_quality_report(questions, allowed_topics, len(questions))
        repaired_report = _exam_quality_report(repaired, allowed_topics, len(questions))
        return repaired if repaired_report["issue_count"] <= original_report["issue_count"] else questions
    except Exception as exc:
        logger.warning("OpenAI exam quality review failed: %s", exc)
        return questions


def _exam_quality_report(questions: list[dict], allowed_topics: list[str], expected_count: int) -> dict:
    issues: list[dict] = []
    seen_prompts: set[str] = set()
    allowed = {topic.casefold() for topic in allowed_topics}
    covered: set[str] = set()
    for index, question in enumerate(questions, start=1):
        prompt = re.sub(r"\s+", " ", str(question.get("prompt") or "")).strip()
        expected = re.sub(r"\s+", " ", str(question.get("expected_answer") or "")).strip()
        key = _question_dedupe_key(prompt)
        if not prompt or len(prompt) < 24:
            issues.append({"question": index, "type": "prompt_too_short"})
        if key in seen_prompts:
            issues.append({"question": index, "type": "duplicate_prompt"})
        seen_prompts.add(key)
        if not expected:
            issues.append({"question": index, "type": "missing_expected_answer"})
        if len(expected) >= 14 and expected.casefold() in prompt.casefold():
            issues.append({"question": index, "type": "answer_leak_in_prompt"})
        topics = {str(topic).casefold() for topic in question.get("topics") or []}
        covered.update(topics & allowed)
        if topics - allowed:
            issues.append({"question": index, "type": "out_of_scope_topic"})
        options = question.get("options") or []
        if question.get("question_type") in {"multiple_choice", "multiple_select"}:
            texts = [str(option.get("text") or "").casefold() for option in options]
            correct_count = sum(1 for option in options if option.get("is_correct"))
            if len(options) < 3 or len(texts) != len(set(texts)):
                issues.append({"question": index, "type": "invalid_options"})
            if question.get("question_type") == "multiple_choice" and correct_count != 1:
                issues.append({"question": index, "type": "invalid_correct_option_count"})
            if question.get("question_type") == "multiple_select" and correct_count < 1:
                issues.append({"question": index, "type": "missing_correct_selection"})
    if len(questions) != expected_count:
        issues.append({"question": 0, "type": "incorrect_question_count"})
    missing_coverage = [topic for topic in allowed_topics if topic.casefold() not in covered]
    if expected_count >= len(allowed_topics):
        issues.extend({"question": 0, "type": "missing_topic_coverage", "topic": topic} for topic in missing_coverage)
    return {
        "passed": not issues,
        "issue_count": len(issues),
        "issues": issues[:30],
        "question_count": len(questions),
        "expected_count": expected_count,
        "covered_topics": sorted(covered),
        "missing_topics": missing_coverage,
    }


def _generate_questions_with_openai(prompt: str, settings: Settings, question_count: int, max_output_tokens: int) -> dict:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.responses.parse(
        model=settings.generation_model,
        input=[
            {
                "role": "system",
                "content": (
                    "You are a senior interview exam designer. "
                    "You write realistic, job-specific exam questions that test understanding, application, tradeoffs, and interview readiness. "
                    "Never write generic placeholder questions. Do not reveal answers inside prompts."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        text_format=AIExamOutput,
        max_output_tokens=max_output_tokens,
    )
    data = response.output_parsed.model_dump()
    if len(data.get("questions", [])) < question_count:
        raise ValueError(f"OpenAI returned {len(data.get('questions', []))}/{question_count} questions")
    return data


def _exam_prompt(
    plan: PrepPlan,
    topics: list[str],
    request: ExamGenerateRequest,
    scope: str = "selected_day",
    batch_question_count: Optional[int] = None,
    batch_number: int = 1,
    existing_prompts: Optional[list[str]] = None,
    role_blueprint: Optional[RoleBlueprint] = None,
    generation_blueprint: Optional[list[dict]] = None,
) -> str:
    scope_label = {
        "selected_day": "the selected day's planned topics only",
        "through_selected_day": f"all planned topics from Day 1 through Day {request.day}; do not use future-day material",
        "custom_topics": "the custom focus topics selected by the user",
    }.get(scope, "the selected day's planned topics only")
    allowed_types = ", ".join(request.question_types)
    question_count = batch_question_count or request.question_count
    avoid_block = ""
    if existing_prompts:
        avoid_block = "\nAvoid questions similar to these already-created prompts:\n" + "\n".join(f"- {prompt[:220]}" for prompt in existing_prompts)
    difficulty_rules = {
        "easy": "Test definitions, recognition, light application, and common mistakes. Keep wording clear but not trivial.",
        "medium": "Test applied reasoning, tradeoffs, edge cases, and realistic interview explanations.",
        "hard": "Test deep application, debugging, ambiguity, design tradeoffs, optimization, and strong spoken reasoning.",
    }.get(request.difficulty, "Test applied interview readiness.")
    return (
        "Create a high-quality interview preparation exam as JSON only.\n\n"
        "QUALITY BAR:\n"
        "- Every question must be specific to the role and the supplied topics.\n"
        "- Avoid vague prompts like 'explain topic'. Ask scenario-based, decision-based, debugging, design, sales/client, or implementation questions as appropriate.\n"
        "- The expected_answer must explain what a strong answer should include, not just the final answer.\n"
        "- Questions must not repeat the same wording pattern.\n"
        "- Do not ask about topics outside the supplied topic list.\n"
        "- If coding is requested but the role is not primarily software, convert coding into structured problem solving, calculation, estimation, or workflow logic.\n"
        "- If MCQ is requested, answer choices must be plausible; wrong options should represent realistic misconceptions.\n"
        "- If fill_blank is requested, write the prompt with a clear blank marker: ____.\n"
        "- If one_word is requested, the expected answer must be a single term or very short phrase.\n"
        "- If multiple_select is requested, at least two options can be correct when appropriate.\n\n"
        f"Return exactly {question_count} complete questions for batch {batch_number}. Keep each prompt and expected answer concise enough to fit the structured response.\n"
        f"Role: {plan.job_post.title}\n"
        f"Shared role intelligence:\n{blueprint_context(role_blueprint, include_sources=False)}\n"
        f"Job-posting source excerpt: {getattr(plan.job_post, 'description', '')[:3000]}\n"
        f"Prep plan summary: {plan.summary}\n"
        f"Exam scope: {scope_label}\n"
        f"Day: {request.day}\n"
        f"Question count for this batch: {question_count}\n"
        f"Total exam question target: {request.question_count}\n"
        f"Time limit minutes: {request.time_limit_minutes or max(20, request.question_count * 6)}\n"
        f"Difficulty: {request.difficulty}\n"
        f"Difficulty rules: {difficulty_rules}\n"
        f"Allowed question types: {allowed_types}\n"
        f"Question type policy: {'Choose the strongest mix for this role and topics.' if request.auto_question_types else 'Use the requested types as much as possible.'}\n"
        f"Topics to test: {', '.join(topics)}\n"
        f"Required assessment blueprint for this batch:\n{json.dumps(generation_blueprint or [], ensure_ascii=False)}"
        f"{avoid_block}"
    )


def _question_dedupe_key(prompt: str) -> str:
    return " ".join(prompt.lower().replace("?", "").replace(".", "").split()[:18])


def _normalize_question_type(value: str) -> str:
    text = value.lower().replace("-", "_").replace(" ", "_")
    if text in {"multiple_choice", "short_answer", "coding", "one_word", "fill_blank", "multiple_select"}:
        return text
    if "blank" in text:
        return "fill_blank"
    if "one" in text and "word" in text:
        return "one_word"
    if "multi" in text and "select" in text:
        return "multiple_select"
    if "choice" in text or "mcq" in text:
        return "multiple_choice"
    if "code" in text or "coding" in text:
        return "coding"
    return "short_answer"


def _normalize_options(options: object, question_type: str, number: int) -> Optional[list[dict]]:
    if question_type not in {"multiple_choice", "multiple_select"}:
        return None
    if not isinstance(options, list):
        return _fallback_options(number)

    normalized = []
    for index, option in enumerate(options[:4]):
        if isinstance(option, dict):
            text = option.get("text") or option.get("answer") or option.get("option") or f"Option {index + 1}"
            raw_label = str(option.get("label") or "").strip()
            label = raw_label.upper() if len(raw_label) == 1 and raw_label.upper() in {"A", "B", "C", "D"} else chr(65 + index)
            if raw_label and label != raw_label.upper() and not str(text).lower().startswith(raw_label.lower()):
                text = f"{raw_label}: {text}"
            is_correct = bool(option.get("is_correct") or option.get("correct"))
        else:
            text = str(option)
            label = chr(65 + index)
            is_correct = index == 0
        normalized.append({"label": str(label), "text": str(text), "is_correct": is_correct})

    while len(normalized) < 4:
        normalized.append({"label": chr(65 + len(normalized)), "text": f"Additional option {len(normalized) + 1}", "is_correct": False})
    if not any(option["is_correct"] for option in normalized):
        normalized[0]["is_correct"] = True
    if question_type == "multiple_choice" and sum(1 for option in normalized if option["is_correct"]) > 1:
        first_correct_seen = False
        for option in normalized:
            if option["is_correct"] and not first_correct_seen:
                first_correct_seen = True
            elif option["is_correct"]:
                option["is_correct"] = False
    return normalized


def _fallback_options(number: int) -> list[dict]:
    return [
        {"label": "A", "text": f"The answer that connects the concept to the role, names a tradeoff, and gives a concrete example.", "is_correct": True},
        {"label": "B", "text": "The answer that gives a memorized definition without applying it to the job.", "is_correct": False},
        {"label": "C", "text": "The answer that sounds confident but skips constraints, risks, or validation.", "is_correct": False},
        {"label": "D", "text": "The answer that changes the topic instead of addressing the scenario.", "is_correct": False},
    ]


def _multiple_choice_question(topic: str, difficulty: str, number: int) -> dict:
    scenario = _scenario_for(topic, difficulty)
    return {
        "question_type": "multiple_choice",
        "prompt": f"{number}. {scenario} Which response would sound strongest in an interview?",
        "topics": [topic],
        "expected_answer": f"The best answer should apply {topic} to the scenario, explain why it matters, and name one realistic tradeoff or risk.",
        "options": [
            {"label": "A", "text": f"I would first clarify the goal, use {topic} where it directly solves the role problem, mention a tradeoff, and validate the result.", "is_correct": True},
            {"label": "B", "text": f"I would define {topic} from memory and move on without connecting it to the job.", "is_correct": False},
            {"label": "C", "text": "I would choose the fastest-looking option and avoid discussing risks unless asked.", "is_correct": False},
            {"label": "D", "text": "I would focus only on tools or buzzwords because interviewers mostly want keywords.", "is_correct": False},
        ],
    }


def _short_answer_question(topic: str, difficulty: str, number: int) -> dict:
    scenario = _scenario_for(topic, difficulty)
    return {
        "question_type": "short_answer",
        "prompt": f"{number}. {scenario} Explain your approach and include one tradeoff you would mention out loud.",
        "topics": [topic],
        "expected_answer": f"A strong answer applies {topic} to the scenario, names assumptions, gives a concrete example, and explains a tradeoff, risk, or validation step.",
        "options": None,
    }


def _one_word_question(topic: str, difficulty: str, number: int) -> dict:
    return {
        "question_type": "one_word",
        "prompt": f"{number}. In one term or short phrase, what is the main interview concept being tested when a question asks you to compare options, explain risks, and justify your choice for {topic}?",
        "topics": [topic],
        "expected_answer": "tradeoff analysis",
        "options": None,
    }


def _fill_blank_question(topic: str, difficulty: str, number: int) -> dict:
    return {
        "question_type": "fill_blank",
        "prompt": f"{number}. Fill in the blank: A strong interview answer about {topic} should connect the concept to the job, give a concrete example, and mention one ____ or limitation.",
        "topics": [topic],
        "expected_answer": "tradeoff",
        "options": None,
    }


def _multiple_select_question(topic: str, difficulty: str, number: int) -> dict:
    return {
        "question_type": "multiple_select",
        "prompt": f"{number}. Select all details that would make an answer about {topic} stronger for this interview.",
        "topics": [topic],
        "expected_answer": "Strong answers include a job-specific example, tradeoffs, validation, and clear reasoning.",
        "options": [
            {"label": "A", "text": "A concrete example tied to the role responsibilities.", "is_correct": True},
            {"label": "B", "text": "A tradeoff, risk, or limitation.", "is_correct": True},
            {"label": "C", "text": "A validation step, metric, test, or feedback loop.", "is_correct": True},
            {"label": "D", "text": "A broad claim that the topic is important without explaining why.", "is_correct": False},
        ],
    }


def _coding_question(topic: str, difficulty: str, number: int) -> dict:
    if difficulty == "hard":
        prompt = (
            f"{number}. Design a small Python function or pseudocode workflow using {topic}. "
            "Handle one edge case, explain time/space complexity or operational cost, and describe how you would test it."
        )
    elif difficulty == "easy":
        prompt = (
            f"{number}. Write a simple Python function or clear pseudocode example that demonstrates {topic}. "
            "Add one sentence explaining why your solution works."
        )
    else:
        prompt = (
            f"{number}. Write a Python function or structured pseudocode solution for a realistic task involving {topic}. "
            "Explain one edge case and one tradeoff."
        )
    return {
        "question_type": "coding",
        "prompt": prompt,
        "topics": [topic, "Python"],
        "expected_answer": "A correct answer should be readable, solve the requested task, handle edge cases, and explain complexity, validation, or operational tradeoffs.",
        "options": None,
    }


def _scenario_for(topic: str, difficulty: str) -> str:
    if difficulty == "hard":
        return f"An interviewer gives you an ambiguous situation involving {topic} and asks you to justify a decision under constraints."
    if difficulty == "easy":
        return f"An interviewer asks for a clear beginner-friendly explanation of {topic} with one example."
    return f"An interviewer asks how you would apply {topic} in a realistic work situation."


def _score_answer(question: Question, answer_text: str) -> tuple[float, str]:
    answer = answer_text.lower()

    if question.question_type in {"multiple_choice", "multiple_select"}:
        correct_labels = [
            option["label"].lower()
            for option in question.options or []
            if option.get("is_correct")
        ]
        if question.question_type == "multiple_select":
            selected = {item.strip().lower() for item in answer.replace(";", ",").split(",") if item.strip()}
            correct = set(correct_labels)
            wrong_selected = selected - correct
            missed = correct - selected
            score = 1.0 if selected == correct else max(0.0, round((len(correct & selected) - len(wrong_selected)) / max(1, len(correct)), 2))
            feedback = "Correct selections." if score == 1.0 else "Review which details are truly necessary for a strong interview answer."
            return score, feedback
        score = 1.0 if answer.strip().lower() in correct_labels else 0.0
        feedback = "Correct choice." if score == 1.0 else "Review the concept and choose the strongest technical explanation."
        return score, feedback

    if question.question_type in {"one_word", "fill_blank"} and question.expected_answer:
        expected = question.expected_answer.lower().strip()
        score = 1.0 if expected in answer or answer in expected else 0.0
        feedback = "Correct concise answer." if score == 1.0 else f"Expected a concise answer close to: {question.expected_answer}."
        return score, feedback

    expected_words = {"explain", "example", "tradeoff", "test", "edge", "complexity"}
    hits = sum(1 for word in expected_words if word in answer)
    score = round(min(1.0, hits / 3), 2)
    feedback = "Good answer." if score >= 0.7 else "Add more concrete examples, tradeoffs, tests, or complexity details."
    return score, feedback


def _score_answer_with_ai(
    question: Question,
    answer_text: str,
    settings: Optional[Settings],
) -> Optional[tuple[float, str]]:
    if not settings or not settings.ai_enabled or question.question_type in {"multiple_choice", "multiple_select", "one_word", "fill_blank"}:
        return None

    prompt = (
        "Score this interview answer as JSON only. "
        "Give a score from 0 to 1 and concise, actionable feedback.\n\n"
        f"Question: {question.prompt}\n"
        f"Expected answer notes: {question.expected_answer}\n"
        f"Candidate answer: {answer_text}"
    )

    if settings.openai_enabled:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openai_api_key)
            response = client.responses.parse(
                model=settings.scoring_model,
                input=[
                    {
                        "role": "system",
                        "content": "You score interview exam answers as structured JSON with strict, fair grading.",
                    },
                    {"role": "user", "content": prompt},
                ],
                text_format=AIAnswerScore,
            )
            data = response.output_parsed
            return round(float(data.score), 2), data.feedback
        except Exception as exc:
            logger.warning("OpenAI exam scoring failed: %s", exc)

    if settings.gemini_enabled:
        try:
            data = generate_gemini_json(settings, prompt, _gemini_score_schema())
            return round(float(data["score"]), 2), data["feedback"]
        except Exception as exc:
            logger.warning("Gemini exam scoring failed: %s", exc)

    require_ai_result("AI exam scoring failed. Enable local fallback in settings to score written answers offline.")
    return None


def _gemini_exam_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "questions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "question_type": {"type": "string", "enum": ["multiple_choice", "short_answer", "one_word", "fill_blank", "multiple_select", "coding"]},
                        "prompt": {"type": "string"},
                        "topics": {"type": "array", "items": {"type": "string"}},
                        "expected_answer": {"type": "string"},
                        "options": {
                            "type": "array",
                            "items": {
                                "type": "object",
                                "properties": {
                                    "label": {"type": "string"},
                                    "text": {"type": "string"},
                                    "is_correct": {"type": "boolean"},
                                },
                                "required": ["label", "text", "is_correct"],
                            },
                        },
                    },
                    "required": ["question_type", "prompt", "topics", "expected_answer", "options"],
                },
            }
        },
        "required": ["questions"],
    }


def _gemini_score_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "score": {"type": "number"},
            "feedback": {"type": "string"},
        },
        "required": ["score", "feedback"],
    }


def _exam_to_take_response(exam: Exam) -> ExamResponse:
    questions = [
        QuestionResponse(
            id=question.id,
            question_type=question.question_type,
            prompt=question.prompt,
            topics=question.topics,
            options=[
                {"label": option.get("label", ""), "text": option.get("text", "")}
                for option in (question.options or [])
            ] or None,
        )
        for question in sorted(exam.questions, key=lambda question: question.id)
    ]
    return ExamResponse(
        id=exam.id,
        prep_plan_id=exam.prep_plan_id,
        title=exam.title,
        day=exam.day,
        scope=exam.scope or "selected_day",
        time_limit_minutes=exam.time_limit_minutes,
        questions=questions,
    )


def _exam_to_review_response(exam: Exam) -> ExamReviewResponse:
    questions = [
        QuestionReviewResponse(
            id=question.id,
            question_type=question.question_type,
            prompt=question.prompt,
            topics=question.topics,
            expected_answer=question.expected_answer,
            options=question.options,
        )
        for question in sorted(exam.questions, key=lambda question: question.id)
    ]
    return ExamReviewResponse(
        id=exam.id,
        prep_plan_id=exam.prep_plan_id,
        title=exam.title,
        day=exam.day,
        scope=exam.scope or "selected_day",
        time_limit_minutes=exam.time_limit_minutes,
        questions=questions,
    )
