"""add guided workspace persistence

Revision ID: c7e4a1d29f60
Revises: a4d8b9f3c2e1
Create Date: 2026-08-15 00:05:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "c7e4a1d29f60"
down_revision = "a4d8b9f3c2e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "hours_per_day" not in {column["name"] for column in inspector.get_columns("job_posts")}:
        op.add_column("job_posts", sa.Column("hours_per_day", sa.Float(), nullable=True))

    if "user_id" not in {column["name"] for column in inspector.get_columns("interview_experiences")}:
        op.add_column("interview_experiences", sa.Column("user_id", sa.Integer(), nullable=True))
    inspector = sa.inspect(bind)
    if "ix_interview_experiences_user_id" not in {index["name"] for index in inspector.get_indexes("interview_experiences")}:
        op.create_index(op.f("ix_interview_experiences_user_id"), "interview_experiences", ["user_id"], unique=False)
    if "fk_interview_experiences_user_id_users" not in {foreign_key.get("name") for foreign_key in inspector.get_foreign_keys("interview_experiences")}:
        with op.batch_alter_table("interview_experiences") as batch_op:
            batch_op.create_foreign_key(
                "fk_interview_experiences_user_id_users",
                "users",
                ["user_id"],
                ["id"],
            )

    inspector = sa.inspect(bind)
    if "workspace_states" not in inspector.get_table_names():
        op.create_table(
            "workspace_states",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=True),
            sa.Column("data", sa.JSON(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    inspector = sa.inspect(bind)
    if "ix_workspace_states_user_id" not in {index["name"] for index in inspector.get_indexes("workspace_states")}:
        op.create_index(op.f("ix_workspace_states_user_id"), "workspace_states", ["user_id"], unique=True)


def downgrade() -> None:
    op.drop_index(op.f("ix_workspace_states_user_id"), table_name="workspace_states")
    op.drop_table("workspace_states")
    op.drop_constraint("fk_interview_experiences_user_id_users", "interview_experiences", type_="foreignkey")
    op.drop_index(op.f("ix_interview_experiences_user_id"), table_name="interview_experiences")
    op.drop_column("interview_experiences", "user_id")
    op.drop_column("job_posts", "hours_per_day")
