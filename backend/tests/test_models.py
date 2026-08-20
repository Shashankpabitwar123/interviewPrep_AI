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
    assert "role_blueprints" in Base.metadata.tables
    assert "research_snapshots" in Base.metadata.tables
    assert "generation_runs" in Base.metadata.tables


def test_generation_trace_foreign_keys_do_not_block_user_content_deletion() -> None:
    table = Base.metadata.tables["generation_runs"]
    ondelete_by_column = {
        foreign_key.parent.name: foreign_key.ondelete
        for foreign_key in table.foreign_keys
    }

    assert ondelete_by_column == {
        "user_id": "SET NULL",
        "job_post_id": "SET NULL",
        "prep_plan_id": "SET NULL",
    }
