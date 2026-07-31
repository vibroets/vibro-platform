import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()

from planner.models import PlannerAssignment

# Update completed planners to have started_by set to completed_by
planners = PlannerAssignment.objects.filter(is_completed=True, started_by__isnull=True)
print(f'Found {planners.count()} completed planners without started_by')

for p in planners:
    print(f'Updating planner ID: {p.id}, Name: {p.planner_name}, completed_by: {p.completed_by}')
    p.started_by = p.completed_by
    p.started_on = p.completed_on
    p.save()

print('Update complete')
