import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()
from planner.models import PlannerSubmission, PlannerAssignment
from task.models import Task
from form.models import FormSubmision, Form

# Check all planner assignments for form 5
pas = PlannerAssignment.objects.filter(form_id=5).order_by('id')
print(f"Total PlannerAssignments for form 5: {pas.count()}")
print()
for pa in pas:
    ps_list = PlannerSubmission.objects.filter(planner_assignment=pa)
    sub_ids = [ps.form_submission_id for ps in ps_list]
    tasks = Task.objects.filter(form_submission__in=sub_ids)
    print(f"PA {pa.id}: order_id={pa.order_id} name={pa.planner_name[:40]} completed={pa.is_completed} user={pa.user_id}")
    print(f"  PlannerSubmissions: {ps_list.count()}, Tasks: {tasks.count()}")
    for t in tasks:
        print(f"    Task {t.id}: name={t.task_name[:40]} status={t.status} sub_q={t.follow_task_sub_question_id}")
    print()

# Check all tasks for form 5 submissions
print("=== All tasks for form 5 submissions ===")
all_subs = FormSubmision.objects.filter(form_id=5)
all_tasks = Task.objects.filter(form_submission__in=all_subs.values_list('id', flat=True))
print(f"Total tasks: {all_tasks.count()}")
for t in all_tasks.order_by('id'):
    sub = t.form_submission
    print(f"Task {t.id}: name={t.task_name} status={t.status} sub={sub.id} bulk={sub.is_bulk_imported}")

# Check form prefix
form = Form.objects.get(id=5)
print(f"\nForm: {form.title}, prefix: {form.prefix}")
