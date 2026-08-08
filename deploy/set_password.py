import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
import django
django.setup()
from django.contrib.auth import get_user_model
u = get_user_model().objects.get(username='admin')
u.set_password('Vibro@2024')
u.save()
print('Password set successfully')
