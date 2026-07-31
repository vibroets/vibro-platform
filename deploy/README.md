# Vibro Production Deployment Guide

## Architecture

```
                    Internet
                       |
                  [Nginx :443]
                 /     |     \
    [Frontend:3000] [Backend:8000] [WebSocket]
         Next.js    Django+Daphne    /ws/
                       |                |
                  [PostgreSQL]      [Redis]
                   :5432            :6379
```

## Prerequisites

1. **Oracle Cloud VM** (Ampere A1 ARM - free tier, 4 OCPU, 24GB RAM)
2. **Domain**: www.vibroets.com (DNS A record pointing to VM public IP)
3. **GitHub repo** with your code pushed to `main` branch

## Step 1: Oracle Cloud VM Setup

1. Go to Oracle Cloud Console → Compute → Create Instance
2. Select **Ampere A1** shape (free tier: up to 4 OCPUs, 24GB RAM)
3. Use **Ubuntu 22.04** image
4. Save the SSH private key
5. Open ports in Security List:
   - **80** (HTTP)
   - **443** (HTTPS)
   - **22** (SSH)

## Step 2: Initial Server Setup

SSH into your VM:
```bash
ssh ubuntu@<your-vm-public-ip>
```

Clone the repo and run setup:
```bash
sudo apt-get update && sudo apt-get install -y git
sudo mkdir -p /opt/vibro
sudo chown $USER:$USER /opt/vibro
cd /opt/vibro
git clone https://github.com/<your-username>/<your-repo>.git .
cd deploy
sudo bash setup.sh
```

## Step 3: Configure DNS

Point your domain to the VM:
- **A Record**: `vibroets.com` → `<your-vm-public-ip>`
- **A Record**: `www.vibroets.com` → `<your-vm-public-ip>`

## Step 4: Start Services

```bash
cd /opt/vibro/deploy
cp .env.example .env  # Edit with strong passwords!
docker compose up -d
```

Check status:
```bash
docker compose ps
docker compose logs -f
```

## Step 5: Run Database Migrations

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py collectstatic --noinput
```

## Step 6: Get SSL Certificate (Let's Encrypt)

```bash
# Get certificate
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d www.vibroets.com \
  -d vibroets.com \
  --email support@vibroets.com \
  --agree-tos

# Copy to nginx
sudo cp /etc/letsencrypt/live/www.vibroets.com/fullchain.pem deploy/nginx/certs/
sudo cp /etc/letsencrypt/live/www.vibroets.com/privkey.pem deploy/nginx/certs/

# Restart nginx
docker compose restart nginx
```

## Step 7: GitHub Actions CI/CD

In your GitHub repo, go to **Settings → Secrets and Variables → Actions** and add:

| Secret | Value |
|--------|-------|
| `ORACLE_HOST` | Your VM public IP |
| `ORACLE_USER` | `ubuntu` (or your SSH user) |
| `ORACLE_SSH_KEY` | Your SSH private key (contents of the .pem file) |
| `ORACLE_PORT` | `22` |

Now every push to `main` branch will automatically:
1. SSH into the Oracle VM
2. Pull latest code
3. Rebuild Docker images
4. Run migrations
5. Restart services

## File Structure

```
vibro/
├── .github/workflows/
│   └── deploy.yml              # CI/CD pipeline
├── deploy/
│   ├── docker-compose.yml      # All services
│   ├── Dockerfile.backend      # Django + Daphne
│   ├── Dockerfile.frontend     # Next.js
│   ├── setup.sh                # Initial server setup
│   ├── .env.example            # Environment template
│   └── nginx/
│       └── nginx.conf          # Reverse proxy config
├── vibro-backend-main/         # Django backend
├── vibro-frontend-main/        # Next.js frontend
└── vibro-mobile-app-main/      # Expo mobile app
```

## Useful Commands

```bash
# View logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx

# Restart a service
docker compose restart backend

# Rebuild after code change
docker compose build --no-cache backend frontend
docker compose up -d backend frontend

# Run Django management commands
docker compose exec backend python manage.py createsuperuser
docker compose exec backend python manage.py shell

# Database backup
docker compose exec db pg_dump -U vibro vibro > backup.sql

# Database restore
cat backup.sql | docker compose exec -T db psql -U vibro vibro
```

## Mobile App

The mobile app is configured to connect to `https://www.vibroets.com/api`.
After deployment is working, rebuild the APK/AAB:

```bash
cd vibro-mobile-app-main
eas build --platform android --profile production --non-interactive
```
