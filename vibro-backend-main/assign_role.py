import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()

from user.models import CustomUser, Role

# Create roles if they don't exist
roles = [
    ('super_admin', 'Super Admin'),
    ('admin', 'Admin'),
    ('end_user', 'End User'),
    ('location_leader', 'Location Leader'),
]

for role_name, role_desc in roles:
    role, created = Role.objects.get_or_create(name=role_name)
    if created:
        role.description = role_desc
        role.save()
        print(f'Created role: {role_name}')

# Assign super_admin role to the user
user = CustomUser.objects.get(email='vibro.chennai@gmail.com')
super_admin_role = Role.objects.get(name='super_admin')
user.role = super_admin_role
user.save()
print(f'Assigned super_admin role to {user.email}')
