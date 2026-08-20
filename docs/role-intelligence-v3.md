# Role Intelligence v3

Role Intelligence v3 is the shared, persisted source of truth for job-scoped generation. It replaces independent feature prompts with one traceable pipeline so the plan, notes, exams, and mock interviews prepare the same role priorities.

## Goals

- Keep the saved job posting as the authoritative source for requirements and responsibilities.
- Use web research as supporting evidence, never as an unlabelled replacement for the posting.
- Reuse research instead of paying for the same search on every note or practice action.
- Turn role signals into explicit competencies, learning objectives, common mistakes, and assessment modes.
- Make generated exams and mocks auditable and prevent exam answer leakage.
- Preserve existing jobs, plans, and frontend API behavior during migration.

## Pipeline

```text
Pasted job / URL / browser capture
                 |
                 v
      Canonical job-description brief
                 |
        +--------+---------+
        |                  |
        v                  v
  Posting evidence   Ranked Tavily evidence
        |                  |
        +--------+---------+
                 v
         Role Blueprint v3
                 |
       +---------+---------+----------+
       |         |         |          |
       v         v         v          v
    Plan       Notes      Exams      Mocks
```

## Evidence policy

Each source has an origin, authority score, relevance score, retrieval query, stable source ID, and excerpt. The source ranking gives preference to the company site, government and occupation references, and official technical documentation. Low-relevance generic pages are excluded. Search results are deduplicated and cached by job-description fingerprint.

The posting itself is always stored as `job-posting` with maximum authority. Generated responsibilities cite that source. Research sources are visibly separate and support preparation context; they do not silently create must-have requirements.

## Role Blueprint contract

The persisted `RoleBlueprint` contains:

- role identity and summary;
- prioritized competencies;
- competency-specific learning objectives, common mistakes, and assessment modes;
- requirements and evidence-backed responsibilities;
- behavioral story prompts and questions to ask;
- expected interview-round shapes;
- research sources and unresolved facts to verify.

The blueprint is invalidated when the saved job description changes. Existing jobs receive a blueprint lazily the next time their analysis or intelligence endpoint is opened.

## Artifact generation

### Prep plans

Critical competencies are guaranteed to appear in at least one scheduled task even if an AI response omits them. The saved plan records the blueprint version used to create it.

### Study notes

Notes receive the blueprint plus the cached evidence bundle. Resource cards retain source origin, authority, relevance, and source ID so provenance can be displayed or audited later.

### Exams

The service creates an assessment blueprint before generation, constrains questions to the selected plan scope, and records a deterministic quality report. With OpenAI enabled, a structured critic pass can repair ambiguity, answer clues, duplicate questions, and weak distractors.

Take-side API responses do not include `expected_answer` or option `is_correct` values. Those fields appear only in `review_exam` after submission and in completed stored attempts.

### Mock interviews

Each session begins with a saved question plan. Every slot contains a topic, competency, question type, intent, and scoring rubric. Feedback records relevance, accuracy, depth, structure, and communication scores plus strengths and improvements. Completed sessions include an aggregate summary of strongest and weakest dimensions.

## Operational tracing

`generation_runs` records artifact type, prompt version, provider/model, input-context hash, approximate token counts, quality metadata, and related job/plan IDs. This makes later prompt evaluation and regression analysis possible without storing credentials.

## API additions and compatibility

- `GET /jobs/{job_post_id}/intelligence` returns the saved blueprint and research status.
- Existing exam generation/detail responses remain take-safe.
- Exam submission adds `review_exam`.
- Completed stored exam attempts add `review_exam`; ready attempts do not.
- Mock responses add `session_plan`, per-message `detail`, and `overall_feedback`.
- Existing `OPENAI_MODEL` and `TAVILY_API_KEY` settings remain valid.

## Provider configuration

No new provider is required. OpenAI and Tavily cover the implemented pipeline. Optional model overrides are available through `OPENAI_ANALYSIS_MODEL`, `OPENAI_GENERATION_MODEL`, and `OPENAI_SCORING_MODEL`; all fall back to `OPENAI_MODEL`. Tavily depth, result count, and cache duration are configurable.

`ONET_API_KEY` is reserved for optional future occupation-taxonomy enrichment. The current pipeline does not require it.
