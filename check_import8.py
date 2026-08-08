import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()
from form.models import FormSubmision, Answer, Question
from task.models import Task

# Check all 9 tasks for sub 39 - verify each has a matching answer
tasks = Task.objects.filter(form_submission_id=39).order_by('id')
print("=== 9 tasks for submission 39 - answer check ===")
for t in tasks:
    q = t.follow_task_sub_question
    ans = Answer.objects.filter(submission_id=39, question=q).first()
    print(f"Task {t.id}: q_id={q.id} q='{q.question[:60]}' answer_exists={ans is not None} answer_val='{ans.answer[:40] if ans else 'NONE'}'")

# Now simulate what generate_csv_with_followup_data does
# It iterates through the form's serialized schema and checks each question
# Let's check which questions in the form schema have answers for sub 39
print()
print("=== Questions with answers for sub 39 (main questions only, not sub-questions) ===")
answers = Answer.objects.filter(submission_id=39).select_related('question')
for a in answers:
    q = a.question
    # Skip sub-questions (those with parent_question)
    if q.parent_question_id:
        continue
    # Skip audit info questions
    if q.is_task_close_question:
        continue
    has_task = Task.objects.filter(form_submission_id=39, follow_task_sub_question=q).exists()
    print(f"q_id={q.id} q='{q.question[:60]}' ans='{a.answer[:40]}' has_task={has_task}")
