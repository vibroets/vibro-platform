#!/bin/bash
# Anomaly monitor: detects runaway CPU usage and known cryptominer IOCs.
# Runs via cron every 5 minutes. Sends email via local postfix (best-effort).

ALERT_EMAIL="vibro.chennai@gmail.com"
COOLDOWN_FILE="/tmp/.cpu_alert_cooldown"
COOLDOWN_SECONDS=1800
NPROC=$(nproc)
LOAD_THRESHOLD=$(echo "$NPROC * 1.5" | bc)

now=$(date +%s)
if [ -f "$COOLDOWN_FILE" ]; then
    last=$(cat "$COOLDOWN_FILE")
    diff=$((now - last))
    if [ "$diff" -lt "$COOLDOWN_SECONDS" ]; then
        exit 0
    fi
fi

reasons=""

# 1. Load average anomaly
load1=$(cut -d' ' -f1 /proc/loadavg)
if (( $(echo "$load1 > $LOAD_THRESHOLD" | bc -l) )); then
    reasons="${reasons}High system load: ${load1} (threshold ${LOAD_THRESHOLD}, cores: ${NPROC})\n"
fi

# 2. Per-container CPU anomaly (>150% sustained on a single container)
if command -v docker >/dev/null 2>&1; then
    stats=$(sudo docker stats --no-stream --format "{{.Name}} {{.CPUPerc}}" 2>/dev/null)
    while read -r name cpu; do
        [ -z "$name" ] && continue
        cpu_num=$(echo "$cpu" | tr -d '%')
        if (( $(echo "$cpu_num > 150" | bc -l 2>/dev/null || echo 0) )); then
            reasons="${reasons}Container ${name} at ${cpu}% CPU\n"
        fi
    done <<< "$stats"
fi

# 3. Known cryptominer IOC scan (process names + dropped file patterns seen in prior incident)
suspicious_procs=$(ps -eo comm= | grep -iE "^javae$|^xmrig$" || true)
if [ -n "$suspicious_procs" ]; then
    reasons="${reasons}Suspicious process detected: ${suspicious_procs}\n"
fi

if command -v docker >/dev/null 2>&1; then
    for c in $(sudo docker ps --format "{{.Names}}" 2>/dev/null); do
        hit=$(sudo docker exec "$c" sh -c 'test -d /app/.pm2 && echo found' 2>/dev/null || true)
        if [ -n "$hit" ]; then
            reasons="${reasons}Malware IOC (.pm2 dir) found in container ${c}\n"
        fi
    done
fi

if [ -n "$reasons" ]; then
    echo -e "$now" > "$COOLDOWN_FILE"
    {
        echo "Anomaly detected on $(hostname) at $(date)"
        echo ""
        echo -e "$reasons"
        echo ""
        echo "--- docker stats ---"
        sudo docker stats --no-stream 2>/dev/null
        echo ""
        echo "--- top processes ---"
        ps aux --sort=-%cpu | head -10
    } | mail -s "[ALERT] Vibro server anomaly detected" "$ALERT_EMAIL"
fi
