# Live Deploy Checklist

Use this checklist when deploying InterviewPrep AI.

## 1. Neon PostgreSQL

Create a Neon project and copy the production connection string.

Before using it in the backend, change the prefix:

```text
postgresql://...
```

to:

```text
postgresql+psycopg://...
```

Store it as `DATABASE_URL`.

## 2. Render Backend

Create a Render Web Service from the GitHub repo.

Use:

```text
Repository: Shashankpabitwar123/interviewPrep_AI
Blueprint file: render.yaml
```

Required environment variables:

```text
DATABASE_URL=postgresql+psycopg://...
FRONTEND_ORIGINS=https://your-vercel-domain.vercel.app
AUTH_SECRET_KEY=long-random-secret
OPENAI_API_KEY=your-openai-key
TAVILY_API_KEY=your-tavily-key
REQUIRE_AUTH=true
APP_ENV=production
OPENAI_MODEL=gpt-4o-mini
ACCESS_TOKEN_EXPIRE_MINUTES=10080
```

Render start command:

```bash
alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

## 3. Vercel Frontend

Create a Vercel project from the same GitHub repo.

Use:

```text
Root Directory: frontend
Framework: Vite
Build Command: npm run build
Output Directory: dist
```

Required environment variable:

```text
VITE_API_URL=https://your-render-api-domain.onrender.com
```

## 4. Final Smoke Test

After backend and frontend are live:

1. Open the Vercel URL.
2. Create a new account.
3. Save a job.
4. Generate a prep plan.
5. Generate notes.
6. Generate an exam.
7. Submit the exam.
8. Start a mock interview.
9. Refresh the page and confirm the account session remains active.

## 5. Security Reminder

After setup, rotate the Neon database password because the first password was shown during setup.
