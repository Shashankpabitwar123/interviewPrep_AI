# Guided Preparation Integration Plan

## Goal

Move the approved Guided Preparation prototype into the production React/FastAPI application without losing any existing capability or creating parallel, disconnected feature systems.

## Product navigation

- **Today**: selected job, interview countdown, next recommended action, this week's work, recent activity, and a small readiness summary.
- **Jobs**: add, analyze, save, select, review, archive, restore, and generate a plan for a job.
- **Learn**: two connected modes: Plan and Notes.
- **Practice**: Exams, Mock Interviews, and Interview Insights/question history.
- **Readiness**: the combined Progress and Analytics experience.
- **Schedule**: the calendar, available from Today and the top utility area.
- **Profile menu**: account, appearance, sound, local fallback, extension, deleted jobs, onboarding, About, Admin, and logout.

## Data and API approach

The existing domain APIs remain the source of truth for authentication, jobs, plans, generated exams, exam scoring, mock interviews, AI notes, job analysis, OpenAI usage, Tavily research, Resend OTP, and administration.

A new authenticated workspace API persists the client workspace state that was previously local-only: generated-note metadata, personal notes, note folders, activity, calendar events, and attempt presentation metadata. Local storage remains an offline cache, not the only copy.

Task completion becomes server-backed through a task-status endpoint. A readiness endpoint calculates results from the user's owned plan plus the synchronized workspace evidence.

## Readiness formula

Readiness is always based on real user activity for the selected prep plan:

- Plan completion: **30%**
- Learning completion: **20%**
- Exam performance: **25%**
- Mock interview performance: **20%**
- Consistency over the last seven days: **5%**

Each component is scored from 0 to 100. Missing evidence scores zero rather than receiving synthetic credit. The API returns the formula, component scores, strengths, areas needing work, and the next recommended action so every frontend surface uses the same calculation.

## Difficulty behavior

### Exams

- Easy: 10 questions, 5 minutes; definitions, recognition, light application, and common mistakes.
- Medium: 20 questions, 10 minutes; applied reasoning, tradeoffs, edge cases, and interview explanations.
- Hard: 40 questions, 30 minutes; debugging, ambiguity, design decisions, optimization, and deep reasoning.
- Users may customize question count, time, topics, and question types for an individual exam.
- Unanswered questions always receive zero and remain in the denominator.

### Mock interviews

- Easy: 4 questions with longer answer time and supportive prompts.
- Medium: 6 questions with realistic technical, behavioral, and situational depth.
- Hard: 8 questions with tighter time, follow-up pressure, ambiguity, tradeoffs, and senior-level reasoning.
- Partial attempts are scored only for answered questions but are marked incomplete when exited early.

## Provider behavior

- OpenAI remains the primary generation/scoring provider.
- Tavily enriches research-backed notes but never prevents a note from being generated when OpenAI succeeds.
- Local fallback stays off unless the user explicitly enables it.
- Resend remains the production OTP provider with expiry, cooldown, and hourly limits.
- Provider secrets remain server-side environment variables and are never sent to the browser.

## Verification gates

- Alembic migration upgrades cleanly.
- Backend tests cover ownership, task status, workspace synchronization, readiness math, and unanswered exam scoring.
- Existing auth, job, plan, notes, exam, mock, admin, and extension contracts remain compatible.
- Frontend production build passes.
- Desktop and mobile flows work for add job, generate plan, learn, practice, readiness, schedule, settings, and logout.
- No deployment or push occurs until the local result is approved.
