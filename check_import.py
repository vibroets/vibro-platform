import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()
from form.models import FormSubmision, Answer
from task.models import Task

subs = FormSubmision.objects.filter(is_bulk_imported=True).order_by('-id')[:5]
for s in subs:
    answers = Answer.objects.filter(submission=s)
    tasks = Task.objects.filter(form_submission_id=s.id)
    print(f"Submission {s.id}: {answers.count()} answers, {tasks.count()} tasks")
    for a in answers:
        print(f"  Answer q_id={a.question_id} q={a.question.question[:60]} ans={a.answer[:40]}")
    for t in tasks:
        print(f"  Task id={t.id} title={t.title[:50]} status={t.status}")
