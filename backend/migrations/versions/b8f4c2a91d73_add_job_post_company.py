"""add job post company

Revision ID: b8f4c2a91d73
Revises: f7c91a2e4b20
Create Date: 2026-06-17 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "b8f4c2a91d73"
down_revision = "f7c91a2e4b20"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_posts", sa.Column("company", sa.String(length=160), nullable=True))


def downgrade() -> None:
    op.drop_column("job_posts", "company")
