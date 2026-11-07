# Deploying Dr Ovi's Dental Care

How to put the clinic system on a server, keep it updated, and back it up. The app is one Docker image
plus a PostgreSQL database. It must run as a long-lived server (not serverless functions): the
dashboard's live updates keep a connection open to the browser and to PostgreSQL.

## What you need

- A Linux server with Docker and Docker Compose (2 GB RAM is enough), **or** a managed host that
  runs Dockerfiles (Railway, Render, Fly.io).
- A domain name pointing at the server.
- Node 24 LTS if you build or run without Docker (`.nvmrc`).

## Option A: your own server (VPS) with Docker Compose

1. Copy the project to the server, for example to `/srv/dr-ovi-dental`.
2. Create the settings file and fill it in (each secret is a fresh random value):

   ```bash
   cp .env.production.example .env
   nano .env
   ```

3. Start the database and the app, apply the database migrations, and create the first administrator
   (the seed asks for the password in the terminal):

   ```bash
   docker compose up -d --build
   docker compose run --rm app node_modules/.bin/prisma migrate deploy
   docker compose run --rm app node_modules/.bin/tsx prisma/seed.ts
   ```

4. Check it: `curl http://127.0.0.1:3000/api/health` should print `{"status":"ok"}`.
5. Put HTTPS in front (below), then sign in at `https://your-domain/login`.

### HTTPS with Nginx

The app listens on `127.0.0.1:3000` only. Nginx serves the public HTTPS address and forwards to it.
Get the certificate with `certbot --nginx -d your-domain.example`.

```nginx
server {
    server_name your-domain.example;
    listen 443 ssl;            # certbot fills in the certificate lines
    client_max_body_size 2m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Live dashboard updates: a long-lived stream that must not be buffered or cut off.
    location /api/realtime {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_read_timeout 1h;
    }
}
server {
    listen 80;
    server_name your-domain.example;
    return 301 https://$host$request_uri;
}
```

`TRUSTED_PROXY_HOPS=1` in `.env` matches this setup. If Cloudflare also sits in front, use `2`.

### Updating

```bash
./scripts/backup-db.sh                      # always back up first
git pull                                    # or copy the new files
docker compose up -d --build
docker compose run --rm app node_modules/.bin/prisma migrate deploy
```

## Option B: a managed host (Railway, Render, Fly.io)

- Deploy from the `Dockerfile`. Set the variables from `.env.production.example` in the host's
  settings, with `DATABASE_URL` pointing at a PostgreSQL database.
- Use the database's **direct** connection address, not a "pooler"/PgBouncer address in transaction
  mode: live updates use PostgreSQL `LISTEN`, which a transaction pooler breaks.
- Set the health check path to `/api/health`.
- Run `node_modules/.bin/prisma migrate deploy` as the release/pre-deploy command.
- Create the first administrator once from the host's shell: `node_modules/.bin/tsx prisma/seed.ts`.
- Keep exactly one running copy unless you have tested more (rate limits and live updates are shared
  through the database, but nothing else has been tried with several copies).

## Backups (do this before go-live)

All clinic data is in PostgreSQL; there are no uploaded files on disk.

- **Daily backup:** `scripts/backup-db.sh` writes a compressed dump to `./backups/` and deletes dumps
  older than 30 days. Schedule it with cron:

  ```cron
  15 2 * * *  cd /srv/dr-ovi-dental && ./scripts/backup-db.sh >> backups/backup.log 2>&1
  ```

- **Off the server:** copy `./backups/` somewhere else every day (rclone to cloud storage, or rsync to
  another machine). A backup on the same disk is lost with that disk.
- **Managed database:** turn on the provider's daily backups as well.

### Restoring

Restore into an empty database, then confirm the schema is current:

```bash
docker compose stop app
docker compose exec -T db sh -c 'dropdb -U "$POSTGRES_USER" "$POSTGRES_DB" && createdb -U "$POSTGRES_USER" "$POSTGRES_DB"'
docker compose exec -T db sh -c 'pg_restore --no-owner -U "$POSTGRES_USER" -d "$POSTGRES_DB"' < backups/dr_ovi_dental_YYYY-MM-DD_HHMM.dump
docker compose run --rm app node_modules/.bin/prisma migrate deploy
docker compose start app
```

**Test a restore once before go-live** (into a scratch database or a spare server). A backup that has
never been restored is not yet known to work.

## Monitoring

- Point an uptime monitor (UptimeRobot, Better Stack…) at `https://your-domain/api/health`. It returns
  200 when the app can reach the database and 503 when it cannot.
- Server errors are written to the container log as structured JSON: `docker compose logs -f app`.
  To send them to an error-tracking service, add it in `src/instrumentation.ts` (one place).

## Security notes

- The Content-Security-Policy header is in report-only mode (see `next.config.ts`). After go-live,
  open each page with the browser's developer console open; when no CSP warnings appear, rename the
  header to `Content-Security-Policy` to enforce it.
- `.env` holds the secrets. Keep it readable by the deploying user only (`chmod 600 .env`).
- The database port is not published; only the app container can reach it.

## Go-live checklist

- [ ] `.env` filled in with fresh secrets and the real `https://` domain
- [ ] Migrations applied; first administrator created; SMTP and SMS set up in the dashboard
- [ ] HTTPS working; `http://` redirects to `https://`
- [ ] `/api/health` returns ok; uptime monitor added
- [ ] Daily backup scheduled, copied off the server, and one restore tested
- [ ] Demo data **not** loaded (`db:seed:demo` refuses production, but check)
