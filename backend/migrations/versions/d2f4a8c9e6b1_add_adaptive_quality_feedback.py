"""add adaptive competency evidence and artifact quality feedback

Revision ID: d2f4a8c9e6b1
Revises: a9e3c7f1d2b4
Create Date: 2026-08-20 21:45:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "d2f4a8c9e6b1"
down_revision = "a9e3c7f1d2b4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())

    _add_column_if_missing(inspector, "prep_plans", sa.Column("quality_report", sa.JSON(), nullable=True))
    _add_column_if_missing(inspector, "mock_interviews", sa.Column("quality_report", sa.JSON(), nullable=True))

    if "competency_evidence" not in table_names:
        op.create_table(
            "competency_evidence",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("job_post_id", sa.Integer(), nullable=False),
            sa.Column("prep_plan_id", sa.Integer(), nullable=True),
            sa.Column("competency_key", sa.String(length=180), nullable=False),
            sa.Column("competency_name", sa.String(length=200), nullable=False),
            sa.Column("source_type", sa.String(length=60), nullable=False),
            sa.Column("source_id", sa.String(length=180), nullable=False),
            sa.Column("score", sa.Float(), nullable=False),
            sa.Column("weight", sa.Float(), nullable=False),
            sa.Column("detail", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["job_post_id"], ["job_posts.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["prep_plan_id"], ["prep_plans.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("job_post_id", "source_type", "source_id", "competency_key", name="uq_competency_evidence_source"),
        )
        for column in ("user_id", "job_post_id", "prep_plan_id", "competency_key", "source_type"):
            op.create_index(f"ix_competency_evidence_{column}", "competency_evidence", [column], unique=False)

    if "artifact_feedback" not in table_names:
        op.create_table(
            "artifact_feedback",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("job_post_id", sa.Integer(), nullable=False),
            sa.Column("prep_plan_id", sa.Integer(), nullable=True),
            sa.Column("artifact_type", sa.String(length=60), nullable=False),
            sa.Column("artifact_id", sa.String(length=180), nullable=False),
            sa.Column("rating", sa.String(length=40), nullable=False),
            sa.Column("reason", sa.Text(), nullable=True),
            sa.Column("detail", sa.JSON(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["job_post_id"], ["job_posts.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["prep_plan_id"], ["prep_plans.id"], ondelete="SET NULL"),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
            sa.PrimaryKeyConstraint("id"),
        )
        for column in ("user_id", "job_post_id", "prep_plan_id", "artifact_type", "artifact_id", "rating"):
            op.create_index(f"ix_artifact_feedback_{column}", "artifact_feedback", [column], unique=False)


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    table_names = set(inspector.get_table_names())
    if "artifact_feedback" in table_names:
        op.drop_table("artifact_feedback")
    if "competency_evidence" in table_names:
        op.drop_table("competency_evidence")
    for table_name, column_name in (
        ("mock_interviews", "quality_report"),
        ("prep_plans", "quality_report"),
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
