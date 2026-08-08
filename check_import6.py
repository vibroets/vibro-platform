import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()
from form.models import FormSubmision, Answer, Form
from task.models import Task

# Check ALL submissions for form 5
all_subs = FormSubmision.objects.filter(form_id=5).order_by('id')
print(f"=== All submissions for form 5: {all_subs.count()} ===")
for s in all_subs:
    answers = Answer.objects.filter(submission=s)
    tasks = Task.objects.filter(form_submission=s)
    print(f"Sub {s.id}: bulk={s.is_bulk_imported} completed={s.is_completed} answers={answers.count()} tasks={tasks.count()}")

# Simulate what generate_csv_with_followup_data sees
# It gets all submissions, then for each, gets answers and tasks
# Each row = one question/answer within a response
# Count rows per submission
print()
print("=== Row count per submission (what CSV/analytics would show) ===")
for s in all_subs:
    answers = Answer.objects.filter(submission=s).select_related('question')
    # Only count answers that have a question (not audit_info metadata)
    main_answers = [a for a in answers if a.question and not a.question.question.startswith('Audited Location') 
                    and a.question.question not in ['Image', 'Remarks', 'Consumed from (or) Reason for not Closing',
                     'SAP Code (or) Product Name', 'Quantity', 'After Image']]
    print(f"Sub {s.id}: total_answers={answers.count()} main_answers={len(main_answers)} tasks={Task.objects.filter(form_submission=s).count()}")
