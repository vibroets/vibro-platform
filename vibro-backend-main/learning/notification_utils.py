from django.utils import timezone
from django.conf import settings
from django.core.mail import send_mail
from .models import NotificationTemplate, NotificationLog


def render_template(template_text, context):
    """Replace {{placeholder}} tokens with actual values from context dict."""
    if not template_text:
        return ""
    rendered = template_text
    for key, val in context.items():
        rendered = rendered.replace(f"{{{{{key}}}}}", str(val))
    return rendered


def send_email_notification(user, title, message):
    """Send an email notification to a user if they have an email address."""
    if not user.email:
        return
    try:
        send_mail(
            subject=f"VIBRO L&T: {title}",
            message=message or title,
            from_email=settings.EMAIL_FROM_ADDRESS,
            recipient_list=[user.email],
            fail_silently=True,
        )
    except Exception:
        pass


def dispatch_notification(notif_type, users, organization, context=None, content_type=None, content_id=None, content_title=None):
    """
    Check if a NotificationTemplate rule exists for the given notif_type and is enabled.
    If so, create NotificationLog entries for each user with the rendered message.
    Also sends email if the 'email' channel is configured in the template.

    Args:
        notif_type: str - one of NotificationLog.NOTIF_TYPES values (e.g. "quiz-assigned")
        users: list[CustomUser] - users to notify
        organization: Organization instance
        context: dict - template placeholders (title, date, user, venue, trainer, department)
        content_type: str - "quiz", "video", "training-schedule"
        content_id: str/int - ID of the related content
        content_title: str - title of the related content
    """
    if not users:
        return

    context = context or {}

    # Find enabled template for this type
    template = NotificationTemplate.objects.filter(
        organization=organization,
        type=notif_type,
        enabled=True,
    ).first()

    channels = ["in-app"]  # default channel
    if not template:
        # No configured rule — create a default notification anyway
        default_titles = {
            "training-created": "New Training Scheduled",
            "training-modified": "Training Updated",
            "training-cancelled": "Training Cancelled",
            "training-reminder": "Training Reminder",
            "training-completed": "Training Completed",
            "venue-changed": "Venue Changed",
            "trainer-changed": "Trainer Changed",
            "enrollment-approved": "Enrollment Approved",
            "enrollment-rejected": "Enrollment Rejected",
            "enrollment-request": "Enrollment Request",
            "quiz-assigned": "New Quiz Assigned",
            "quiz-completed": "Quiz Completed",
            "quiz-failed": "Quiz Failed",
            "certificate-issued": "Certificate Issued",
            "video-assigned": "New Video Assigned",
            "video-completed": "Video Completed",
            "approval-request": "Approval Requested",
            "approval-approved": "Approval Approved",
            "approval-rejected": "Approval Rejected",
        }
        title = default_titles.get(notif_type, notif_type)
        message = context.get("title", "") or content_title or ""
    else:
        title = template.title
        message = render_template(template.template, context)
        channels = template.channels or ["in-app"]

    for user in users:
        # Build per-user context for template rendering
        user_context = {**context}
        user_context.setdefault("user", f"{user.first_name} {user.last_name}".strip() or user.username)
        if user.department:
            user_context.setdefault("department", str(user.department))

        # Re-render message with user-specific context if template exists
        if template and template.template:
            message = render_template(template.template, user_context)

        # Always create in-app notification log
        NotificationLog.objects.create(
            user=user,
            organization=organization,
            notif_type=notif_type,
            title=title,
            message=message,
            content_type=content_type,
            content_id=str(content_id) if content_id else None,
            content_title=content_title,
        )

        # Send email if channel is configured
        if "email" in channels:
            send_email_notification(user, title, message)
