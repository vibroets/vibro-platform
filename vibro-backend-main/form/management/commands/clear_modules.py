from django.core.management.base import BaseCommand
from django.apps import apps
from django.db import transaction


MODULE_APPS = ['task', 'planner', 'announcement', 'form']


class Command(BaseCommand):
    help = (
        "Delete all data records for the Forms, Announcements, Tasks, "
        "and Planner modules while keeping users, organizations, and code intact."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show record counts without deleting anything.',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        total_deleted = 0

        with transaction.atomic():
            for app_label in MODULE_APPS:
                self.stdout.write(f"App: {app_label}")
                models = apps.get_app_config(app_label).get_models()
                for model in models:
                    count = model.objects.count()
                    if count:
                        self.stdout.write(f"  {model.__name__}: {count}")
                        if not dry_run:
                            deleted, _ = model.objects.all().delete()
                            total_deleted += deleted
                    else:
                        self.stdout.write(f"  {model.__name__}: 0")

        if dry_run:
            self.stdout.write(self.style.WARNING('Dry run complete. No records deleted.'))
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    f'Cleared all data for {", ".join(MODULE_APPS)}. '
                    f'Total records deleted: {total_deleted}.'
                )
            )
