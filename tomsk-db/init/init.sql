-- init.sql — обновлённый дамп для Tomsk4everyone
-- Совместим с PostgreSQL 16

-- =========================
-- Создаём роли приложения
-- =========================
DO
$$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'tomsk_app') THEN
        CREATE ROLE tomsk_app WITH LOGIN PASSWORD 'tomsk_app_password';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'site_user') THEN
        CREATE ROLE site_user WITH LOGIN PASSWORD 'site_user_password';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'site_moderator') THEN
        CREATE ROLE site_moderator WITH LOGIN PASSWORD 'site_moderator_password';
    END IF;

    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'site_admin') THEN
        CREATE ROLE site_admin WITH LOGIN PASSWORD 'site_admin_password';
    END IF;
END
$$;


-- ---------------------------------------------------------------------------
-- Общие настройки сессии (исправленные)
-- ---------------------------------------------------------------------------
SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- =====================================================================
-- Функция update_timestamp()
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;

ALTER FUNCTION public.update_timestamp() OWNER TO postgres;


-- =====================================================================
-- Таблицы
-- =====================================================================

-- --------------------
-- articles
-- --------------------
CREATE TABLE IF NOT EXISTS public.articles (
    id integer NOT NULL,
    title text NOT NULL,
    slug text NOT NULL,
    author_id integer,
    body text NOT NULL,
    rating integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE public.articles OWNER TO tomsk_app;

CREATE SEQUENCE IF NOT EXISTS public.articles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.articles_id_seq OWNER TO tomsk_app;
ALTER SEQUENCE public.articles_id_seq OWNED BY public.articles.id;
ALTER TABLE ONLY public.articles ALTER COLUMN id SET DEFAULT nextval('public.articles_id_seq'::regclass);

-- Уникальный слаг
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'articles_slug_key' AND conrelid = 'public.articles'::regclass
    ) THEN
        ALTER TABLE ONLY public.articles ADD CONSTRAINT articles_slug_key UNIQUE (slug);
    END IF;
END $$;

-- Первичный ключ
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'articles_pkey' AND conrelid = 'public.articles'::regclass
    ) THEN
        ALTER TABLE ONLY public.articles ADD CONSTRAINT articles_pkey PRIMARY KEY (id);
    END IF;
END $$;


-- --------------------
-- bonuses
-- --------------------
CREATE TABLE IF NOT EXISTS public.bonuses (
    id integer NOT NULL,
    sponsor_id integer,
    title text NOT NULL,
    description text,
    price integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bonuses_price_check CHECK ((price > 0))
);
ALTER TABLE public.bonuses OWNER TO tomsk_app;

CREATE SEQUENCE IF NOT EXISTS public.bonuses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.bonuses_id_seq OWNER TO tomsk_app;
ALTER SEQUENCE public.bonuses_id_seq OWNED BY public.bonuses.id;
ALTER TABLE ONLY public.bonuses ALTER COLUMN id SET DEFAULT nextval('public.bonuses_id_seq'::regclass);

-- Первичный ключ
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'bonuses_pkey' AND conrelid = 'public.bonuses'::regclass
    ) THEN
        ALTER TABLE ONLY public.bonuses ADD CONSTRAINT bonuses_pkey PRIMARY KEY (id);
    END IF;
END $$;


-- --------------------
-- comments
-- --------------------
CREATE TABLE IF NOT EXISTS public.comments (
    id integer NOT NULL,
    article_id integer,
    user_id integer,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.comments OWNER TO tomsk_app;

CREATE SEQUENCE IF NOT EXISTS public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.comments_id_seq OWNER TO tomsk_app;
ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;
ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);

-- Первичный ключ
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'comments_pkey' AND conrelid = 'public.comments'::regclass
    ) THEN
        ALTER TABLE ONLY public.comments ADD CONSTRAINT comments_pkey PRIMARY KEY (id);
    END IF;
END $$;


-- --------------------
-- tasks
-- --------------------
CREATE TABLE IF NOT EXISTS public.tasks (
    id integer NOT NULL,
    title text NOT NULL,
    description text,
    cost integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    task_type text,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT tasks_cost_check CHECK ((cost > 0))
);
ALTER TABLE public.tasks OWNER TO tomsk_app;

CREATE SEQUENCE IF NOT EXISTS public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.tasks_id_seq OWNER TO tomsk_app;
ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;
ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);

-- Первичный ключ
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'tasks_pkey' AND conrelid = 'public.tasks'::regclass
    ) THEN
        ALTER TABLE ONLY public.tasks ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);
    END IF;
END $$;

-- наследуемые таблицы
CREATE TABLE IF NOT EXISTS public.full_answer_tasks (
    expected_answer text
) INHERITS (public.tasks);
ALTER TABLE public.full_answer_tasks OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.photo_tasks (
    expected_location text,
    example_photo_url text
) INHERITS (public.tasks);
ALTER TABLE public.photo_tasks OWNER TO postgres;

