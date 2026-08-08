import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()
from form.models import FormSubmision, Answer, Form, Question
from task.models import Task

# Check all 9 tasks for sub 39 - verify each has a matching answer
tasks = Task.objects.filter(form_submission_id=39).order_by('id')
print("=== 9 tasks for submission 39 ===")
for t in tasks:
    q = t.follow_task_sub_question
    # Check if answer exists for this question in this submission
    ans = Answer.objects.filter(submission_id=39, question=q).first()
    print(f"Task {t.id}: q_id={q.id} q='{q.question[:50]}' answer_exists={ans is not None} answer_val='{ans.answer[:30] if ans else 'NONE'}'")

# Check if all 9 questions appear in the form's audit groups
print()
print("=== Form 5 audit groups and their questions ===")
from form.models import AuditGroup
ags = AuditGroup.objects.filter(form_id=5).order_by('order')
for ag in ags:
    qs = Question.objects.filter(audit_group=ag).order_by('order')
    print(f"AG '{ag.name}' (order={ag.order}): {qs.count()} questions")
    for q in qs:
        ans = Answer.objects.filter(submission_id=39, question=q).first()
        has_task = Task.objects.filter(form_submission_id=39, follow_task_sub_question=q).exists()
        marker = ' *** HAS_TASK' if has_task else ''
        ans_marker = f" ans='{ans.answer[:30]}'" if ans else ' NO_ANSWER'
        print(f"  q_id={q.id} '{q.question[:50]}'{ans_marker}{marker}")

# Check if any of the 9 task questions are NOT in audit groups
print()
print("=== Task questions not in any audit group ===")
for t in tasks:
    q = t.follow_task_sub_question
    if not q.audit_group_id:
        print(f"Task {t.id}: q_id={q.id} '{q.question[:50]}' - NO AUDIT GROUP! stage={q.stage_id}")
    else:
        print(f"Task {t.id}: q_id={q.id} '{q.question[:50]}' - in AG={q.audit_group.name}")
