import logging
import json
from typing import Optional

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.config import Settings
from app.models import MockInterview, MockMessage, PrepPlan
from app.schemas.mock_interview import MockAnswerRequest, MockInterviewResponse, MockInterviewStartRequest
from app.services.gemini_service import generate_gemini_json

logger = logging.getLogger(__name__)

QUESTION_TYPES = ["technical", "one_word", "multiple_choice", "multiple_select", "coding", "behavioral", "team_problem_solving"]
QUESTION_COUNT_BY_DIFFICULTY = {"easy": 4, "medium": 6, "hard": 8}


class MockQuestionOutput(BaseModel):
    question: str


class MockFeedbackOutput(BaseModel):
    score: float = Field(ge=0, le=1)
    feedback: str
    follow_up_question: str


def start_mock_interview(
    db: Session,
    request: MockInterviewStartRequest,
    settings: Optional[Settings] = None,
) -> Optional[MockInterviewResponse]:
    """Start a mock interview session for a saved prep plan."""

    plan = db.get(PrepPlan, request.prep_plan_id)
    if plan is None:
        return None

    topic = request.topic or _first_topic(plan)
    interview = MockInterview(prep_plan_id=plan.id, current_topic=topic, status="active")
    db.add(interview)
    db.flush()
    config = _mock_config(request)
    db.add(MockMessage(mock_interview_id=interview.id, role="meta", content=json.dumps(config)))
    question_type = config["question_types"][0]
    question = _question_with_ai(plan, topic, question_type, config, settings) or _question(topic, question_type, config["difficulty"])
    db.add(MockMessage(mock_interview_id=interview.id, role="interviewer", content=question))
    db.commit()
    db.refresh(interview)
    return _to_response(interview)


def get_mock_interview(db: Session, mock_interview_id: int) -> Optional[MockInterviewResponse]:
    interview = db.get(MockInterview, mock_interview_id)
    if interview is None:
        return None
    return _to_response(interview)


def answer_mock_question(
    db: Session,
    mock_interview_id: int,
    request: MockAnswerRequest,
    settings: Optional[Settings] = None,
) -> Optional[MockInterviewResponse]:
    interview = db.get(MockInterview, mock_interview_id)
    if interview is None:
        return None

    config = _config_for_interview(interview)
    answered_count = _answered_count(interview)
    ai_feedback = _mock_feedback_with_ai(interview, request.answer_text, config, settings)
    if ai_feedback:
        score, feedback, follow_up = ai_feedback
    else:
        score, feedback = _score_answer(request.answer_text)
        follow_up = _follow_up(interview.current_topic, score, config)
    db.add(MockMessage(mock_interview_id=interview.id, role="candidate", content=request.answer_text))
    db.add(MockMessage(mock_interview_id=interview.id, role="feedback", content=feedback, score=score))
    next_question_number = answered_count + 2
    if next_question_number <= config["question_count"]:
        question_type = config["question_types"][(next_question_number - 1) % len(config["question_types"])]
        next_question = follow_up or _question(interview.current_topic, question_type, config["difficulty"])
        db.add(MockMessage(mock_interview_id=interview.id, role="interviewer", content=next_question))
    else:
        interview.status = "complete"

    scores = [message.score for message in interview.messages if message.score is not None] + [score]
    interview.average_score = round(sum(scores) / len(scores), 2)
    db.commit()
    db.refresh(interview)
    return _to_response(interview)


def _first_topic(plan: PrepPlan) -> str:
    for task in plan.tasks:
        if task.topics:
            return task.topics[0]
    return "Python"


def _mock_config(request: MockInterviewStartRequest) -> dict:
    difficulty = request.difficulty.lower()
    if difficulty not in QUESTION_COUNT_BY_DIFFICULTY:
        difficulty = "medium"
    question_count = request.question_count or QUESTION_COUNT_BY_DIFFICULTY[difficulty]
    question_types = [item for item in request.question_types if item in QUESTION_TYPES]
    return {
        "difficulty": difficulty,
        "question_count": min(12, max(1, question_count)),
        "question_types": question_types or ["technical", "multiple_choice", "coding", "behavioral"],
    }


def _config_for_interview(interview: MockInterview) -> dict:
    for message in interview.messages:
        if message.role == "meta":
            try:
                return json.loads(message.content)
            except json.JSONDecodeError:
                break
    return {"difficulty": "medium", "question_count": 6, "question_types": ["technical", "multiple_choice", "coding", "behavioral"]}


def _answered_count(interview: MockInterview) -> int:
    return sum(1 for message in interview.messages if message.role == "candidate")


def _question(topic: str, question_type: str, difficulty: str) -> str:
    if question_type == "one_word":
        return f"One-word answer ({difficulty}): What keyword best describes the main purpose of {topic}?"
    if question_type == "multiple_choice":
        return (
            f"MCQ ({difficulty}): Which answer best explains a strong interview point for {topic}?\n"
            "A. Give a concrete example, tradeoff, and result\n"
            "B. Only define the term\n"
            "C. Avoid explaining reasoning\n"
            "D. Skip edge cases"
        )
    if question_type == "multiple_select":
        return (
            f"Multiple select ({difficulty}): Which details should a strong answer about {topic} include? Select all that apply.\n"
            "A. Real example\nB. Tradeoffs\nC. Edge cases\nD. No testing or validation"
        )
    if question_type == "coding":
        return f"Coding ({difficulty}): Write or describe a small solution using {topic}. Include edge cases and complexity."
    if question_type == "behavioral":
        return f"Behavioral ({difficulty}): Tell me about a time you used {topic} under pressure. What did you do and what changed?"
    if question_type == "team_problem_solving":
        return f"Team problem solving ({difficulty}): Describe a time your team disagreed about {topic}. How did you align people and move forward?"
    return f"Technical ({difficulty}): Explain a project where you used {topic}, including tradeoffs and results."


