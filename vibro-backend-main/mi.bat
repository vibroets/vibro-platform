@echo off
REM Activate virtual environment
call venv\Scripts\activate

REM Run makemigrations
echo Running makemigrations...
python manage.py makemigrations

REM Run migrate
echo Running migrate...
python manage.py migrate

echo.
echo ✅ Migration complete!
pause