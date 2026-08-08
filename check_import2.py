import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()
from form.models import FormSubmision, Answer
from task.models import Task
from planner.models import PlannerSubmission, PlannerAssignment

# Get all bulk imported submissions for form 5
subs = FormSubmision.objects.filter(is_bulk_imported=True, form_id=5).order_by('id')
print(f"Total bulk imported submissions: {subs.count()}")
print()

for s in subs:
    answers = Answer.objects.filter(submission=s)
    tasks = Task.objects.filter(form_submission=s)
    ps = PlannerSubmission.objects.filter(form_submission=s).first()
    pa = ps.planner_assignment if ps else None
    print(f"Sub {s.id}: initiated_on={s.submission_initiated_on} completed={s.is_completed}")
    print(f"  Answers: {answers.count()}, Tasks: {tasks.count()}")
    print(f"  PlannerSubmission: {ps.id if ps else 'NONE'}")
    print(f"  PlannerAssignment: {pa.order_id if pa else 'NONE'} (completed={pa.is_completed if pa else 'N/A'})")
    for t in tasks:
        print(f"  Task id={t.id} name={t.task_name[:50]} status={t.status} follow_task_sub_question_id={t.follow_task_sub_question_id}")
    print()
