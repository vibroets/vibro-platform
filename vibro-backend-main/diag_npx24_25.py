import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()

from form.models import Form, FormSubmision, Answer

# Check submissions 24 and 25 specifically
for sid in [24, 25]:
    print(f"\n{'='*60}")
    print(f"Submission ID: {sid}")
    try:
        s = FormSubmision.objects.get(id=sid)
        print(f"  Form ID: {s.form_id}, Title: {s.form.title}, Type: {s.form.form_type}")
        print(f"  Date: {s.submission_initiated_on}, By: {s.submission_initiated_by}")
        print(f"  Is Completed: {s.is_completed}")
        answers = Answer.objects.filter(submission_id=s.id)
        print(f"  Answers: {answers.count()}")
        for a in answers:
            qtext = a.question.question[:80] if a.question else 'NO QUESTION'
            print(f"    Q: {qtext} -> A: {str(a.answer)[:50]}")
    except FormSubmision.DoesNotExist:
        print(f"  DOES NOT EXIST")

# Also list ALL submissions for form 5
print(f"\n{'='*60}")
print(f"All Form 5 submissions:")
subs = FormSubmision.objects.filter(form_id=5).order_by('-id')
for s in subs:
    answers = Answer.objects.filter(submission_id=s.id)
    print(f"  Sub ID: {s.id}, Date: {s.submission_initiated_on}, Answers: {answers.count()}")
