"""persist exam coverage scope

Revision ID: f4c8d2a7b1e9
Revises: e3b7d2a5f946
Create Date: 2026-08-17 14:30:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "f4c8d2a7b1e9"
down_revision = "e3b7d2a5f946"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "scope" not in {column["name"] for column in inspector.get_columns("exams")}:
        op.add_column(
            "exams",
            sa.Column("scope", sa.String(length=40), nullable=False, server_default="selected_day"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "scope" in {column["name"] for column in inspector.get_columns("exams")}:
        op.drop_column("exams", "scope")
