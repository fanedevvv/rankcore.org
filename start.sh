#!/usr/bin/env bash
# Pornește botul, dashboard-ul și managerul CB după ce .env are datele de Discord.
set -e
cd "$(dirname "$0")"
missing=()
for k in token clientId CLIENT_SECRET OWNER_ID; do
  grep -qE "^${k}=.+" .env || missing+=("$k")
done
if [ ${#missing[@]} -gt 0 ]; then
  echo "Lipsesc din .env: ${missing[*]}"; exit 1
fi
pm2 startOrRestart ecosystem.config.js --update-env
pm2 save
