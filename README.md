# PrepInterview AI

[Live Product](https://prepinterviewai.com/) | [Synthetic Product Analytics](https://public.tableau.com/app/profile/shashank.pabitwar/viz/PrepInterview_AI_Product_Analytics_Scroll_Final/PrepInterviewAIScrollExperience)

PrepInterview AI is a deployed, full-stack interview-preparation platform that converts a job description into a structured preparation workspace. Users can organize target roles, generate personalized study plans, create notes and exams, practice mock interviews, schedule preparation work, and track progress from one authenticated application.

## Product Highlights

- Capture a job description or URL, infer the company and role, and save the opportunity to a personal workspace.
- Generate day-by-day preparation plans tailored to the job requirements and interview date.
- Create AI study notes, request deeper explanations, and retain follow-up Q&A for repeated review.
- Build configurable exams from a study day or complete plan, then review scores, answers, and feedback.
- Practice voice-enabled mock interviews with generated questions, read-aloud support, scoring, and review.
- Track preparation activity through dashboards, progress views, saved jobs, and calendar workflows.
- Register and recover accounts through email OTP flows, manage profile settings, and use guided onboarding.
- Save roles from other websites through the companion Chrome extension.
- Monitor application usage and provider health through a protected developer dashboard.

## Architecture

```text
React 19 + Vite 6 web app (Vercel)
              |
              | HTTPS / REST / JWT
              v
FastAPI + SQLAlchemy API (Render)
       |              |             |
       v              v             v
PostgreSQL/Neon   OpenAI + Tavily   Resend email

Chrome extension -> job capture -> authenticated API
```

The backend owns authentication, user-scoped persistence, job analysis, plan generation, study notes, exams, mock interviews, progress, calendar data, and administrative usage reporting. Alembic manages schema migrations, and the frontend communicates with the API through authenticated REST requests.

## Technology

- **Frontend:** React 19, Vite 6, JavaScript, CSS, responsive component-based UI
- **Backend:** Python, FastAPI, Pydantic, SQLAlchemy, Alembic, REST APIs
- **Data:** PostgreSQL on Neon with per-user application records
- **AI and research:** OpenAI APIs and Tavily search
- **Authentication and email:** JWT, registration/password-reset OTP workflows, Resend
- **Deployment:** Vercel frontend, Render API, Neon database
- **Quality:** pytest backend regression/API tests and production frontend builds
- **Companion client:** Chrome extension for saving job links and descriptions

## Repository Structure

```text
InterviewPrep AI/
  backend/             FastAPI API, models, services, migrations, and tests
  frontend/            React/Vite web application
  browser-extension/   Chrome extension for job capture
  docs/                architecture, deployment, and project handoff notes
  tools/               documentation support scripts
  RUN_LOCALLY.md       complete local setup guide
```

## Run Locally

Follow [RUN_LOCALLY.md](RUN_LOCALLY.md) for environment variables and complete setup instructions.

```bash
# Backend
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# Frontend (new terminal)
cd frontend
npm install
npm run dev
```

## Validate the Project

```bash
# Backend
cd backend
source .venv/bin/activate
pytest

# Frontend
cd frontend
npm run build
```

## Data Disclosure

The linked Tableau product-analytics experience is a separate portfolio analysis built from explicitly synthetic users and events. It demonstrates event modeling, funnels, cohorts, retention, learning outcomes, and AI-reliability metrics; it does not represent PrepInterview AI production traffic or customer outcomes.

## Documentation

- [Project memory and technical handoff](docs/project-memory.md)
- [Deployment and database plan](docs/deployment-and-database-plan.md)
- [Local development guide](RUN_LOCALLY.md)