CREATE TABLE IF NOT EXISTS public.test_tasks (
    options text[],
    correct_option integer
) INHERITS (public.tasks);
ALTER TABLE public.test_tasks OWNER TO postgres;


-- --------------------
-- sponsors
-- --------------------
CREATE TABLE IF NOT EXISTS public.sponsors (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.sponsors OWNER TO tomsk_app;

CREATE SEQUENCE IF NOT EXISTS public.sponsors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.sponsors_id_seq OWNER TO tomsk_app;
ALTER SEQUENCE public.sponsors_id_seq OWNED BY public.sponsors.id;
ALTER TABLE ONLY public.sponsors ALTER COLUMN id SET DEFAULT nextval('public.sponsors_id_seq'::regclass);

-- Первичный ключ
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'sponsors_pkey' AND conrelid = 'public.sponsors'::regclass
    ) THEN
        ALTER TABLE ONLY public.sponsors ADD CONSTRAINT sponsors_pkey PRIMARY KEY (id);
    END IF;
END $$;


-- --------------------
-- user_bonuses
-- --------------------
CREATE TABLE IF NOT EXISTS public.user_bonuses (
    id integer NOT NULL,
    user_id integer,
    bonus_id integer,
    purchased_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.user_bonuses OWNER TO tomsk_app;

CREATE SEQUENCE IF NOT EXISTS public.user_bonuses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.user_bonuses_id_seq OWNER TO tomsk_app;
ALTER SEQUENCE public.user_bonuses_id_seq OWNED BY public.user_bonuses.id;
ALTER TABLE ONLY public.user_bonuses ALTER COLUMN id SET DEFAULT nextval('public.user_bonuses_id_seq'::regclass);

-- Первичный ключ
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_bonuses_pkey' AND conrelid = 'public.user_bonuses'::regclass
    ) THEN
        ALTER TABLE ONLY public.user_bonuses ADD CONSTRAINT user_bonuses_pkey PRIMARY KEY (id);
    END IF;
END $$;


-- --------------------
-- user_tasks
-- --------------------
CREATE TABLE IF NOT EXISTS public.user_tasks (
    id integer NOT NULL,
    user_id integer,
    task_id integer,
    completed_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.user_tasks OWNER TO tomsk_app;

CREATE SEQUENCE IF NOT EXISTS public.user_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.user_tasks_id_seq OWNER TO tomsk_app;
ALTER SEQUENCE public.user_tasks_id_seq OWNED BY public.user_tasks.id;
ALTER TABLE ONLY public.user_tasks ALTER COLUMN id SET DEFAULT nextval('public.user_tasks_id_seq'::regclass);

-- Первичный ключ и уникальное ограничение
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_tasks_pkey' AND conrelid = 'public.user_tasks'::regclass
    ) THEN
        ALTER TABLE ONLY public.user_tasks ADD CONSTRAINT user_tasks_pkey PRIMARY KEY (id);
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_tasks_user_id_task_id_key' AND conrelid = 'public.user_tasks'::regclass
    ) THEN
        ALTER TABLE ONLY public.user_tasks ADD CONSTRAINT user_tasks_user_id_task_id_key UNIQUE (user_id, task_id);
    END IF;
END $$;


-- --------------------
-- users
-- --------------------
CREATE TABLE IF NOT EXISTS public.users (
    id integer NOT NULL,
    username text,
    email text,
    password_hash text,
    role text DEFAULT 'site_user'::text CHECK (role IN ('site_user','site_moderator','site_admin')),
    avatar_url text DEFAULT '/Img/default-avatar.png',
    created_at timestamp with time zone DEFAULT now(),
    balance integer DEFAULT 0
);
ALTER TABLE public.users OWNER TO tomsk_app;

CREATE SEQUENCE IF NOT EXISTS public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.users_id_seq OWNER TO tomsk_app;
ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;
ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);

-- Первичный ключ
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'users_pkey' AND conrelid = 'public.users'::regclass
    ) THEN
        ALTER TABLE ONLY public.users ADD CONSTRAINT users_pkey PRIMARY KEY (id);
    END IF;
END $$;

-- Уникальный индекс для username
CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON public.users ((lower(username)));

-- =====================================================================
-- article_ratings + функция/триггер пересчёта
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.article_ratings (
    id integer NOT NULL,
    user_id integer NOT NULL,
    article_id integer NOT NULL,
    value integer NOT NULL CHECK (value IN (-1, 1)),
    created_at timestamp with time zone DEFAULT now()
);
ALTER TABLE public.article_ratings OWNER TO tomsk_app;

