from email.message import EmailMessage
import smtplib

import httpx

from app.config import Settings


RESEND_EMAILS_URL = "https://api.resend.com/emails"


def email_configured(settings: Settings) -> bool:
    if settings.email_provider == "resend":
        return resend_configured(settings)
    return smtp_configured(settings)


def resend_configured(settings: Settings) -> bool:
    return bool(settings.resend_api_key and settings.email_from)


def smtp_configured(settings: Settings) -> bool:
    return bool(settings.smtp_username and settings.smtp_password and settings.smtp_from_email)


def send_registration_otp(email: str, code: str, settings: Settings) -> None:
    """Send a registration OTP through the configured email provider."""

    if settings.email_provider == "resend":
        send_otp_with_resend(
            email,
            code,
            settings,
            subject="Your InterviewPrep AI verification code",
            heading="Verify your InterviewPrep AI account",
            intro="Use this verification code to finish creating your account:",
            text_intro="Welcome to InterviewPrep AI.",
        )
        return

    send_otp_with_smtp(
        email,
        code,
        settings,
        subject="Your InterviewPrep AI verification code",
        text_intro="Welcome to InterviewPrep AI.",
    )


def send_password_reset_otp(email: str, code: str, settings: Settings) -> None:
    """Send a password-reset OTP through the configured email provider."""

    if settings.email_provider == "resend":
        send_otp_with_resend(
            email,
            code,
            settings,
            subject="Reset your PrepInterview AI password",
            heading="Reset your PrepInterview AI password",
            intro="Use this verification code to choose a new password:",
            text_intro="You requested a PrepInterview AI password reset.",
        )
        return

    send_otp_with_smtp(
        email,
        code,
        settings,
        subject="Reset your PrepInterview AI password",
        text_intro="You requested a PrepInterview AI password reset.",
    )


def send_otp_with_resend(
    email: str,
    code: str,
    settings: Settings,
    *,
    subject: str,
    heading: str,
    intro: str,
    text_intro: str,
) -> None:
    """Send an OTP through Resend."""

    if not resend_configured(settings):
        raise RuntimeError("Resend email is not configured.")

    body_text = _otp_text_body(code, settings, text_intro)
    response = httpx.post(
        RESEND_EMAILS_URL,
        headers={
            "Authorization": f"Bearer {settings.resend_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "from": settings.email_from,
            "to": [email],
            "subject": subject,
            "text": body_text,
            "html": _otp_html_body(code, settings, heading, intro),
        },
        timeout=12,
    )
    response.raise_for_status()


def send_otp_with_smtp(email: str, code: str, settings: Settings, *, subject: str, text_intro: str) -> None:
    """Send an OTP through Gmail-compatible SMTP."""

    if not smtp_configured(settings):
        raise RuntimeError("SMTP email is not configured.")

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.smtp_from_email
    message["To"] = email
    message.set_content(_otp_text_body(code, settings, text_intro))

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=12) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)


def _otp_text_body(code: str, settings: Settings, intro: str) -> str:
    return "\n".join(
        [
            intro,
            "",
            f"Your verification code is: {code}",
            "",
            f"This code expires in {settings.email_otp_expire_minutes} minutes.",
            "If you did not request this code, you can ignore this email.",
        ]
    )


def _otp_html_body(code: str, settings: Settings, heading: str, intro: str) -> str:
    return f"""
    <div style="font-family: Inter, Arial, sans-serif; max-width: 520px; padding: 24px; color: #111827;">
      <h1 style="font-size: 22px; margin: 0 0 12px;">{heading}</h1>
      <p style="font-size: 15px; line-height: 1.5;">{intro}</p>
      <div style="font-size: 32px; font-weight: 800; letter-spacing: 8px; padding: 18px 20px; background: #eff6ff; border-radius: 12px; color: #2563eb; text-align: center;">
        {code}
      </div>
      <p style="font-size: 13px; line-height: 1.5; color: #4b5563;">This code expires in {settings.email_otp_expire_minutes} minutes.</p>
      <p style="font-size: 13px; line-height: 1.5; color: #6b7280;">If you did not request this code, you can ignore this email.</p>
    </div>
    """
