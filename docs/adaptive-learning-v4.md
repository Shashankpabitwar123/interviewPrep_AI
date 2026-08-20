# Adaptive Learning and Quality v4

Version 4 turns Role Intelligence into a closed learning loop. It keeps the v3 Role Blueprint as the source of truth, evaluates every major generated artifact, converts real practice into competency evidence, and uses the weakest job-specific skills to decide what the user should do next.

## Learning loop

```text
Role Blueprint
      |
      v
Plan / note / exam / mock quality gate
      |
      v
Completed task + scored exam answer + scored mock answer
      |
      v
Auditable competency evidence
      |
      v
Role mastery + next best action
      |
      +----> weaker topics are prioritized in later exams, notes, and mocks
```

## Quality gates

- Prep plans are checked for complete timeline coverage, critical competency coverage, actionable instructions, an assessment loop, and duplicate tasks. Structural gaps are repaired deterministically before persistence.
- Study notes are checked for requested scope, role specificity, instructional depth, interview application, readiness checks, source integrity, and duplicate sections. A weak OpenAI note receives at most one structured repair pass; the higher-scoring version wins.
- Exams retain their assessment blueprint and critic pass. Their standardized quality report covers answer leakage, duplicates, topic scope, answer keys, option validity, and coverage.
- Mock interviews are checked for question count, scoring rubrics, role-priority coverage, and session variety. An unusable first AI question receives one retry.

Every report uses `passed`, `score`, `issues`, and artifact-specific metadata. Generation traces store the report, prompt version, provider/model, approximate tokens, status, and latency.

## Competency evidence

`competency_evidence` stores a small, auditable signal rather than a hidden aggregate:

- learning-task completion: low-confidence evidence;
- latest exam score per question: direct knowledge/application evidence;
- each mock answer: direct spoken-interview evidence plus scoring dimensions.

Repeated exam submissions update the question's signal instead of inflating evidence counts. Reopening a completed task removes its completion signal. Existing completed tasks, exam attempts, and mock feedback are lazily backfilled when a learning state is first requested.

Saved Interview Data now informs plans, study notes, exams, and mock interviews. The retrieval boundary includes only the current user's reports and the legacy shared library, ranks reports by role and company relevance, and labels the context as unverified. Generators may use recurring topic and round patterns, but must not copy reported questions verbatim or present a report as a confirmed company process.

## Readiness

The readiness formula is:

```text
25% plan + 15% learning + 25% role mastery + 20% exams + 10% mock interviews + 5% consistency
```

Role mastery is confidence-adjusted so one good answer cannot create false certainty. Critical competencies receive more weight in the overall score, while the next-action ranking balances role priority against demonstrated weakness.

APIs:

- `GET /workspace/readiness?prep_plan_id=...`
- `GET /workspace/learning-state?prep_plan_id=...`

## Feedback and operations

Users can mark generated notes, exam reviews, and mock reviews as helpful or needing work through `POST /feedback`. Feedback is scoped to the owning job and user.

The admin overview now reports:

- generation success and failure rate;
- quality pass rate and average quality score;
- average and p95 latency;
- helpful versus needs-work feedback;
- per-artifact quality summaries.

Failed generation attempts are traced after rolling back partial database work, so a provider error cannot leave an empty exam or mock session behind.

## Provider requirements

No additional API is required. OpenAI remains the generator/scorer/critic and Tavily remains the supporting research provider. The new quality, mastery, feedback, and monitoring layers are implemented in the application and PostgreSQL schema.
