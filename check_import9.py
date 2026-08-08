import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()
from task.models import Task, TaskAssignee
from form.models import FollowUpTask
from form.models import FormSubmision

# Check if Task 51 is visible to user 3 (gu.kumaran)
# Simulate TaskViewSet.get_queryset() for user 3
from user.models import CustomUser
user = CustomUser.objects.get(id=3)

# Check hidden followup tasks
hidden = FollowUpTask.objects.filter(
    started_by__isnull=False
).exclude(
    started_by=user
).values_list('task_details_id', flat=True)
print(f"Hidden followup task IDs: {list(hidden)}")

# Check if Task 51 is in the hidden list
print(f"Task 51 hidden: {51 in set(hidden)}")

# Check Task 51 details
t51 = Task.objects.get(id=51)
print(f"\nTask 51: name={t51.task_name} status={t51.status} org={t51.organization_id}")
print(f"  form={t51.form_id} followup_form={t51.followup_task_form_id_id}")
print(f"  form_submission={t51.form_submission_id} sub_question={t51.follow_task_sub_question_id}")
print(f"  created_by={t51.created_by_id} created_on={t51.created_on}")
print(f"  start_date={t51.start_date} end_date={t51.end_date}")

# Check assignees for Task 51
assignees = TaskAssignee.objects.filter(task=t51)
print(f"  Assignees: {assignees.count()}")
for a in assignees:
    print(f"    user={a.assigned_user_id} group={a.assigned_group_id} leader={a.assigned_leader_id}")

# Check if user 3 is in group 1
from user.models import Groups
g1 = Groups.objects.get(id=1)
print(f"\nGroup 1 members: {[u.id for u in g1.members.all()]}")
print(f"User 3 in group 1: {g1.members.filter(id=3).exists()}")

# Simulate the full queryset for user 3
qs = Task.objects.filter(organization=user.organization).order_by('-created_on')
if hidden:
    qs = qs.exclude(id__in=hidden)
print(f"\nTotal tasks visible to user 3: {qs.count()}")
print(f"Task 51 in visible queryset: {qs.filter(id=51).exists()}")

# List all tasks visible to user 3 that are followup tasks for form 5
form5_tasks = qs.filter(followup_task_form_id=5)
print(f"\nFollowup tasks for form 5 visible to user 3: {form5_tasks.count()}")
for t in form5_tasks:
    print(f"  Task {t.id}: name={t.task_name} status={t.status}")
