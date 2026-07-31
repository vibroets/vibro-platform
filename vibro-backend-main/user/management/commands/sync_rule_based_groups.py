from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from user.utils import re_evaluate_user_group_membership

class Command(BaseCommand):
    help = 'Manually sync a user to rule-based groups for testing'

    def add_arguments(self, parser):
        parser.add_argument('user_id', type=int, help='ID of the user to sync')

    def handle(self, *args, **options):
        user_id = options['user_id']
        User = get_user_model()
        
        try:
            user = User.objects.get(id=user_id)
            self.stdout.write(f'Syncing user {user.email} (ID: {user.id})...')
            self.stdout.write(f'Current department: {user.department.name if user.department else "None"}')
            self.stdout.write(f'Current designation: {user.designation.name if user.designation else "None"}')
            
            re_evaluate_user_group_membership(user)
            
            self.stdout.write(self.style.SUCCESS(f'Successfully synced user {user.email} to rule-based groups'))
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(f'User with ID {user_id} does not exist'))
