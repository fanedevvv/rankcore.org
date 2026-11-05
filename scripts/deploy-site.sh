#!/usr/bin/env bash
# Builds the public website (site/, React + Vite) and publishes it for nginx at rankcore.org.
# nginx (www-data) cannot read inside the Pterodactyl volume, so the built files are copied out.
# Usage (as root on the host): bash scripts/deploy-site.sh
set -euo pipefail

SITE="$(cd "$(dirname "$0")/.." && pwd)/site"
DEST="/var/www/rankcore.org-site/"

cd "$SITE"
[ -d node_modules ] || npm ci --no-audit --no-fund
npm run build

mkdir -p "$DEST"
rsync -a --delete --chmod=D755,F644 "$SITE/dist/" "$DEST"
chown -R www-data:www-data "$DEST"
echo "Site deployed: $SITE/dist -> $DEST"
