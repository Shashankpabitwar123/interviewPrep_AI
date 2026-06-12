# Day 2 Project Log

## Goal

Add the first AI-ready layer: a job analysis service that can use OpenAI when an API key is available, while still working locally through a heuristic fallback.

## What Was Added

- `backend/app/config.py`: environment settings for app mode, OpenAI API key, and model name.
- `backend/.env.example`: local configuration template.
- `backend/app/schemas/job_analysis.py`: structured request and response models for job analysis.
- `backend/app/services/job_analyzer.py`: OpenAI-backed analyzer with local fallback logic.
- `backend/app/routers/jobs.py`: `POST /jobs/analyze` endpoint.
- `backend/tests/test_job_analyzer.py`: test coverage for job analysis fallback.

## Why This Matters

The app should not just call an AI model randomly. It needs a structured pipeline:

1. Analyze the job.
2. Extract skills, seniority, interview focus, coding difficulty, and behavioral themes.
3. Use that structured output to generate exams, mock interviews, and revision plans.

Day 2 creates that pipeline shape.

## Input Needed From User

Eventually we need an OpenAI API key to test the real AI path. The app currently works without one through the fallback analyzer.

