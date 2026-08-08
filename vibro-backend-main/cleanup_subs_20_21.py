import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()

from form.models import FormSubmision, Answer, AuditFormSubmissionHistory, TaskCloseQuestion
from task.models import Task, TaskAssignee, TaskTracking, TaskAuditLog
from planner.models import PlannerSubmission

SUBMISSION_IDS = [20, 21]

for sid in SUBMISSION_IDS:
    print(f"\n--- Deleting submission {sid} ---")
    try:
        sub = FormSubmision.objects.get(id=sid)
    except FormSubmision.DoesNotExist:
        print(f"  Submission {sid} does not exist, skipping.")
        continue

    tasks = Task.objects.filter(form_submission_id=sid)
    task_count = tasks.count()
    for t in tasks:
        TaskCloseQuestion.objects.filter(task=t).delete()
        TaskAssignee.objects.filter(task=t).delete()
        TaskTracking.objects.filter(task=t).delete()
        TaskAuditLog.objects.filter(task=t).delete()
    tasks.delete()
    print(f"  Deleted {task_count} tasks")

    ans_count = Answer.objects.filter(submission_id=sid).count()
    Answer.objects.filter(submission_id=sid).delete()
    print(f"  Deleted {ans_count} answers")

    hist_count = AuditFormSubmissionHistory.objects.filter(form_submission_id=sid).count()
    AuditFormSubmissionHistory.objects.filter(form_submission_id=sid).delete()
    print(f"  Deleted {hist_count} audit history records")

    ps_count = PlannerSubmission.objects.filter(form_submission_id=sid).count()
    PlannerSubmission.objects.filter(form_submission_id=sid).delete()
    print(f"  Deleted {ps_count} planner submissions")

    sub.delete()
    print(f"  Submission {sid} deleted")

print("\nDone. All specified submissions cleaned up.")
