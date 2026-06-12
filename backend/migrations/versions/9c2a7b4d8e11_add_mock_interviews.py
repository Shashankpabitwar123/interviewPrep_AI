"""add mock interviews

Revision ID: 9c2a7b4d8e11
Revises: 61d6b0585547
Create Date: 2026-06-05 14:40:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "9c2a7b4d8e11"
down_revision = "61d6b0585547"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "mock_interviews",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("prep_plan_id", sa.Integer(), nullable=False),
        sa.Column("current_topic", sa.String(length=160), nullable=False),
        sa.Column("status", sa.String(length=40), nullable=False),
        sa.Column("average_score", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["prep_plan_id"], ["prep_plans.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "mock_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("mock_interview_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=40), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["mock_interview_id"], ["mock_interviews.id"]),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("mock_messages")
    op.drop_table("mock_interviews")

