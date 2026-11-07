#!/bin/sh
# Daily database backup with automatic clean-up. Run it from cron on the server, for example:
#
#   15 2 * * *  cd /srv/dr-ovi-dental && ./scripts/backup-db.sh >> backups/backup.log 2>&1
#
# With docker-compose.yml (the default) it runs pg_dump inside the database container. Set
# DATABASE_URL instead to back up any other PostgreSQL server with a local pg_dump.
#
# Then copy the backups OFF the server (rclone, rsync, cloud storage): a backup kept only on the
# same disk is lost with that disk. Restore steps are in DEPLOYMENT.md.
set -eu

BACKUP_DIR="${BACKUP_DIR:-./backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
STAMP="$(date +%Y-%m-%d_%H%M)"
FILE="$BACKUP_DIR/dr_ovi_dental_$STAMP.dump"

mkdir -p "$BACKUP_DIR"
umask 077 # patient data: readable by this user only

if [ -n "${DATABASE_URL:-}" ]; then
  pg_dump --format=custom --no-owner --file="$FILE" "$DATABASE_URL"
else
  # Uses POSTGRES_USER / POSTGRES_DB from the container's own environment.
  docker compose exec -T db sh -c 'pg_dump --format=custom --no-owner -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$FILE"
fi

# A dump that is empty or unreadable is worse than none: fail loudly so cron mails the error.
if [ ! -s "$FILE" ]; then
  echo "$(date) backup FAILED: $FILE is empty" >&2
  rm -f "$FILE"
  exit 1
fi

find "$BACKUP_DIR" -name 'dr_ovi_dental_*.dump' -type f -mtime +"$KEEP_DAYS" -delete
echo "$(date) backup OK: $FILE ($(du -h "$FILE" | cut -f1))"
