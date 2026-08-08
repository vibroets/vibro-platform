import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()

from form.models import FormSubmision, Answer, AuditFormSubmissionHistory, TaskCloseQuestion, Form
from task.models import Task, TaskAssignee, TaskTracking, TaskAuditLog
from planner.models import PlannerSubmission

FORM_TITLE = 'Master check Copy'
KEEP_IDS = {10, 13}

form = Form.objects.filter(title=FORM_TITLE).first()
if not form:
    print(f"Form '{FORM_TITLE}' not found.")
else:
    print(f"Form found: id={form.id}, title={form.title}")
    sub_ids = list(
        FormSubmision.objects.filter(form_id=form.id)
        .exclude(id__in=KEEP_IDS)
        .values_list('id', flat=True)
    )
    print(f"Submissions to delete ({len(sub_ids)}): {sub_ids}")

    for sid in sub_ids:
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

    print(f"\nDone. Kept submissions: {sorted(KEEP_IDS)}")
