from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models import JobPost


def test_database_models_create_tables_and_insert_job() -> None:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)

    with Session() as session:
        job = JobPost(title="Backend Intern", description="Python APIs and SQL")
        session.add(job)
        session.commit()

        stored = session.query(JobPost).one()

    assert stored.title == "Backend Intern"
    assert "job_posts" in Base.metadata.tables
    assert "prep_plans" in Base.metadata.tables
    assert "interview_experiences" in Base.metadata.tables

