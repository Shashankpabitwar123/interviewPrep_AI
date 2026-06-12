"""add job post user ownership

Revision ID: f7c91a2e4b20
Revises: e3a1f0c7b92d
Create Date: 2026-06-12 14:40:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "f7c91a2e4b20"
down_revision = "e3a1f0c7b92d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("job_posts", sa.Column("user_id", sa.Integer(), nullable=True))
    op.create_index(op.f("ix_job_posts_user_id"), "job_posts", ["user_id"], unique=False)
    op.create_foreign_key("fk_job_posts_user_id_users", "job_posts", "users", ["user_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_job_posts_user_id_users", "job_posts", type_="foreignkey")
    op.drop_index(op.f("ix_job_posts_user_id"), table_name="job_posts")
    op.drop_column("job_posts", "user_id")
