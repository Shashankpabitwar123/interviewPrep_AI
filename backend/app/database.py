from collections.abc import Generator

from sqlalchemy import inspect, text
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    """Base class used by every SQLAlchemy model."""

    pass


def _connect_args(database_url: str) -> dict[str, bool]:
    # SQLite needs this for FastAPI-style request handling. PostgreSQL does not.
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


settings = get_settings()
engine = create_engine(settings.database_url, connect_args=_connect_args(settings.database_url))
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def create_db_and_tables() -> None:
    """Create tables for local development.

    In production we will rely on Alembic migrations, but this makes the MVP
    easy to run while we are still building quickly.
    """

    # Import models here so SQLAlchemy knows every table before create_all runs.
    from app import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _apply_lightweight_migrations()


def _apply_lightweight_migrations() -> None:
    """Keep existing local SQLite files usable while the schema changes quickly."""

    inspector = inspect(engine)
    table_names = inspector.get_table_names()
    if "users" in table_names:
        _add_missing_columns("users", {
            "role": "VARCHAR(40) DEFAULT 'user'",
            "status": "VARCHAR(40) DEFAULT 'active'",
            "blocked_at": "TIMESTAMP",
            "block_reason": "TEXT",
            "last_login_at": "TIMESTAMP",
            "last_seen_at": "TIMESTAMP",
        })
        with engine.begin() as connection:
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_users_status ON users (status)"))

    if "job_posts" not in table_names:
        return

    columns = {column["name"] for column in inspector.get_columns("job_posts")}
    if "user_id" not in columns and settings.database_url.startswith("sqlite"):
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE job_posts ADD COLUMN user_id INTEGER"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_job_posts_user_id ON job_posts (user_id)"))
    if "company" not in columns:
        with engine.begin() as connection:
            connection.execute(text("ALTER TABLE job_posts ADD COLUMN company VARCHAR(160)"))


def _add_missing_columns(table_name: str, column_sql: dict[str, str]) -> None:
    inspector = inspect(engine)
    existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
    missing_columns = [(name, sql) for name, sql in column_sql.items() if name not in existing_columns]
    if not missing_columns:
        return
    with engine.begin() as connection:
        for column_name, sql_type in missing_columns:
            connection.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {sql_type}"))


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that gives one database session per request."""

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
