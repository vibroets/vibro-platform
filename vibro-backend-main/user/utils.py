import random
import string
from django.core.mail import send_mail, EmailMessage, EmailMultiAlternatives
from django.conf import settings
from datetime import datetime, timedelta
from .models import OTP
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

def generate_otp(length=6):
    return ''.join(random.choices(string.digits, k=length))

def send_otp_email(email, otp):
    subject = '🔐 Vibro OTP Verification Code'
    message = (
        f"Dear user,\n\n"
        f"Your One-Time Password (OTP) for accessing your Vibro account is: {otp}\n"
        f"This OTP is valid for only 5 minutes.\n\n"
        f"If you did not request this, please ignore this email.\n\n"
        f"Thank you,\n"
        f"The Vibro Team"
    )
    send_mail(
        subject,
        message,
        settings.EMAIL_FROM_ADDRESS,
        [email],
        fail_silently=False,
    )


def send_csv_email(email, csv_file, filename="active_users.csv"):
    subject = '📄 Active User Report'
    message = (
        f"Dear user,\n\n"
        f"Please find attached the CSV file containing the list of active users.\n\n"
        f"Thank you,\n"
        f"The Vibro Team"
    )

    mail = EmailMessage(
        subject,
        message,
        settings.EMAIL_FROM_ADDRESS,
        [email],
    )
    
    mail.attach(filename, csv_file.getvalue(), 'text/csv')  # getvalue() fetches in-memory file content
    mail.send(fail_silently=False)
    

def create_otp(email):
    otp = generate_otp()
    expires_at = timezone.now() + timedelta(minutes=5)
    OTP.objects.create(email=email, otp=otp, expires_at=expires_at)
    send_otp_email(email, otp)
    return otp

    # def send_excel_email(email, excel_buffer, filename):
    #     subject = '📊 Form Responses Report'
    #     message = (
    #         f"Dear user,\n\n"
    #         f"Please find attached the Excel report for the form responses.\n\n"
    #         f"Regards,\n"
    #         f"Vibro Team"
    #     )

    #     mail = EmailMessage(
    #         subject,
    #         message,
    #         settings.EMAIL_FROM_ADDRESS,
    #         [email],
    #     )

    #     mail.attach(
    #         filename,
    #         excel_buffer.getvalue(),
    #         "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    #     )
    #     mail.send(fail_silently=False)


# def send_pdf_email(email, pdf_content, filename):
#     """
#     Send an email with a PDF attachment.
#     pdf_content: bytes or buffer (BytesIO); if buffer, .getvalue() is used.
#     """
#     subject = '📄 Form Responses PDF Report'
#     message = (
#         "Dear user,\n\n"
#         "Please find attached the PDF report for the form responses.\n\n"
#         "Regards,\n"
#         "Vibro Team"
#     )
#     data = pdf_content.getvalue() if hasattr(pdf_content, 'getvalue') else pdf_content
#     mail = EmailMessage(
#         subject,
#         message,
#         settings.EMAIL_FROM_ADDRESS,
#         [email],
#     )
#     mail.attach(filename, data, "application/pdf")
#     mail.send(fail_silently=False)


def send_pdf_link_email(email, download_url, filename, expires_in_seconds=None):
    """
    Send an email with a secure download link for the generated PDF.
    """
    subject = "Form Responses PDF Report"
    expiry_note = ""
    if expires_in_seconds:
        expiry_hours = int(expires_in_seconds / 3600)
        if expiry_hours > 0:
            expiry_note = f"This link expires in {expiry_hours} hours.\n\n"

    message = (
        "Dear user,\n\n"
        f"Your PDF report '{filename}' is ready.\n\n"
        "Click here to download:\n"
        f"{download_url}\n\n"
        f"{expiry_note}"
        "Regards,\n"
        "Vibro Team"
    )

    html_expiry_note = ""
    if expires_in_seconds:
        expiry_hours = int(expires_in_seconds / 3600)
        if expiry_hours > 0:
            html_expiry_note = f"<p>This link expires in {expiry_hours} hours.</p>"

    html_message = (
        "<p>Dear user,</p>"
        f"<p>Your PDF report '<strong>{filename}</strong>' is ready.</p>"
        f"<p><a href=\"{download_url}\">Click here to download</a></p>"
        f"{html_expiry_note}"
        "<p>Regards,<br/>Vibro Team</p>"
    )

    email_message = EmailMultiAlternatives(
        subject,
        message,
        settings.EMAIL_FROM_ADDRESS,
        [email],
    )
    email_message.attach_alternative(html_message, "text/html")
    email_message.send(fail_silently=False)


