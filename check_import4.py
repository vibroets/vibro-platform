import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()
from task.models import Task
from planner.models import PlannerAssignment, PlannerSubmission
from form.models import FormSubmision, Answer

# Check task 51 specifically (NPX51 might mean task 51)
t51 = Task.objects.get(id=51)
print(f"Task 51: name={t51.task_name} status={t51.status} form={t51.form} followup_form={t51.followup_task_form_id}")
print(f"  form_submission={t51.form_submission_id} sub_question={t51.follow_task_sub_question_id}")
print(f"  organization={t51.organization_id} created_by={t51.created_by_id}")
print(f"  start_date={t51.start_date} end_date={t51.end_date}")
print()

# Check all 9 tasks for sub 39 - check if any have issues
tasks_39 = Task.objects.filter(form_submission_id=39).order_by('id')
print("=== All 9 tasks for submission 39 ===")
for t in tasks_39:
    q = t.follow_task_sub_question
    q_text = q.question[:50] if q else 'NONE'
    # Check if the question has a followup configured
    from form.models import LogicFollowUp
    lf = LogicFollowUp.objects.filter(question_id=t.follow_task_sub_question_id, followup_toggle=True).first()
    print(f"Task {t.id}: q={q_text} lf={'YES' if lf else 'NO'} lf_id={lf.id if lf else 'N/A'}")

# Check what the analytics endpoint filters on
print()
print("=== Check LogicFollowUp for form 5 ===")
lfs = LogicFollowUp.objects.filter(form_id=5, followup_toggle=True)
print(f"Total LogicFollowUp with toggle=True: {lfs.count()}")
for lf in lfs:
    print(f"  LF {lf.id}: q_id={lf.question_id} title={lf.title} stage={lf.followup_stage_id}")
