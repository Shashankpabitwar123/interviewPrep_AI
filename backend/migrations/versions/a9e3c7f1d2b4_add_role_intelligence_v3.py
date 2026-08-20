"""add persisted role intelligence and generation quality metadata

Revision ID: a9e3c7f1d2b4
Revises: f4c8d2a7b1e9
Create Date: 2026-08-20 19:10:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "a9e3c7f1d2b4"
down_revision = "f4c8d2a7b1e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    _add_column_if_missing(inspector, "job_posts", sa.Column("capture_metadata", sa.JSON(), nullable=True))
    _add_column_if_missing(inspector, "prep_plans", sa.Column("role_blueprint_version", sa.String(length=32), nullable=True))
    _add_column_if_missing(inspector, "exams", sa.Column("generation_blueprint", sa.JSON(), nullable=True))
    _add_column_if_missing(inspector, "exams", sa.Column("quality_report", sa.JSON(), nullable=True))
    _add_column_if_missing(inspector, "questions", sa.Column("question_metadata", sa.JSON(), nullable=True))
    _add_column_if_missing(inspector, "mock_interviews", sa.Column("session_plan", sa.JSON(), nullable=True))
    _add_column_if_missing(inspector, "mock_interviews", sa.Column("overall_feedback", sa.JSON(), nullable=True))
    _add_column_if_missing(inspector, "mock_messages", sa.Column("detail", sa.JSON(), nullable=True))

    if "research_snapshots" not in table_names:
        op.create_table(
            "research_snapshots",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("job_post_id", sa.Integer(), nullable=False),
            sa.Column("description_hash", sa.String(length=64), nullable=False),
            sa.Column("research_version", sa.String(length=32), nullable=False),
            sa.Column("provider", sa.String(length=40), nullable=False),
            sa.Column("status", sa.String(length=40), nullable=False),
            sa.Column("sources", sa.JSON(), nullable=False),
            sa.Column("query_log", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["job_post_id"], ["job_posts.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_research_snapshots_job_post_id", "research_snapshots", ["job_post_id"], unique=False)
        op.create_index("ix_research_snapshots_description_hash", "research_snapshots", ["description_hash"], unique=False)

    if "role_blueprints" not in table_names:
        op.create_table(
            "role_blueprints",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("job_post_id", sa.Integer(), nullable=False),
            sa.Column("version", sa.String(length=32), nullable=False),
            sa.Column("description_hash", sa.String(length=64), nullable=False),
            sa.Column("blueprint", sa.JSON(), nullable=False),
            sa.Column("research_snapshot_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["job_post_id"], ["job_posts.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["research_snapshot_id"], ["research_snapshots.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_role_blueprints_job_post_id", "role_blueprints", ["job_post_id"], unique=True)
        op.create_index("ix_role_blueprints_description_hash", "role_blueprints", ["description_hash"], unique=False)

    if "generation_runs" not in table_names:
        op.create_table(
            "generation_runs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("job_post_id", sa.Integer(), nullable=True),
            sa.Column("prep_plan_id", sa.Integer(), nullable=True),
            sa.Column("artifact_type", sa.String(length=80), nullable=False),
            sa.Column("provider", sa.String(length=40), nullable=False),
            sa.Column("model", sa.String(length=120), nullable=True),
            sa.Column("prompt_version", sa.String(length=40), nullable=False),
            sa.Column("context_hash", sa.String(length=64), nullable=True),
            sa.Column("status", sa.String(length=40), nullable=False),
            sa.Column("latency_ms", sa.Integer(), nullable=True),
            sa.Column("input_tokens", sa.Integer(), nullable=False),
            sa.Column("output_tokens", sa.Integer(), nullable=False),
            sa.Column("quality", sa.JSON(), nullable=True),
            sa.Column("detail", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["job_post_id"], ["job_posts.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["prep_plan_id"], ["prep_plans.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        for column in ("user_id", "job_post_id", "prep_plan_id", "artifact_type", "context_hash"):
            op.create_index(f"ix_generation_runs_{column}", "generation_runs", [column], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "generation_runs" in table_names:
        op.drop_table("generation_runs")
    if "role_blueprints" in table_names:
        op.drop_table("role_blueprints")
    if "research_snapshots" in table_names:
        op.drop_table("research_snapshots")
    for table_name, column_name in (
        ("mock_messages", "detail"),
        ("mock_interviews", "overall_feedback"),
        ("mock_interviews", "session_plan"),
        ("questions", "question_metadata"),
        ("exams", "quality_report"),
        ("exams", "generation_blueprint"),
        ("prep_plans", "role_blueprint_version"),
        ("job_posts", "capture_metadata"),
    ):
        inspector = sa.inspect(bind)
        if table_name in inspector.get_table_names() and column_name in {
            column["name"] for column in inspector.get_columns(table_name)
        }:
            op.drop_column(table_name, column_name)


def _add_column_if_missing(inspector: sa.Inspector, table_name: str, column: sa.Column) -> None:
    if table_name not in inspector.get_table_names():
        return
    if column.name not in {value["name"] for value in inspector.get_columns(table_name)}:
        op.add_column(table_name, column)
