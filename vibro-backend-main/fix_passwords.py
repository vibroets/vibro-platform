#!/usr/bin/env python
import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'vibro.settings')
django.setup()

from user.models import LocationLeader
from django.db import connection

def fix_password_data():
    """Fix corrupted password data in LocationLeader model"""
    with connection.cursor() as cursor:
        # Set invalid password to 0 (default value)
        cursor.execute('UPDATE user_locationleader SET password = %s WHERE password = %s', [0, 'Abc123!@#'])

        # Convert valid string numbers to integers
        valid_passwords = ['123456', '66666', '12345', '111222', '333555']
        for pwd_str in valid_passwords:
            try:
                pwd_int = int(pwd_str)
                cursor.execute('UPDATE user_locationleader SET password = %s WHERE password = %s', [pwd_int, pwd_str])
            except ValueError:
                pass

    print('Password data cleaned successfully')

if __name__ == '__main__':
    fix_password_data()