def _question_with_ai(
    plan: PrepPlan,
    topic: str,
    question_type: str,
    config: dict,
    settings: Optional[Settings],
) -> Optional[str]:
    if not settings or not settings.ai_enabled:
        return None

    prompt = _question_prompt(plan, topic, question_type, config)
    if settings.openai_enabled:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openai_api_key)
            response = client.responses.parse(
                model=settings.openai_model,
                input=[
                    {
                        "role": "system",
                        "content": "You create realistic interview questions as structured JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                text_format=MockQuestionOutput,
            )
            return response.output_parsed.question
        except Exception as exc:
            logger.warning("OpenAI mock interview question failed: %s", exc)

    if settings.gemini_enabled:
        try:
            data = generate_gemini_json(settings, prompt, _gemini_question_schema())
            return data["question"]
        except Exception as exc:
            logger.warning("Gemini mock interview question failed: %s", exc)
    return None


def _question_prompt(plan: PrepPlan, topic: str, question_type: str, config: dict) -> str:
    return (
        "Create one realistic mock interview question as JSON only. "
        "Return exactly one question. Match the requested question type and difficulty. "
        "For multiple_choice include A-D options in the question text. "
        "For multiple_select include A-D options and say select all that apply. "
        "For one_word require a one-word answer. "
        "For coding ask for code or pseudocode plus complexity.\n\n"
        "For team_problem_solving ask about collaboration, disagreement, tradeoffs, ownership, and communication.\n\n"
        f"Role: {plan.job_post.title}\n"
        f"Prep plan summary: {plan.summary}\n"
        f"Topic: {topic}\n"
        f"Difficulty: {config['difficulty']}\n"
        f"Question type: {question_type}"
    )


def _follow_up(topic: str, score: float, config: dict) -> str:
    if score >= 0.75:
        return f"Good. Next {config['difficulty']} question: what edge cases or failure modes would you watch for in {topic}?"
    return f"Let's strengthen that with a {config['difficulty']} follow-up. Give a concrete example and explain why {topic} mattered."


def _score_answer(answer_text: str) -> tuple[float, str]:
    answer = answer_text.lower()
    signals = ["example", "tradeoff", "test", "edge", "because", "result", "complexity"]
    hits = sum(1 for signal in signals if signal in answer)
    score = round(min(1.0, hits / 4), 2)
    if score >= 0.75:
        return score, "Strong answer. You gave enough detail to sound prepared and practical."
    return score, "Add a specific example, tradeoffs, edge cases, and what result you achieved."


def _mock_feedback_with_ai(
    interview: MockInterview,
    answer_text: str,
    config: dict,
    settings: Optional[Settings],
) -> Optional[tuple[float, str, str]]:
    if not settings or not settings.ai_enabled:
        return None

    previous_question = ""
    for message in sorted(interview.messages, key=lambda item: item.id, reverse=True):
        if message.role == "interviewer":
            previous_question = message.content
            break

    prompt = (
        "Evaluate this mock interview answer as JSON only. "
        "Return a score from 0 to 1, actionable feedback, and one follow-up interviewer question. "
        "Make the follow-up match the requested difficulty and interview style.\n\n"
        f"Topic: {interview.current_topic}\n"
        f"Difficulty: {config['difficulty']}\n"
        f"Question types available: {', '.join(config['question_types'])}\n"
        f"Question: {previous_question}\n"
        f"Candidate answer: {answer_text}"
    )
    if settings.openai_enabled:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=settings.openai_api_key)
            response = client.responses.parse(
                model=settings.openai_model,
                input=[
                    {
                        "role": "system",
                        "content": "You evaluate mock interview answers as structured JSON.",
                    },
                    {"role": "user", "content": prompt},
                ],
                text_format=MockFeedbackOutput,
            )
            data = response.output_parsed
            return round(float(data.score), 2), data.feedback, data.follow_up_question
        except Exception as exc:
            logger.warning("OpenAI mock interview feedback failed: %s", exc)

    if settings.gemini_enabled:
        try:
            data = generate_gemini_json(settings, prompt, _gemini_feedback_schema())
            return round(float(data["score"]), 2), data["feedback"], data["follow_up_question"]
        except Exception as exc:
            logger.warning("Gemini mock interview feedback failed: %s", exc)
    return None


def _gemini_question_schema() -> dict:
    return {
        "type": "object",
        "properties": {"question": {"type": "string"}},
        "required": ["question"],
    }


def _gemini_feedback_schema() -> dict:
    return {
        "type": "object",
        "properties": {
            "score": {"type": "number"},
            "feedback": {"type": "string"},
            "follow_up_question": {"type": "string"},
        },
        "required": ["score", "feedback", "follow_up_question"],
    }


def _to_response(interview: MockInterview) -> MockInterviewResponse:
    config = _config_for_interview(interview)
    return MockInterviewResponse(
        id=interview.id,
        prep_plan_id=interview.prep_plan_id,
        current_topic=interview.current_topic,
        status=interview.status,
        difficulty=config["difficulty"],
        question_count=config["question_count"],
        answered_questions=_answered_count(interview),
        average_score=interview.average_score,
        messages=[
            {
                "id": message.id,
                "role": message.role,
                "content": message.content,
                "score": message.score,
            }
            for message in sorted(interview.messages, key=lambda message: message.id)
            if message.role != "meta"
        ],
    )
