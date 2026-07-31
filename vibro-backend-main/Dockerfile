# Step 1: Use an official lightweight Python image
FROM python:3.11-slim

# Step 2: Set environment variables for Python
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Step 3: Set working directory inside the container
WORKDIR /app

# Step 4: Install system dependencies (for psycopg2, Pillow, etc.)
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    libjpeg-dev \
    zlib1g-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Step 5: Upgrade pip
RUN pip install --upgrade pip

# Step 6: Copy requirements file first (to leverage Docker cache)
COPY requirements.txt /app/

# Step 7: Install Python dependencies
RUN pip install -r requirements.txt

# Step 8: Copy the rest of the application
COPY . /app/

# Step 9: Expose Django port
EXPOSE 8000

# Step 10: Run Django app with Gunicorn
# CMD ["python manage.py runserver 0.0.0.0:8000"]
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
