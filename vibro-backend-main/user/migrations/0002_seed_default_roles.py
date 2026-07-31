from django.db import migrations


def seed_default_roles(apps, schema_editor):
    Role = apps.get_model('user', 'Role')
    roles = [
        ('super_admin', 'Super Admin'),
        ('admin', 'Admin'),
        ('end_user', 'End User'),
        ('location_leader', 'Location Leader'),
    ]
    for name, description in roles:
        Role.objects.get_or_create(name=name, defaults={'description': description})


def remove_default_roles(apps, schema_editor):
    Role = apps.get_model('user', 'Role')
    Role.objects.filter(name__in=['super_admin', 'admin', 'end_user', 'location_leader']).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('user', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(seed_default_roles, remove_default_roles),
    ]
