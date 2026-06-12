# InterviewPrep AI - Tomorrow Handoff

Use this document tomorrow to remind Codex what we built today.

## Project Location

```text
/Users/shashankpabitwar/Downloads/InterviewPrep AI
```

Main folders:

- `backend`: FastAPI backend.
- `frontend`: React/Vite dashboard.
- `browser-extension`: Chrome extension for saving job pages.
- `docs`: documentation and project logs.
- `tools`: scripts used to generate DOCX files.

## What We Built Today

### Backend

Built a FastAPI backend with:

- `GET /health`
- `POST /auth/register`
- `POST /auth/login`
- `POST /jobs/analyze`
- `GET /jobs`
- `GET /jobs/{job_post_id}`
- `POST /prep-plans`
- `GET /prep-plans`
- `GET /prep-plans/{prep_plan_id}`
- `POST /exams/generate`
- `GET /exams/{exam_id}`
- `POST /exams/{exam_id}/submit`
- `POST /mock-interviews/start`
- `GET /mock-interviews/{mock_interview_id}`
- `POST /mock-interviews/{mock_interview_id}/answer`
- `POST /interview-experiences`
- `GET /interview-experiences`
- `GET /interview-experiences/{experience_id}`

### AI/Job Analysis

Added an OpenAI-ready job analyzer:

- Uses OpenAI if an API key is available.
- Falls back to a local heuristic analyzer if no API key is set.
- Extracts seniority, required skills, interview focus, coding difficulty, and behavioral themes.

### Job URL Reading

Added support for users to paste a job posting URL instead of the full job description:

- `source_url` can be passed to job analysis or prep plan endpoints.
- Backend fetches readable page text using `httpx` and `BeautifulSoup`.
- For login-only sites like LinkedIn or Handshake, the Chrome extension is the better path.

### Database

Added SQLAlchemy models and Alembic migrations.

Local development database:

```text
backend/interviewprep.db
```

Tables:

- `users`
- `job_posts`
- `job_analyses`
- `prep_plans`
- `prep_tasks`
- `exams`
- `questions`
- `answer_attempts`
- `mock_interviews`
- `mock_messages`
- `interview_experiences`

The local DB is SQLite for now. Later we can switch to PostgreSQL.

### Login And Accounts

Added the first real account system:

- Users can create an account with name, email, and password.
- Users can log in with email and password.
- Passwords are stored as salted PBKDF2 hashes, not plain text.
- Duplicate emails are rejected.
- The frontend saves the logged-in user in browser `localStorage` so refreshes keep the user signed in locally.
- The app still needs true per-user ownership for jobs, prep plans, exams, and progress.

### Prep Plan Generator

Built a deterministic prep-plan generator that:

- Takes job title, job description or URL, interview date, and hours per day.
- Detects skills from the job description.
- Creates a day-by-day plan.
- Includes diagnostic, study, technical exam, coding practice, mock interview, and revision tasks.
- Saves plans and tasks to the database.

### Exam System

Added exam generation and scoring:

- Generate an exam from a saved prep plan.
- Save generated questions.
- Submit answers.
- Get scores and simple feedback.

### Mock Interview System

Added mock interview sessions:

- Start a mock interview from a saved prep plan.
- Get an interviewer question.
- Submit an answer.
- Receive score, feedback, and a follow-up question.
- Save mock interview messages in the database.

### Interview Experience Storage

Added endpoints to save real interview experiences:

- company
- role
- round name
- topics
- questions
- difficulty
- notes

This will later help generate company/role-specific interview prep.

### Chrome Extension

Added a Chrome extension folder:

```text
browser-extension/
```

The extension:

- Reads the current browser tab title.
- Reads the current browser tab URL.
- Reads visible page text.
- Sends that data to `POST /jobs/analyze`.

This is useful for LinkedIn, Handshake, and other logged-in job pages.

### Frontend

Built a React/Vite dashboard and then refined it to look more professional like the user’s third reference image.

Frontend includes:

- refined sidebar
- top header
- backend status indicator
- guest mode by default
- login and create-account buttons in the top-right
- login/create-account modal
- logout button after signing in
- create prep plan form
- paste description mode
- job URL mode
- company field
- saved jobs panel
- prep plan stepper
- prep plan day cards
- upcoming tasks table
- recent activity panel
- buttons for generating an exam and starting a mock interview

Frontend location:

```text
frontend/
```

## How To Run Tomorrow

### Backend

Open terminal:

```bash
cd "/Users/shashankpabitwar/Downloads/InterviewPrep AI/backend"
source .venv/bin/activate
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend docs:

```text
http://127.0.0.1:8000/docs
```

If port 8000 is busy:

```bash
lsof -i :8000 -n -P
kill <PID>
```

### Frontend

Open second terminal:

```bash
cd "/Users/shashankpabitwar/Downloads/InterviewPrep AI/frontend"
npm run dev
```

Frontend:

```text
http://127.0.0.1:5173
```

If old UI appears, hard refresh:

```text
Cmd + Shift + R
```

## Verification Done Today

Backend tests passed:

```text
15 passed
```

Frontend build passed:

```bash
npm run build
```

The DOCX project log was rendered and visually checked.

## What Still Remains

Main remaining work:

1. Real OpenAI API integration for better job analysis, question generation, feedback, and mock interview follow-ups.
2. More complete frontend screens:
   - saved job detail
   - prep plan detail
   - exam-taking screen
   - mock interview chat screen
   - interview experience form
3. PostgreSQL setup for production.
4. Connect every saved job, prep plan, exam, and mock interview to the logged-in user.
5. Add stronger authentication for production, such as JWT access tokens or secure server sessions.
6. Chrome extension testing on LinkedIn and Handshake.
7. Deployment for backend, frontend, and database.
8. Demo video and resume-ready README.

## Suggested Next Step Tomorrow

Improve the frontend around:

- saved job detail view
- full exam-taking UI
- mock interview chat UI

After that, connect real OpenAI generation if the user provides an API key.
