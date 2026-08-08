#!/bin/bash
# Automated Docker disk cleanup.
# - Weekly: prune build cache older than 7 days, dangling images/containers.
# - Emergency: if root disk usage exceeds 85%, do a full aggressive prune and alert.

ALERT_EMAIL="vibro.chennai@gmail.com"
LOG_TAG="[docker-cleanup]"

usage_pct=$(df --output=pcent / | tail -1 | tr -dc '0-9')

echo "$(date) ${LOG_TAG} disk usage before cleanup: ${usage_pct}%"

# Routine cleanup: only remove build cache/images/containers untouched for 7+ days
sudo docker builder prune -f --filter "until=168h" >/tmp/docker_cleanup_last.log 2>&1
sudo docker container prune -f --filter "until=168h" >>/tmp/docker_cleanup_last.log 2>&1
sudo docker image prune -f --filter "until=168h" >>/tmp/docker_cleanup_last.log 2>&1

usage_pct_after=$(df --output=pcent / | tail -1 | tr -dc '0-9')
echo "$(date) ${LOG_TAG} disk usage after routine cleanup: ${usage_pct_after}%"

# Emergency cleanup if still critically high
if [ "$usage_pct_after" -ge 85 ]; then
    echo "$(date) ${LOG_TAG} disk still critical (${usage_pct_after}%), running aggressive prune"
    sudo docker builder prune -a -f >>/tmp/docker_cleanup_last.log 2>&1
    sudo docker system prune -a -f --volumes=false >>/tmp/docker_cleanup_last.log 2>&1

    usage_pct_final=$(df --output=pcent / | tail -1 | tr -dc '0-9')
    echo "$(date) ${LOG_TAG} disk usage after aggressive cleanup: ${usage_pct_final}%"

    if [ "$usage_pct_final" -ge 85 ]; then
        {
            echo "WARNING: Root disk still at ${usage_pct_final}% after aggressive Docker cleanup on $(hostname)."
            echo "Manual investigation required - cleanup may be insufficient."
            echo ""
            df -h /
            echo ""
            sudo docker system df
        } | mail -s "[ALERT] Vibro disk usage still critical after cleanup" "$ALERT_EMAIL"
    fi
fi