CREATE SEQUENCE IF NOT EXISTS public.article_ratings_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;
ALTER SEQUENCE public.article_ratings_id_seq OWNER TO tomsk_app;
ALTER SEQUENCE public.article_ratings_id_seq OWNED BY public.article_ratings.id;
ALTER TABLE ONLY public.article_ratings ALTER COLUMN id SET DEFAULT nextval('public.article_ratings_id_seq'::regclass);

-- Первичный ключ
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'article_ratings_pkey' AND conrelid = 'public.article_ratings'::regclass
    ) THEN
        ALTER TABLE ONLY public.article_ratings ADD CONSTRAINT article_ratings_pkey PRIMARY KEY (id);
    END IF;
END $$;

-- Уникальность (user_id, article_id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'article_ratings_user_article_key' AND conrelid = 'public.article_ratings'::regclass
    ) THEN
        ALTER TABLE public.article_ratings ADD CONSTRAINT article_ratings_user_article_key UNIQUE (user_id, article_id);
    END IF;
END$$;

-- Индексы
CREATE INDEX IF NOT EXISTS idx_article_ratings_article_id ON public.article_ratings (article_id);
CREATE INDEX IF NOT EXISTS idx_article_ratings_user_id ON public.article_ratings (user_id);

-- Функция пересчёта рейтинга
CREATE OR REPLACE FUNCTION public.update_article_rating() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    aid integer;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        aid := OLD.article_id;
    ELSE
        aid := NEW.article_id;
    END IF;

    UPDATE public.articles
    SET rating = COALESCE((SELECT SUM(value) FROM public.article_ratings WHERE article_id = aid), 0),
        updated_at = now()
    WHERE id = aid;

    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$;

ALTER FUNCTION public.update_article_rating() OWNER TO tomsk_app;

-- Триггер
DROP TRIGGER IF EXISTS trg_article_rating_update ON public.article_ratings;
CREATE TRIGGER trg_article_rating_update
AFTER INSERT OR UPDATE OR DELETE ON public.article_ratings
FOR EACH ROW
EXECUTE FUNCTION public.update_article_rating();

-- =====================================================================
-- Внешние ключи
-- =====================================================================

-- articles.author_id -> users.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'articles_author_id_fkey' AND conrelid = 'public.articles'::regclass
    ) THEN
        ALTER TABLE ONLY public.articles ADD CONSTRAINT articles_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;
    END IF;
END $$;

-- comments.article_id -> articles.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'comments_article_id_fkey' AND conrelid = 'public.comments'::regclass
    ) THEN
        ALTER TABLE ONLY public.comments ADD CONSTRAINT comments_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- comments.user_id -> users.id
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'comments_user_id_fkey' AND conrelid = 'public.comments'::regclass
    ) THEN
        ALTER TABLE ONLY public.comments ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- user_bonuses foreign keys
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_bonuses_user_id_fkey' AND conrelid = 'public.user_bonuses'::regclass
    ) THEN
        ALTER TABLE ONLY public.user_bonuses ADD CONSTRAINT user_bonuses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_bonuses_bonus_id_fkey' AND conrelid = 'public.user_bonuses'::regclass
    ) THEN
        ALTER TABLE ONLY public.user_bonuses ADD CONSTRAINT user_bonuses_bonus_id_fkey FOREIGN KEY (bonus_id) REFERENCES public.bonuses(id) ON DELETE CASCADE;
    END IF;
END $$;

-- user_tasks foreign keys
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_tasks_user_id_fkey' AND conrelid = 'public.user_tasks'::regclass
    ) THEN
        ALTER TABLE ONLY public.user_tasks ADD CONSTRAINT user_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'user_tasks_task_id_fkey' AND conrelid = 'public.user_tasks'::regclass
    ) THEN
        ALTER TABLE ONLY public.user_tasks ADD CONSTRAINT user_tasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;
    END IF;
END $$;

-- article_ratings foreign keys
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'article_ratings_user_id_fkey' AND conrelid = 'public.article_ratings'::regclass
    ) THEN
        ALTER TABLE ONLY public.article_ratings ADD CONSTRAINT article_ratings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'article_ratings_article_id_fkey' AND conrelid = 'public.article_ratings'::regclass
    ) THEN
        ALTER TABLE ONLY public.article_ratings ADD CONSTRAINT article_ratings_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;
    END IF;
END $$;

-- =====================================================================
-- Триггер для tasks
-- =====================================================================
DROP TRIGGER IF EXISTS update_tasks_modtime ON public.tasks;
CREATE TRIGGER update_tasks_modtime BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();

-- =====================================================================
-- Права доступа
-- =====================================================================

GRANT USAGE ON SCHEMA public TO site_user;
GRANT USAGE ON SCHEMA public TO site_moderator;
GRANT USAGE ON SCHEMA public TO site_admin;