def send_excel_link_email(email, download_url, filename, expires_in_seconds=None):
    """
    Send an email with a secure download link for the generated Excel report.
    """
    subject = "Form Responses Report"
    expiry_note = ""
    if expires_in_seconds:
        expiry_hours = int(expires_in_seconds / 3600)
        if expiry_hours > 0:
            expiry_note = f"This link expires in {expiry_hours} hours.\n\n"

    message = (
        "Dear user,\n\n"
        f"Your Excel report '{filename}' is ready.\n\n"
        "Click here to download:\n"
        f"{download_url}\n\n"
        f"{expiry_note}"
        "Regards,\n"
        "Vibro Team"
    )

    html_expiry_note = ""
    if expires_in_seconds:
        expiry_hours = int(expires_in_seconds / 3600)
        if expiry_hours > 0:
            html_expiry_note = f"<p>This link expires in {expiry_hours} hours.</p>"

    html_message = (
        "<p>Dear user,</p>"
        f"<p>Your Excel report '<strong>{filename}</strong>' is ready.</p>"
        f"<p><a href=\"{download_url}\">Click here to download</a></p>"
        f"{html_expiry_note}"
        "<p>Regards,<br/>Vibro Team</p>"
    )

    email_message = EmailMultiAlternatives(
        subject,
        message,
        settings.EMAIL_FROM_ADDRESS,
        [email],
    )
    email_message.attach_alternative(html_message, "text/html")
    email_message.send(fail_silently=False)


def does_user_match_conditions(user, conditions, match_type):
    """
    Check if a user matches the given group conditions.
    
    Args:
        user: CustomUser instance
        conditions: QuerySet of GroupsConditions
        match_type: 'AND' or 'OR'
    
    Returns:
        bool: True if user matches conditions, False otherwise
    """
    if not conditions.exists():
        logger.info(f"No conditions found, user {user.email} matches by default")
        return True  # No conditions, so user matches
    
    matches = []
    for condition in conditions:
        # Get the user's value for the specific field
        user_value = None
        if condition.field == 'department':
            user_value = user.department.name if user.department else ""
        elif condition.field == 'location':
            user_value = user.location.name if user.location else ""
        elif condition.field == 'designation':
            user_value = user.designation.name if user.designation else ""
        elif condition.field == 'division':
            user_value = user.division.name if user.division else ""
        elif condition.field == 'subdivision':
            user_value = user.subdivision.name if user.subdivision else ""
        
        if user_value is None:
            user_value = ""
        
        user_value = str(user_value).lower()
        condition_value = str(condition.value or '').lower()
        
        logger.info(f"Condition: {condition.field} {condition.operator} '{condition.value}'")
        logger.info(f"User value: '{user_value}', Condition value: '{condition_value}'")
        
        # Apply operator
        if condition.operator == 'equals':
            match_result = user_value == condition_value
        elif condition.operator == 'not_equal':
            match_result = user_value != condition_value
        elif condition.operator == 'contains':
            match_result = condition_value in user_value
        elif condition.operator == 'starts_with':
            match_result = user_value.startswith(condition_value)
        elif condition.operator == 'ends_with':
            match_result = user_value.endswith(condition_value)
        elif condition.operator == 'is_one_of':
            allowed_values = [v.strip().lower() for v in condition_value.split(',')]
            match_result = user_value in allowed_values
        else:
            match_result = False
        
        logger.info(f"Match result: {match_result}")
        matches.append(match_result)
    
    final_result = all(matches) if match_type == 'AND' else any(matches)
    logger.info(f"Match type: {match_type}, Final result: {final_result}, Individual matches: {matches}")
    return final_result


