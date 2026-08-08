import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()

from form.models import FormSubmision, Form

f = Form.objects.filter(title='Master check Copy').first()
print('form_id:', f.id if f else None)
if f:
    ids = list(FormSubmision.objects.filter(form_id=f.id).exclude(id__in=[10, 13]).values_list('id', flat=True))
    print('count:', len(ids))
    print('ids:', sorted(ids))
