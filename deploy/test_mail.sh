#!/bin/bash
echo "Test alert from Vibro monitoring setup (Gmail relay) - $(date)" | mail -s "[TEST] Vibro CPU monitor setup" "vibro.chennai@gmail.com"