def add_user_to_matching_rule_based_groups(user):
    """
    Automatically add a user to all rule-based groups they match.
    
    Args:
        user: CustomUser instance
    """
    from .models import Groups, GroupsConditions
    from .constants import GROUP_TYPES
    
    if not user.organization:
        return
    
    # Get all rule-based groups for the user's organization
    rule_based_groups = Groups.objects.filter(
        type=GROUP_TYPES.RULEBASED,
        organization=user.organization,
        is_deleted=False,
        is_archived=False
    )
    
    for group in rule_based_groups:
        conditions = group.conditions.all()
        if does_user_match_conditions(user, conditions, group.match_type):
            # Add user to the group if not already a member
            if not group.members.filter(id=user.id).exists():
                group.members.add(user)


def re_evaluate_group_membership(group):
    """
    Re-evaluate all users in the organization against the group's conditions
    and update membership dynamically. This removes users who no longer match
    and adds users who now match.
    
    Args:
        group: Groups instance (should be a rule-based group)
    """
    from .models import CustomUser, GroupsConditions
    from .constants import GROUP_TYPES
    
    # Only process rule-based groups
    if group.type != GROUP_TYPES.RULEBASED:
        return
    
    if not group.organization:
        return
    
    conditions = group.conditions.all()
    
    # Get all users in the organization
    all_users = CustomUser.objects.filter(
        organization=group.organization,
        is_deleted=False,
        is_archived=False
    )
    
    # Get current members
    current_members = set(group.members.all())
    
    # Determine which users should be members based on conditions
    matching_users = set()
    for user in all_users:
        if does_user_match_conditions(user, conditions, group.match_type):
            matching_users.add(user)
    
    # Remove users who no longer match
    users_to_remove = current_members - matching_users
    for user in users_to_remove:
        group.members.remove(user)
    
    # Add users who now match
    users_to_add = matching_users - current_members
    for user in users_to_add:
        group.members.add(user)


def re_evaluate_user_group_membership(user):
    """
    Re-evaluate a specific user's membership in all rule-based groups.
    This removes the user from groups where they no longer match conditions
    and adds them to groups where they now match.
    
    Args:
        user: CustomUser instance
    """
    from .models import Groups, GroupsConditions
    from .constants import GROUP_TYPES
    
    if not user.organization:
        return
    
    # Get all rule-based groups for the user's organization
    rule_based_groups = Groups.objects.filter(
        type=GROUP_TYPES.RULEBASED,
        organization=user.organization,
        is_deleted=False,
        is_archived=False
    )
    
    logger.info(f"Re-evaluating group membership for user {user.email} (ID: {user.id})")
    logger.info(f"User department: {user.department.name if user.department else 'None'}")
    logger.info(f"User designation: {user.designation.name if user.designation else 'None'}")
    
    for group in rule_based_groups:
        conditions = group.conditions.all()
        user_matches = does_user_match_conditions(user, conditions, group.match_type)
        
        # Check if user is currently a member
        is_member = group.members.filter(id=user.id).exists()
        
        logger.info(f"Group: {group.name}, Match type: {group.match_type}, Conditions count: {conditions.count()}")
        logger.info(f"User matches: {user_matches}, Is member: {is_member}")
        
        # Update membership based on match status
        if user_matches and not is_member:
            # User should be a member but isn't - add them
            group.members.add(user)
            logger.info(f"Added user {user.email} to group {group.name}")
        elif not user_matches and is_member:
            # User shouldn't be a member but is - remove them
            group.members.remove(user)
            logger.info(f"Removed user {user.email} from group {group.name}")
