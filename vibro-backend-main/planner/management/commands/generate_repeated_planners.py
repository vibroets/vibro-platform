"""
Management command to auto-generate repeated planner instances.

Run daily (e.g., via cron or scheduled task):
    python manage.py generate_repeated_planners

For each PlannerAssignment with repeat_enabled=True and repeat_generation_date <= now:
  1. Create a new PlannerAssignment with shifted dates (start_date + repeat_interval_days)
  2. Copy all assignees (user, group, leader) and settings from the parent
  3. Set parent_planner to the original planner
  4. Update the parent's repeat_generation_date to the next cycle
  5. The new instance gets its own repeat_generation_date for the next cycle
"""
from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from planner.models import PlannerAssignment


class Command(BaseCommand):
    help = 'Generate repeated planner instances for planners with repeat_enabled=True'

    def handle(self, *args, **options):
        now = timezone.now()
        created_count = 0

        # Find all planners that need repeating
        # repeat_generation_date is the date when the next instance should be created
        planners_to_repeat = PlannerAssignment.objects.filter(
            repeat_enabled=True,
            repeat_interval_days__gt=0,
            repeat_generation_date__lte=now,
            is_completed=False,  # Don't repeat completed planners (the new instance handles that)
        ).exclude(
            parent_planner__isnull=False  # Don't repeat already-repeated instances; only repeat originals
        ).select_related('form', 'location', 'user', 'group', 'leader', 'organization')

        self.stdout.write(f"Found {planners_to_repeat.count()} planners to repeat at {now}")

        for parent in planners_to_repeat:
            # Calculate new dates
            new_start_date = parent.start_date + timedelta(days=parent.repeat_interval_days)
            new_end_date = parent.end_date + timedelta(days=parent.repeat_interval_days)

            # Check if a repeated instance already exists for this cycle
            existing = PlannerAssignment.objects.filter(
                parent_planner=parent,
                start_date=new_start_date,
            ).exists()

            if existing:
                self.stdout.write(f"  Skipping planner {parent.id} - repeated instance already exists for {new_start_date.date()}")
                # Still update the next generation date
                parent.repeat_generation_date = new_start_date + timedelta(days=parent.repeat_interval_days)
                parent.save(update_fields=['repeat_generation_date'])
                continue

            # Create the repeated instance
            new_assignment = PlannerAssignment.objects.create(
                order_id=PlannerAssignment.generate_order_id(),
                assign_type=parent.assign_type,
                planner_name=parent.planner_name,
                location=parent.location,
                form=parent.form,
                user=parent.user,
                group=parent.group,
                leader=parent.leader,
                start_date=new_start_date,
                end_date=new_end_date,
                description=parent.description,
                organization=parent.organization,
                created_by=parent.created_by,
                repeat_enabled=True,
                repeat_interval_days=parent.repeat_interval_days,
                early_notification_days=parent.early_notification_days,
                parent_planner=parent,
            )

            # Set the new instance's repeat_generation_date for the next cycle
            new_assignment.repeat_generation_date = new_start_date + timedelta(days=parent.repeat_interval_days)
            new_assignment.save(update_fields=['repeat_generation_date'])

            # Update parent's repeat_generation_date to the next cycle
            parent.repeat_generation_date = new_start_date + timedelta(days=parent.repeat_interval_days)
            parent.save(update_fields=['repeat_generation_date'])

            created_count += 1
            self.stdout.write(
                f"  Created repeated planner {new_assignment.id} (order: {new_assignment.order_id}) "
                f"from parent {parent.id}, start_date={new_start_date.date()}"
            )

        self.stdout.write(
            self.style.SUCCESS(f"Successfully created {created_count} repeated planner instances")
        )