GRANT SELECT ON TABLE public.articles TO site_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.articles TO site_moderator;
GRANT ALL ON TABLE public.articles TO site_admin;
GRANT ALL ON SEQUENCE public.articles_id_seq TO site_admin;

GRANT SELECT ON TABLE public.bonuses TO site_user;
GRANT ALL ON TABLE public.bonuses TO site_admin;
GRANT ALL ON SEQUENCE public.bonuses_id_seq TO site_admin;

GRANT SELECT,INSERT ON TABLE public.comments TO site_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.comments TO site_moderator;
GRANT ALL ON TABLE public.comments TO site_admin;
GRANT ALL ON SEQUENCE public.comments_id_seq TO site_admin;

GRANT SELECT ON TABLE public.tasks TO site_user;
GRANT ALL ON TABLE public.tasks TO site_admin;
GRANT ALL ON SEQUENCE public.tasks_id_seq TO site_admin;

GRANT SELECT ON TABLE public.full_answer_tasks TO site_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.full_answer_tasks TO site_moderator;
GRANT ALL ON TABLE public.full_answer_tasks TO site_admin;

GRANT SELECT ON TABLE public.photo_tasks TO site_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.photo_tasks TO site_moderator;
GRANT ALL ON TABLE public.photo_tasks TO site_admin;

GRANT SELECT ON TABLE public.sponsors TO site_user;
GRANT ALL ON TABLE public.sponsors TO site_admin;
GRANT ALL ON SEQUENCE public.sponsors_id_seq TO site_admin;

GRANT INSERT ON TABLE public.user_bonuses TO site_user;
GRANT ALL ON TABLE public.user_bonuses TO site_admin;
GRANT ALL ON SEQUENCE public.user_bonuses_id_seq TO site_admin;

GRANT INSERT ON TABLE public.user_tasks TO site_user;
GRANT ALL ON TABLE public.user_tasks TO site_admin;
GRANT ALL ON SEQUENCE public.user_tasks_id_seq TO site_admin;

GRANT ALL ON TABLE public.users TO site_admin;
GRANT ALL ON SEQUENCE public.users_id_seq TO site_admin;

-- права на article_ratings
GRANT SELECT,INSERT,UPDATE ON TABLE public.article_ratings TO site_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.article_ratings TO site_moderator;
GRANT ALL ON TABLE public.article_ratings TO site_admin;
GRANT ALL ON SEQUENCE public.article_ratings_id_seq TO site_admin;

-- DEFAULT PRIVILEGES
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO site_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO site_moderator;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO site_admin;

-- =====================================================================
-- Тестовые данные
-- =====================================================================

-- Добавим администратора, модератора и тестового пользователя
INSERT INTO public.users (username, password_hash, email, role, avatar_url)
SELECT * FROM (VALUES
    ('Главный Админ', '$6$0Z80...examplehash', 'admin@example.com', 'site_admin', '/Img/admin-avatar.png'),
    ('moder', '$6$0Z80...examplehash2', 'moder@example.com', 'site_moderator', '/Img/mod-avatar.png'),
    ('gleb', '$6$0Z80...examplehash3', 'gleb@example.com', 'site_user', '/Img/gleb-avatar.png')
) AS v(username,password_hash,email,role,avatar_url)
WHERE NOT EXISTS (SELECT 1 FROM public.users u WHERE u.email = v.email);

-- Добавим пару статей
INSERT INTO public.articles (title, slug, author_id, body)
SELECT * FROM (VALUES
    ('Лагерный сад: парк памяти и свиданий', 'lagernyi-sad', (SELECT id FROM public.users WHERE username = 'gleb' LIMIT 1), 'Парк с лучшей панорамой на Томь...'),
    ('ТУСУР: университет инженеров будущего', 'tusur-univer', (SELECT id FROM public.users WHERE username = 'gleb' LIMIT 1), 'Технологический драйвер Томска...')
) AS v(title,slug,author_id,body)
WHERE NOT EXISTS (SELECT 1 FROM public.articles WHERE slug = v.slug);

-- Добавим тестовые комментарии
INSERT INTO public.comments (article_id, user_id, body)
SELECT a.id, u.id, 'Отличная статья!'
FROM public.articles a
JOIN public.users u ON u.username = 'gleb'
WHERE NOT EXISTS (SELECT 1 FROM public.comments c WHERE c.article_id = a.id AND c.user_id = u.id LIMIT 1)
LIMIT 3;

-- =====================================================================
-- Финальная корректировка рейтингов
-- =====================================================================
UPDATE public.articles
SET rating = COALESCE((
    SELECT SUM(ar.value) FROM public.article_ratings ar WHERE ar.article_id = public.articles.id
), 0);