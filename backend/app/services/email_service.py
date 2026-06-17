from email.message import EmailMessage
import smtplib

from app.config import Settings


def smtp_configured(settings: Settings) -> bool:
    return bool(settings.smtp_username and settings.smtp_password and settings.smtp_from_email)


def send_registration_otp(email: str, code: str, settings: Settings) -> None:
    """Send a registration OTP through Gmail-compatible SMTP."""

    if not smtp_configured(settings):
        raise RuntimeError("SMTP email is not configured.")

    message = EmailMessage()
    message["Subject"] = "Your InterviewPrep AI verification code"
    message["From"] = settings.smtp_from_email
    message["To"] = email
    message.set_content(
        "\n".join(
            [
                "Welcome to InterviewPrep AI.",
                "",
                f"Your verification code is: {code}",
                "",
                f"This code expires in {settings.email_otp_expire_minutes} minutes.",
                "If you did not request this code, you can ignore this email.",
            ]
        )
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=12) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_username, settings.smtp_password)
        smtp.send_message(message)
