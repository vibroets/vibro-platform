"""
Task utility functions for intelligent task grouping and batch operations
"""
from django.db.models import Q
from .models import Task, TaskAuditLog
from form.models import Answer, FormSubmision, QuestionType
from django.utils import timezone
from django.db import models

def get_main_form_submission_for_task(task):
    """
    For a follow-up task, find the main form submission that triggered it.
    Uses the form_submission FK if available (set during bulk import),
    otherwise falls back to audit log + start_date matching for legacy tasks.
    """
    if not task.followup_task_form_id_id:
        return None

    # Use direct FK if available (set during bulk import)
    if hasattr(task, 'form_submission_id') and task.form_submission_id:
        return task.form_submission

    # Fallback for legacy tasks: find by audit log + submission date
    log = TaskAuditLog.objects.filter(
        task=task,
        task_action__iexact='Followup_Created'
    ).order_by('action_date_time').first()

    if not log or not log.action_by_id:
        return None

    qs = FormSubmision.objects.filter(
        form_id=task.followup_task_form_id_id,
        submission_initiated_by_id=log.action_by_id,
        organization=task.organization
    )

    if task.start_date:
        candidate = qs.filter(
            Q(completed_on=task.start_date) | Q(submission_initiated_on=task.start_date)
        ).order_by('-submission_initiated_on').first()
        if candidate:
            return candidate

    return qs.order_by('-submission_initiated_on').first()


def get_location_from_submission(submission):
    """
    Extract location information from a given main form submission.

    Returns: Tuple of (location_type, location_value) or None
    Priority: location_id (FK) > answer text > other_text
    """
    if not submission or not submission.form:
        return None

    from form.models import Question
    # Only look for location if the form actually has a Location question
    if not Question.objects.filter(form=submission.form, question_type=QuestionType.LOCATION).exists():
        return None

    location_answer = Answer.objects.filter(
        submission=submission,
        question_type=QuestionType.LOCATION
    ).select_related('location').order_by('-submitted_on').first()

    if not location_answer:
        return None

    if location_answer.location_id:
        return ('location_id', location_answer.location_id)
    elif location_answer.answer:
        return ('answer_text', location_answer.answer.strip())
    elif location_answer.other_text:
        return ('other_text', location_answer.other_text.strip())

    return None


def get_location_from_task(task):
    """
    Extract location information from the main form submission that triggered
    the follow-up task.
    """
    if not task.followup_task_form_id:
        return None

    try:
        submission = get_main_form_submission_for_task(task)
        if not submission:
            return None
        return get_location_from_submission(submission)
    except Exception:
        return None


def find_related_tasks(task, organization):
    """
    Find all tasks related to the given task by:
    - Same follow-up question (follow_task_sub_question)
    - Same main form (followup_task_form_id)
    - Same location (from form submission answers)
    - Same organization
    - Not already completed/cancelled
    
    Args:
        task: Task object to find related tasks for
        organization: Organization object for filtering
        
    Returns:
        Queryset of related tasks with same location + question
    """
    if not task.followup_task_form_id or not task.follow_task_sub_question:
        return Task.objects.none()
    
    # Get location info from this task's form answers
    location_info = get_location_from_task(task)
    
    if not location_info:
        return Task.objects.none()
    
    location_type, location_value = location_info

    # Find candidate tasks with the same main form + triggering question.
    candidate_tasks = Task.objects.filter(
        organization=organization,
        followup_task_form_id=task.followup_task_form_id,
        follow_task_sub_question=task.follow_task_sub_question,
    ).exclude(id=task.id).exclude(status__in=['completed', 'cancelled'])

    related_task_ids = []
    for candidate in candidate_tasks:
        try:
            candidate_submission = get_main_form_submission_for_task(candidate)
            if not candidate_submission:
                continue
            candidate_location = get_location_from_submission(candidate_submission)
            if candidate_location == location_info:
                related_task_ids.append(candidate.id)
        except Exception:
            continue

    return Task.objects.filter(id__in=related_task_ids).select_related(
        'follow_task_sub_question', 'followup_task_form_id'
    )


def close_related_tasks(task, user, organization, selected_task_ids=None):
    """
    Close tasks related to the given task by location, question, and form combination.
    Creates audit logs for each closed task.
    
    Args:
        task: Main task being closed
        user: User closing the task
        organization: Organization context
        selected_task_ids: Optional list of specific related task IDs to close.
                          If provided, only those IDs from the related set are closed.
                          If None or empty, no related tasks are closed.
        
    Returns:
        Dictionary with:
        - related_task_ids: List of IDs of tasks that were closed
        - count: Number of related tasks closed
        - details: List of closed task details
    """
    related_tasks = find_related_tasks(task, organization)
    related_task_ids = []
    closed_task_details = []
    
    if not related_tasks.exists():
        return {
            'related_task_ids': [],
            'count': 0,
            'details': [],
            'message': 'No related tasks found'
        }
    
    # Only close tasks that were explicitly selected by the user.
    # If selected_task_ids is None or empty, no related tasks are closed.
    selected_id_set = set()
    if selected_task_ids is not None:
        selected_id_set = set(int(x) for x in selected_task_ids if x is not None)

    if not selected_id_set:
        return {
            'related_task_ids': [],
            'count': 0,
            'details': [],
            'message': 'No related task IDs selected for closing'
        }
    related_tasks = related_tasks.filter(id__in=selected_id_set)
    
    for related_task in related_tasks:
        try:
            if related_task.status not in ['completed', 'cancelled']:
                
                # Update status
                related_task.status = 'completed'
                related_task.updated_by = user
                related_task.updated_on = timezone.now()
                related_task.save()
                
                # Create audit log for this related task
                TaskAuditLog.objects.create(
                    task=related_task,
                    task_action='Auto_Closed_Related_Task',
                    action_by=user,
                    action_to=None
                )
                
                related_task_ids.append(related_task.id)
                closed_task_details.append({
                    'id': related_task.id,
                    'task_name': related_task.task_name,
                    'status': 'completed',
                    'closed_at': timezone.now().isoformat()
                })
        except Exception:
            continue
    
    return {
        'related_task_ids': related_task_ids,
        'count': len(related_task_ids),
        'details': closed_task_details,
        'message': f'Successfully closed {len(related_task_ids)} related task(s)'
    }


def get_related_tasks_info(task, organization):
    """
    Get information about related tasks without closing them.
    Used to show preview before confirming close.
    
    Args:
        task: Task to check for related tasks
        organization: Organization context
        
    Returns:
        Dictionary with task details and count
    """
    related_tasks = find_related_tasks(task, organization)
    tasks_list = list(related_tasks.values('id', 'task_name', 'status', 'start_date', 'end_date'))
    
    return {
        'has_related_tasks': len(tasks_list) > 0,
        'count': len(tasks_list),
        'tasks': tasks_list
    }

