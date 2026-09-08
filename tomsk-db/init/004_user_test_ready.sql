-- User-test-ready migration.
-- Keeps the first external test intentionally small and explicit.

ALTER TABLE public.tasks
    ADD COLUMN IF NOT EXISTS slug text,
    ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

CREATE UNIQUE INDEX IF NOT EXISTS tasks_slug_idx
    ON public.tasks (slug)
    WHERE slug IS NOT NULL;

INSERT INTO public.tasks (title, description, cost, task_type, slug, active)
SELECT * FROM (VALUES
    ('Тест «Легенды Томска»', 'Ответьте на вопросы о легендах Томска.', 25, 'quiz', 'quiz-legends', true),
    ('Фотоохота: найди улицу Чехова', 'Сделайте фото по условиям задания.', 40, 'manual', 'photohunt-chekhov', true),
    ('Истории жителей', 'Расскажите о любимом месте Томска.', 35, 'manual', 'stories-open', true)
) AS seed(title, description, cost, task_type, slug, active)
WHERE NOT EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.slug = seed.slug
);

-- Existing completion table already protects this at application level;
-- the unique index keeps the invariant true under concurrent requests too.
CREATE UNIQUE INDEX IF NOT EXISTS user_task_completions_user_slug_idx
    ON public.user_task_completions (user_id, task_slug);

-- Legacy database roles are labels from an earlier design and are not used
-- for per-request authorization. Prevent accidental direct logins.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'site_user') THEN
        ALTER ROLE site_user NOLOGIN;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'site_moderator') THEN
        ALTER ROLE site_moderator NOLOGIN;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'site_admin') THEN
        ALTER ROLE site_admin NOLOGIN;
    END IF;
END
$$;
