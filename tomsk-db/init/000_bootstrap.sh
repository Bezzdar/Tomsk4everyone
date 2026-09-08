#!/bin/sh
set -eu

: "${DB_PASSWORD:?DB_PASSWORD is required}"

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  --set=app_password="$DB_PASSWORD" <<'SQL'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tomsk_app') THEN
        CREATE ROLE tomsk_app LOGIN;
    END IF;
END
$$;

ALTER ROLE tomsk_app WITH LOGIN PASSWORD :'app_password';
SQL
