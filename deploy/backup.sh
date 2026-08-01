#!/bin/bash
cd /opt/vibro/deploy
docker compose exec -T db pg_dump -U vibro vibro | gzip > /opt/vibro/backups/vibro_$(date +%Y%m%d).sql.gz
find /opt/vibro/backups -name "vibro_*.sql.gz" -mtime +7 -delete
