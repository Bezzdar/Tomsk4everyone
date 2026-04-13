-- server_dump.sql
-- Целевой сервер БД/API: 46.17.102.10
-- Применение: psql -h 46.17.102.10 -U postgres -d tomsk -f server_dump.sql

CREATE ROLE tomsk_app WITH LOGIN PASSWORD 'CHANGE_ME_STRONG_PASSWORD';

CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'site_user' CHECK (role IN ('site_user', 'site_moderator', 'site_admin')),
    avatar_url TEXT DEFAULT '/Img/default-avatar.png',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    balance INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.articles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    author_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    tags TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('draft', 'submitted', 'published', 'rejected')),
    rating INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_articles_status_created_at ON public.articles(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_articles_author_id ON public.articles(author_id);

CREATE TABLE IF NOT EXISTS public.user_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    task_id INTEGER NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, task_id)
);

GRANT CONNECT ON DATABASE tomsk TO tomsk_app;
GRANT USAGE ON SCHEMA public TO tomsk_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tomsk_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO tomsk_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO tomsk_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO tomsk_app;
