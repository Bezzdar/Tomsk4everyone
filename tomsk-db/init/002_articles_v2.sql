-- 002_articles_v2.sql
-- Расширение таблицы articles: шаблоны, изображения, модерация, новые статусы
-- Применяется поверх init.sql на новом сервере 77.222.43.106

-- ─── 1. Расширяем таблицу articles ───────────────────────────────────────────

-- Убираем старый CHECK на status и добавляем новый с полным набором статусов
ALTER TABLE public.articles
    DROP CONSTRAINT IF EXISTS articles_status_check;

ALTER TABLE public.articles
    ADD CONSTRAINT articles_status_check
    CHECK (status IN ('draft', 'submitted', 'needs_revision', 'approved', 'published'));

-- Новые поля статьи
ALTER TABLE public.articles
    ADD COLUMN IF NOT EXISTS excerpt       TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS template_type TEXT NOT NULL DEFAULT 'classic'
        CHECK (template_type IN ('classic', 'photoreport', 'route')),
    ADD COLUMN IF NOT EXISTS cover_image   TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS moderator_comment TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS moderated_by  INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS moderated_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS published_at  TIMESTAMPTZ;

-- avatar_url для пользователей (если ещё нет)
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT NULL;

-- ─── 2. Таблица изображений статьи ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.article_images (
    id          SERIAL PRIMARY KEY,
    article_id  INTEGER NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
    url         TEXT NOT NULL,
    caption     TEXT DEFAULT '',
    position    INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.article_images OWNER TO tomsk_app;

CREATE INDEX IF NOT EXISTS idx_article_images_article_id ON public.article_images(article_id);

-- ─── 3. Индексы для производительности ───────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_articles_status     ON public.articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_author_id  ON public.articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_published  ON public.articles(published_at DESC)
    WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_articles_slug       ON public.articles(slug);

-- ─── 4. Права доступа ────────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE ON public.article_images TO tomsk_app;
GRANT USAGE, SELECT ON SEQUENCE public.article_images_id_seq TO tomsk_app;
