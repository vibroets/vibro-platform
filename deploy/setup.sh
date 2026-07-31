#!/bin/bash
set -e

echo "=========================================="
echo "  Vibro Production Setup - Oracle Cloud"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root: sudo bash setup.sh"
  exit 1
fi

# Install Docker if not present
if ! command -v docker &> /dev/null; then
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  systemctl enable docker
  systemctl start docker
  rm get-docker.sh
  echo "Docker installed."
else
  echo "Docker already installed."
fi

# Install docker compose plugin if not present
if ! docker compose version &> /dev/null; then
  echo "Installing Docker Compose plugin..."
  apt-get update && apt-get install -y docker-compose-plugin
  echo "Docker Compose installed."
else
  echo "Docker Compose already installed."
fi

# Create app directory
APP_DIR="/opt/vibro"
mkdir -p $APP_DIR

# Create .env from example if it doesn't exist
if [ ! -f "$APP_DIR/deploy/.env" ]; then
  echo ""
  echo "========================================"
  echo "  Creating .env file"
  echo "========================================"
  echo "Please provide the following values:"
  echo ""
  read -p "PostgreSQL Password (or press Enter for auto-generated): " PG_PASS
  PG_PASS=${PG_PASS:-$(openssl rand -base64 16)}
  
  read -p "Django Secret Key (or press Enter for auto-generated): " DJ_KEY
  DJ_KEY=${DJ_KEY:-$(openssl rand -base64 50)}
  
  cat > $APP_DIR/deploy/.env << EOF
POSTGRES_DB=vibro
POSTGRES_USER=vibro
POSTGRES_PASSWORD=$PG_PASS
DJANGO_SECRET_KEY=$DJ_KEY
DEBUG=False
ALLOWED_HOSTS=www.vibroets.com,vibroets.com,localhost,127.0.0.1
NEXT_PUBLIC_API_URL=https://www.vibroets.com/api
EOF
  echo ".env file created at $APP_DIR/deploy/.env"
  echo "IMPORTANT: Save these credentials somewhere safe!"
else
  echo ".env file already exists."
fi

# Create self-signed SSL cert as placeholder (will be replaced by Let's Encrypt)
CERT_DIR="$APP_DIR/deploy/nginx/certs"
mkdir -p $CERT_DIR
if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
  echo "Creating placeholder SSL certificate..."
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout $CERT_DIR/privkey.pem \
    -out $CERT_DIR/fullchain.pem \
    -subj "/C=IN/ST=TN/L=Chennai/O=Vibro/CN=www.vibroets.com"
  echo "Placeholder SSL certificate created."
fi

# Create certbot directories
mkdir -p $APP_DIR/deploy/nginx/certs

echo ""
echo "========================================"
echo "  Setup Complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Point www.vibroets.com DNS A record to this server's IP"
echo "2. Run: cd $APP_DIR/deploy && docker compose up -d"
echo "3. Get real SSL certificate:"
echo "   docker compose run --rm certbot certonly --webroot -w /var/www/certbot -d www.vibroets.com -d vibroets.com"
echo "4. Copy certs to nginx/certs/:"
echo "   cp /etc/letsencrypt/live/www.vibroets.com/fullchain.pem deploy/nginx/certs/"
echo "   cp /etc/letsencrypt/live/www.vibroets.com/privkey.pem deploy/nginx/certs/"
echo "5. Restart nginx: docker compose restart nginx"
echo "6. Run migrations: docker compose exec backend python manage.py migrate"
echo ""
