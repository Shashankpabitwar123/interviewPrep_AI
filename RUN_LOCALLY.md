# Run InterviewPrep AI Locally

This guide explains how to run the backend and frontend from VS Code after the folder cleanup.

## 1. Open The Project

Open this folder in VS Code:

```text
/Users/shashankpabitwar/Downloads/InterviewPrep AI
```

You should see:

```text
backend/
frontend/
browser-extension/
docs/
tools/
```

## 2. Run The Backend

Open a VS Code terminal:

```bash
cd "/Users/shashankpabitwar/Downloads/InterviewPrep AI/backend"
source .venv/bin/activate
pip install -e ".[dev]"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

If you need to recreate the virtual environment:

```bash
cd "/Users/shashankpabitwar/Downloads/InterviewPrep AI/backend"
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -e ".[dev]"
```

Optional AI keys:

```bash
export OPENAI_API_KEY="your_openai_key_here"
export TAVILY_API_KEY="your_tavily_key_here"
export OPENAI_MODEL="gpt-4o-mini"
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Backend URLs:

```text
API: http://127.0.0.1:8000
API docs: http://127.0.0.1:8000/docs
Health check: http://127.0.0.1:8000/health
```

Keep this terminal open while using the app.

## 3. Run The Frontend

Open a second VS Code terminal:

```bash
cd "/Users/shashankpabitwar/Downloads/InterviewPrep AI/frontend"
npm install
npm run dev
```

Frontend URL:

```text
http://127.0.0.1:5173
```

## 4. Run Tests

```bash
cd "/Users/shashankpabitwar/Downloads/InterviewPrep AI/backend"
source .venv/bin/activate
pytest
```

Expected result:

```text
20 passed
```

## 5. Build Frontend

```bash
cd "/Users/shashankpabitwar/Downloads/InterviewPrep AI/frontend"
npm run build
```

## 6. Chrome Extension

The extension is here:

```text
/Users/shashankpabitwar/Downloads/InterviewPrep AI/browser-extension
```

To install locally:

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on Developer mode.
4. Click Load unpacked.
5. Select the `browser-extension` folder.
6. Keep the backend running at `http://127.0.0.1:8000`.

## 7. Database

Local development uses SQLite:

```text
backend/interviewprep.db
```

Production should use PostgreSQL:

```bash
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/interviewprep
```

Deployment details are in:

```text
docs/deployment-and-database-plan.md
```
