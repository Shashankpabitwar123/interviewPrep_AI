# InterviewPrep AI

InterviewPrep AI is a Python/AI interview preparation platform. A user can paste a job description or job URL, set the interview date, and generate a role-specific prep plan with study notes, exams, mock interviews, review feedback, progress tracking, calendar support, and saved jobs.

## Clean Folder Structure

```text
InterviewPrep AI/
  backend/             FastAPI API, SQLAlchemy models, AI services, tests
  frontend/            React/Vite web app
  browser-extension/   Chrome extension for saving job URLs
  docs/                project logs, handoff docs, deployment notes
  tools/               scripts used to generate documentation
  RUN_LOCALLY.md       local setup commands
```

## Backend Reading Order

1. `backend/app/main.py`: FastAPI app entrypoint.
2. `backend/app/config.py`: environment variables and provider settings.
3. `backend/app/database.py`: SQLAlchemy database setup.
4. `backend/app/routers`: API endpoints grouped by feature.
5. `backend/app/services/job_analyzer.py`: job description analysis and title detection.
6. `backend/app/services/planner.py`: day-by-day prep plan generation.
7. `backend/app/services/study_note_service.py`: AI notes, deeper explanations, and note Q&A.
8. `backend/app/services/exam_service.py`: exam generation, scoring, and review.
9. `backend/app/services/mock_interview_service.py`: mock interview questions and feedback.
10. `backend/app/models`: database tables.
11. `backend/tests`: regression and API tests.

## Current Features

- Save jobs manually or from job URLs.
- Auto-detect job title and company when possible.
- Generate AI prep plans from pasted job descriptions.
- Generate study notes from each day’s topics.
- Ask questions about notes and get interview-focused answers.
- Generate exams from a day’s notes or from the full prep plan.
- Choose easy, medium, or hard exam presets, with advanced question settings.
- Submit exams and review score/feedback.
- Run voice-style mock interviews with scoring and review.
- Track progress, recent activity, calendar events, and saved prep plans.
- Restore recently deleted jobs from the settings bin.

## Local Development

Use [RUN_LOCALLY.md](/Users/shashankpabitwar/Downloads/InterviewPrep%20AI/RUN_LOCALLY.md).

## Project Memory

Use [docs/project-memory.md](/Users/shashankpabitwar/Downloads/InterviewPrep%20AI/docs/project-memory.md) as the main handoff for future Codex chats, product context, live service URLs, feature expectations, and deployment notes.

## Deployment Notes

Use [docs/deployment-and-database-plan.md](/Users/shashankpabitwar/Downloads/InterviewPrep%20AI/docs/deployment-and-database-plan.md) for the live website plan.

Recommended production stack:

- Frontend: Vercel.
- Backend: Render or Railway.
- Database: Supabase Postgres, Neon Postgres, Railway Postgres, or Render Postgres.

The next major backend phase is moving all remaining browser-only data into authenticated database tables.
