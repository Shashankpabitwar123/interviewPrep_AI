# Deployment And Database Plan

This is the practical path for turning InterviewPrep AI from a local project into a live website.

## Current State

- Backend: FastAPI with SQLAlchemy.
- Local database: SQLite at `backend/interviewprep.db`.
- AI providers: OpenAI, Gemini, and Tavily through environment variables.
- Frontend: React/Vite.
- Local-only state still exists in the browser for some UI features: notes, folders, recent activity, settings, calendar events, and local exam/mock attempt cards.

## Recommended Production Stack

- Frontend hosting: Vercel.
- Backend hosting: Render or Railway.
- Database: Supabase Postgres, Neon Postgres, Railway Postgres, or Render Postgres.
- Secrets: store API keys only in backend environment variables.

## Environment Variables

Backend:

```bash
APP_ENV=production
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/interviewprep
FRONTEND_ORIGINS=https://your-frontend-domain.vercel.app
AUTH_SECRET_KEY=generate_a_long_random_secret
ACCESS_TOKEN_EXPIRE_MINUTES=10080
REQUIRE_AUTH=true
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini
TAVILY_API_KEY=your_tavily_key
```

Frontend:

```bash
VITE_API_URL=https://your-backend-domain.onrender.com
```

## Database Work Still Needed For Full Multi-User Launch

The backend now issues signed bearer tokens and can require login in production with `REQUIRE_AUTH=true`. Jobs, prep plans, and exams are scoped through the logged-in user. Before a polished public launch, we should move every remaining browser-only feature into the backend:

- Add `user_id` ownership to mock interviews, notes, folders, calendar events, recent activity, settings, deleted jobs, and progress records.
- Add backend tables for note folders, personal notes, generated notes, calendar events, recent activity, deleted jobs bin, and user settings.
- Replace frontend `localStorage` writes with authenticated API calls.
- Add migrations for all schema changes.
- Add a login token/session flow so every API request belongs to the correct user.

## Launch Steps

1. Create a Postgres database.
2. Put the database URL in backend `DATABASE_URL`.
3. Deploy backend with `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
4. Deploy frontend with `VITE_API_URL` pointing to the backend.
5. Set backend `FRONTEND_ORIGINS` to the frontend domain.
6. Run smoke tests:
   - create account
   - save job
   - generate prep plan
   - generate note
   - generate exam
   - submit exam
   - start mock interview
   - check saved plan reload

## Next Coding Phase

The next best engineering step is not visual polish. It is a data migration phase:

1. Add user-owned database models for notes, folders, calendar, progress, settings, and deleted jobs.
2. Add API routes for those models.
3. Update the frontend to read/write those routes.
4. Keep localStorage only as a temporary offline cache, not as the source of truth.
