"""add email otps

Revision ID: a4d8b9f3c2e1
Revises: b8f4c2a91d73
Create Date: 2026-06-17 15:10:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "a4d8b9f3c2e1"
down_revision = "b8f4c2a91d73"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_verification_otps",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("purpose", sa.String(length=40), nullable=False, server_default="register"),
        sa.Column("code_hash", sa.String(length=128), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_email_verification_otps_email"), "email_verification_otps", ["email"], unique=False)
    op.create_index(op.f("ix_email_verification_otps_expires_at"), "email_verification_otps", ["expires_at"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_email_verification_otps_expires_at"), table_name="email_verification_otps")
    op.drop_index(op.f("ix_email_verification_otps_email"), table_name="email_verification_otps")
    op.drop_table("email_verification_otps")
