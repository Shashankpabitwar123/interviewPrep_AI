"""persist canonical job analysis brief

Revision ID: e3b7d2a5f946
Revises: c7e4a1d29f60
Create Date: 2026-08-17 12:45:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "e3b7d2a5f946"
down_revision = "c7e4a1d29f60"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("job_analyses")}
    if "structured_brief" not in columns:
        op.add_column("job_analyses", sa.Column("structured_brief", sa.JSON(), nullable=True))
    if "structured_brief_version" not in columns:
        op.add_column("job_analyses", sa.Column("structured_brief_version", sa.String(length=32), nullable=True))
    if "structured_brief_description_hash" not in columns:
        op.add_column("job_analyses", sa.Column("structured_brief_description_hash", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("job_analyses", "structured_brief_description_hash")
    op.drop_column("job_analyses", "structured_brief_version")
    op.drop_column("job_analyses", "structured_brief")
