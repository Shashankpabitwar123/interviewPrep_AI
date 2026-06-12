from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import create_db_and_tables
from app.routers import auth, exams, experiences, health, jobs, mock_interviews, prep_plans, study_notes


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    create_db_and_tables()
    yield


# main.py is the API entrypoint. Routers keep each feature area in its own file
# so the project stays easy to read as it grows.
app = FastAPI(
    title="InterviewPrep AI API",
    version="0.1.0",
    description="Time-aware interview preparation planning API.",
    lifespan=lifespan,
)

settings = get_settings()

# Local development can use "*"; production should set FRONTEND_ORIGINS to the
# deployed frontend domain so only the real website can call the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.frontend_origins,
    allow_credentials=settings.frontend_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(jobs.router)
app.include_router(prep_plans.router)
app.include_router(exams.router)
app.include_router(experiences.router)
app.include_router(mock_interviews.router)
app.include_router(study_notes.router)
