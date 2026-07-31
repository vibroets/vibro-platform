# Vibro Backend

## Overview

The Vibro Backend is built using **Django REST Framework (DRF)** and provides REST APIs for the Vibro Web and Mobile applications.

### Key Features

- JWT Authentication
- PostgreSQL Database
- AWS S3 File Storage
- SMTP Email Integration
- Swagger & ReDoc API Documentation

---

## Technology Stack

| Component | Version |
|----------|----------|
| Framework | Django REST Framework |
| Language | Python 3.13.x |
| Database | PostgreSQL |
| Authentication | JWT |
| File Storage | AWS S3 |
| Email Service | SMTP |
| API Documentation | Swagger / ReDoc |

---

## Prerequisites

Before running the project, ensure the following are installed:

- Python 3.13.x
- PostgreSQL
- Git
- Visual Studio Code (Recommended)

> **Note:** The existing virtual environment was created using Python 3.13.x. Using the same version is recommended for compatibility.

---

# Getting Started

## Clone the Repository

```bash
git clone <repository-url>
cd vibro
```

## Checkout the Required Branch

```bash
git checkout <branch_name>
```

## Create a Virtual Environment

```bash
python -m venv env
```

Activate the virtual environment.

**Windows**

```bash
env\Scripts\activate
```

**Linux / macOS**

```bash
source env/bin/activate
```

## Install Dependencies

Upgrade pip:

```bash
pip install --upgrade pip
```

Install the project dependencies:

```bash
pip install -r requirements.txt
```

---

# Environment Configuration

Create a `.env` file in the project root and configure the required environment variables.

Example:

```env
DB_DATABASE=<database_name>
DB_USERNAME=<database_username>
DB_PASSWORD=<database_password>
DB_HOST=localhost
DB_PORT=5432

AWS_ACCESS_KEY_ID=<access_key>
AWS_SECRET_ACCESS_KEY=<secret_key>
AWS_REGION=<region>

FORMS_UPLOAD_BUCKET=<bucket_name>
ANNOUNCEMENTS_UPLOAD_BUCKET=<bucket_name>
FORMS_DRAFT_BUCKET=<bucket_name>

FORCE_HTTPS=false
```

> Ensure the database credentials, AWS credentials, and bucket names are configured correctly for your environment.

---

# Database Setup

Run the database migrations:

```bash
python manage.py makemigrations
python manage.py migrate
```

Create a Superuser:

```bash
python manage.py createsuperuser
```

Follow the prompts to create the administrator account.

---

# Running the Application

Start the Django development server:

```bash
python manage.py runserver
```

The backend will be available at:

```
http://localhost:8000/
```

---

# API Documentation

Once the server is running, API documentation is available at:

| Documentation | URL |
|--------------|-----|
| Swagger UI | http://localhost:8000/swagger/ |
| ReDoc | http://localhost:8000/redoc/ |

---

# Development Notes

- Always pull the latest code before starting development.
- Configure the `.env` file before running the application.
- Ensure PostgreSQL is running before executing migrations.
- Run migrations whenever new database changes are pulled.
- Insert the required master data before testing application functionality.
- Verify AWS S3 credentials and SMTP configuration for file uploads and email functionality.
- Use Python 3.13.x for best compatibility.

# To trigger back-end via Docker

docker run -d --name vibro-server -p 8001:8000 -e NODE_ENV=qa -e DB_DATABASE="vibro-dbname"  -e DB_USERNAME="vibro-username"  -e DB_PASSWORD="vibro-password"  -e DB_HOST="vibro-prod-db.dd1234.us-east-1.rds.amazonaws.com"  -e DB_PORT="5432"  -e PORT="5432" -e EMAIL_HOST_PASSWORD="password@123456"  -e EMAIL_FROM_ADDRESS="support@vibroets.com" -e AWS_REGION="us-east-1" -e FORMS_UPLOAD_BUCKET="prod-vibro-feedloading" -e ANNOUNCEMENTS_UPLOAD_BUCKET="prod-announcement-file-attachments"  -e S3_DRAFT_FORMS_BUCKET="prod-forms-save-as-draft"    -e S3_BUCKET_NAME_ANNOUNCEMENT="prod-announcement-file-attachments"  -e AWS_ACCESS_KEY_ID="<AWS-ACCESS-KEY>"  -e AWS_SECRET_ACCESS_KEY="<AWS-SECRET-KEY>"  intellectoglobal/vibro-server

---

# Useful Commands

Update the requirements file after installing new packages:

```bash
pip freeze > requirements.txt
```

---

# Summary

The Vibro Backend is developed using **Django REST Framework**, **Python**, and **PostgreSQL**. Configure the required environment variables, install the project dependencies, apply database migrations, and start the application using:

```bash
python manage.py runserver
```

The backend will be available at:

```
http://localhost:8000/
```

API documentation can be accessed through Swagger and ReDoc once the application is running.
