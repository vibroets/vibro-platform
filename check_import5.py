import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()
from task.models import Task, TaskAssignee, TaskTracking
from form.models import FollowUpTask

# Check all 9 tasks for sub 39
tasks = Task.objects.filter(form_submission_id=39).order_by('id')
print(f"=== {tasks.count()} tasks for submission 39 ===")
for t in tasks:
    # Check FollowUpTask records
    fut = FollowUpTask.objects.filter(task_details_id=t.id).first()
    assignees = TaskAssignee.objects.filter(task=t)
    tracking = TaskTracking.objects.filter(task=t)
    print(f"Task {t.id}: name={t.task_name} status={t.status}")
    print(f"  FollowUpTask: {'NONE' if not fut else f'id={fut.id} started_by={fut.started_by_id}'}")
    print(f"  Assignees: {assignees.count()}")
    for a in assignees:
        print(f"    user={a.assigned_user_id} group={a.assigned_group_id}")
    print(f"  Tracking: {tracking.count()}")
    print()

# Also check sub 38 tasks
tasks38 = Task.objects.filter(form_submission_id=38).order_by('id')
print(f"=== {tasks38.count()} tasks for submission 38 ===")
for t in tasks38:
    fut = FollowUpTask.objects.filter(task_details_id=t.id).first()
    assignees = TaskAssignee.objects.filter(task=t)
    print(f"Task {t.id}: name={t.task_name} status={t.status}")
    print(f"  FollowUpTask: {'NONE' if not fut else f'id={fut.id} started_by={fut.started_by_id}'}")
    print(f"  Assignees: {assignees.count()}")
    print()
