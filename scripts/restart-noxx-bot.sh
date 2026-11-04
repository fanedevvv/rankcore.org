#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# restart-noxx-bot.sh
#
# Restarts ONLY noxx-bot (and optionally noxx-dashboard) on server 1.
# NEVER touches noxx-cb — CB bots live on a separate VPS and must not be
# restarted or signalled from this script.
#
# Usage:
#   ./restart-noxx-bot.sh           # restart bot only
#   ./restart-noxx-bot.sh --all     # restart bot + dashboard
#
# Deploy from server 1 only. Never run pm2 restart all — that could
# inadvertently restart noxx-cb if it somehow ends up in this PM2 instance.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BOT_DIR="/bots/Noxx"
RESTART_DASHBOARD=false

for arg in "$@"; do
  case "$arg" in
    --all) RESTART_DASHBOARD=true ;;
    *)     echo "Unknown argument: $arg"; exit 1 ;;
  esac
done

echo "→ Restarting noxx-bot..."
sudo -u f34r pm2 restart noxx-bot --update-env

if [ "$RESTART_DASHBOARD" = true ]; then
  echo "→ Restarting noxx-dashboard..."
  sudo -u f34r pm2 restart noxx-dashboard --update-env
fi

echo "✓ Done. CB bots on server 2 are unaffected."