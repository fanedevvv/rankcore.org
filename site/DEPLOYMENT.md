# Deployment

This project builds to static files in `dist/` and can be served directly by `nginx`.

## Current situation

- `acsr.ro` is serving the old site directly from `nginx`.
- `yakuza.my` is proxied through Cloudflare, but currently returns the same old site.
- The frontend code in this repository is already prepared for `https://yakuza.my`.

## Build

```sh
npm install
npm run build
```

## Files to publish

Upload the contents of `dist/` to the origin server, for example:

```sh
sudo mkdir -p /var/www/yakuza.my
sudo rsync -av --delete dist/ /var/www/yakuza.my/dist/
```

## Nginx

An example config is available in `deploy/nginx/yakuza.my.conf`.

Expected steps on the server:

```sh
sudo cp deploy/nginx/yakuza.my.conf /etc/nginx/sites-available/yakuza.my.conf
sudo ln -s /etc/nginx/sites-available/yakuza.my.conf /etc/nginx/sites-enabled/yakuza.my.conf
sudo nginx -t
sudo systemctl reload nginx
```

If the server already has TLS configured in `nginx`, duplicate the same `server_name` logic into the existing `443` blocks.

## Cloudflare

Keep the DNS records for `yakuza.my` and `www` pointed to the origin server that serves the files above.

If Cloudflare proxy is enabled, verify the origin is serving the new build correctly before troubleshooting cache.

## Redirect old domain

`acsr.ro` should return a permanent redirect to `https://yakuza.my$request_uri`.

## Verification

After deployment, verify:

```sh
curl -I https://yakuza.my
curl -I https://acsr.ro
curl -s https://yakuza.my | grep -Eo '<title>[^<]+</title>|canonical\" href=\"[^\"]+'
```

Expected result:

- `https://yakuza.my` returns the Yakuza site.
- `https://acsr.ro` returns `301` to `https://yakuza.my`.
- The HTML includes canonical metadata for `https://yakuza.my/`.