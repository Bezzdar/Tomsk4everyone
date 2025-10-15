-- Ensure required application roles exist
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
-- Restored database structure and permissions
-- ---------------------------------------------------------------------------
--
-- PostgreSQL database dump
--

\restrict Gd8r39z3jLXPdXW33wong3JzJCT20oGF2m0s4oQesK0E1PS5MxUfxxdFT83dXK2

-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: update_timestamp(); Type: FUNCTION; Schema: public; Owner: postgres
--

CREATE FUNCTION public.update_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_timestamp() OWNER TO postgres;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: articles; Type: TABLE; Schema: public; Owner: tomsk_app
--

CREATE TABLE public.articles (
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

--
-- Name: articles_id_seq; Type: SEQUENCE; Schema: public; Owner: tomsk_app
--

CREATE SEQUENCE public.articles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.articles_id_seq OWNER TO tomsk_app;

--
-- Name: articles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tomsk_app
--

ALTER SEQUENCE public.articles_id_seq OWNED BY public.articles.id;


--
-- Name: bonuses; Type: TABLE; Schema: public; Owner: tomsk_app
--

CREATE TABLE public.bonuses (
    id integer NOT NULL,
    sponsor_id integer,
    title text NOT NULL,
    description text,
    price integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT bonuses_price_check CHECK ((price > 0))
);


ALTER TABLE public.bonuses OWNER TO tomsk_app;

--
-- Name: bonuses_id_seq; Type: SEQUENCE; Schema: public; Owner: tomsk_app
--

CREATE SEQUENCE public.bonuses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.bonuses_id_seq OWNER TO tomsk_app;

--
-- Name: bonuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tomsk_app
--

ALTER SEQUENCE public.bonuses_id_seq OWNED BY public.bonuses.id;


--
-- Name: comments; Type: TABLE; Schema: public; Owner: tomsk_app
--

CREATE TABLE public.comments (
    id integer NOT NULL,
    article_id integer,
    user_id integer,
    body text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.comments OWNER TO tomsk_app;

--
-- Name: comments_id_seq; Type: SEQUENCE; Schema: public; Owner: tomsk_app
--

CREATE SEQUENCE public.comments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comments_id_seq OWNER TO tomsk_app;

--
-- Name: comments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tomsk_app
--

ALTER SEQUENCE public.comments_id_seq OWNED BY public.comments.id;


--
-- Name: tasks; Type: TABLE; Schema: public; Owner: tomsk_app
--

CREATE TABLE public.tasks (
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

--
-- Name: full_answer_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.full_answer_tasks (
    expected_answer text
)
INHERITS (public.tasks);


ALTER TABLE public.full_answer_tasks OWNER TO postgres;

--
-- Name: photo_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.photo_tasks (
    expected_location text,
    example_photo_url text
)
INHERITS (public.tasks);


ALTER TABLE public.photo_tasks OWNER TO postgres;

--
-- Name: sponsors; Type: TABLE; Schema: public; Owner: tomsk_app
--

CREATE TABLE public.sponsors (
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.sponsors OWNER TO tomsk_app;

--
-- Name: sponsors_id_seq; Type: SEQUENCE; Schema: public; Owner: tomsk_app
--

CREATE SEQUENCE public.sponsors_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.sponsors_id_seq OWNER TO tomsk_app;

--
-- Name: sponsors_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tomsk_app
--

ALTER SEQUENCE public.sponsors_id_seq OWNED BY public.sponsors.id;


--
-- Name: tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: tomsk_app
--

CREATE SEQUENCE public.tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tasks_id_seq OWNER TO tomsk_app;

--
-- Name: tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tomsk_app
--

ALTER SEQUENCE public.tasks_id_seq OWNED BY public.tasks.id;


--
-- Name: test_tasks; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.test_tasks (
    options text[],
    correct_option integer
)
INHERITS (public.tasks);


ALTER TABLE public.test_tasks OWNER TO postgres;

--
-- Name: user_bonuses; Type: TABLE; Schema: public; Owner: tomsk_app
--

CREATE TABLE public.user_bonuses (
    id integer NOT NULL,
    user_id integer,
    bonus_id integer,
    purchased_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_bonuses OWNER TO tomsk_app;

--
-- Name: user_bonuses_id_seq; Type: SEQUENCE; Schema: public; Owner: tomsk_app
--

CREATE SEQUENCE public.user_bonuses_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_bonuses_id_seq OWNER TO tomsk_app;

--
-- Name: user_bonuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tomsk_app
--

ALTER SEQUENCE public.user_bonuses_id_seq OWNED BY public.user_bonuses.id;


--
-- Name: user_tasks; Type: TABLE; Schema: public; Owner: tomsk_app
--

CREATE TABLE public.user_tasks (
    id integer NOT NULL,
    user_id integer,
    task_id integer,
    completed_at timestamp with time zone DEFAULT now()
);


ALTER TABLE public.user_tasks OWNER TO tomsk_app;

--
-- Name: user_tasks_id_seq; Type: SEQUENCE; Schema: public; Owner: tomsk_app
--

CREATE SEQUENCE public.user_tasks_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_tasks_id_seq OWNER TO tomsk_app;

--
-- Name: user_tasks_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tomsk_app
--

ALTER SEQUENCE public.user_tasks_id_seq OWNED BY public.user_tasks.id;


--
-- Name: users; Type: TABLE; Schema: public; Owner: tomsk_app
--

CREATE TABLE public.users (
    id integer NOT NULL,
    username text,
    email text,
    password_hash text,
    role text DEFAULT 'reader'::text,
    created_at timestamp with time zone DEFAULT now(),
    balance integer DEFAULT 0
);


ALTER TABLE public.users OWNER TO tomsk_app;

--
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: tomsk_app
--

CREATE SEQUENCE public.users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_id_seq OWNER TO tomsk_app;

--
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: tomsk_app
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- Name: articles id; Type: DEFAULT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.articles ALTER COLUMN id SET DEFAULT nextval('public.articles_id_seq'::regclass);


--
-- Name: bonuses id; Type: DEFAULT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.bonuses ALTER COLUMN id SET DEFAULT nextval('public.bonuses_id_seq'::regclass);


--
-- Name: comments id; Type: DEFAULT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.comments ALTER COLUMN id SET DEFAULT nextval('public.comments_id_seq'::regclass);


--
-- Name: full_answer_tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.full_answer_tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: full_answer_tasks created_at; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.full_answer_tasks ALTER COLUMN created_at SET DEFAULT now();


--
-- Name: full_answer_tasks task_type; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.full_answer_tasks ALTER COLUMN task_type SET DEFAULT 'full_answer'::text;


--
-- Name: full_answer_tasks updated_at; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.full_answer_tasks ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: photo_tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.photo_tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: photo_tasks created_at; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.photo_tasks ALTER COLUMN created_at SET DEFAULT now();


--
-- Name: photo_tasks task_type; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.photo_tasks ALTER COLUMN task_type SET DEFAULT 'photo'::text;


--
-- Name: photo_tasks updated_at; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.photo_tasks ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: sponsors id; Type: DEFAULT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.sponsors ALTER COLUMN id SET DEFAULT nextval('public.sponsors_id_seq'::regclass);


--
-- Name: tasks id; Type: DEFAULT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: test_tasks id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_tasks ALTER COLUMN id SET DEFAULT nextval('public.tasks_id_seq'::regclass);


--
-- Name: test_tasks created_at; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_tasks ALTER COLUMN created_at SET DEFAULT now();


--
-- Name: test_tasks task_type; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_tasks ALTER COLUMN task_type SET DEFAULT 'test'::text;


--
-- Name: test_tasks updated_at; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.test_tasks ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP;


--
-- Name: user_bonuses id; Type: DEFAULT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.user_bonuses ALTER COLUMN id SET DEFAULT nextval('public.user_bonuses_id_seq'::regclass);


--
-- Name: user_tasks id; Type: DEFAULT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.user_tasks ALTER COLUMN id SET DEFAULT nextval('public.user_tasks_id_seq'::regclass);


--
-- Name: users id; Type: DEFAULT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- Data for Name: articles; Type: TABLE DATA; Schema: public; Owner: tomsk_app
--

COPY public.articles (id, title, slug, author_id, body, rating, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: bonuses; Type: TABLE DATA; Schema: public; Owner: tomsk_app
--

COPY public.bonuses (id, sponsor_id, title, description, price, created_at) FROM stdin;
\.


--
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: tomsk_app
--

COPY public.comments (id, article_id, user_id, body, created_at) FROM stdin;
\.


--
-- Data for Name: full_answer_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.full_answer_tasks (id, title, description, cost, created_at, task_type, updated_at, expected_answer) FROM stdin;
\.


--
-- Data for Name: photo_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.photo_tasks (id, title, description, cost, created_at, task_type, updated_at, expected_location, example_photo_url) FROM stdin;
\.


--
-- Data for Name: sponsors; Type: TABLE DATA; Schema: public; Owner: tomsk_app
--

COPY public.sponsors (id, name, description, created_at) FROM stdin;
\.


--
-- Data for Name: tasks; Type: TABLE DATA; Schema: public; Owner: tomsk_app
--

COPY public.tasks (id, title, description, cost, created_at, task_type, updated_at) FROM stdin;
\.


--
-- Data for Name: test_tasks; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.test_tasks (id, title, description, cost, created_at, task_type, updated_at, options, correct_option) FROM stdin;
\.


--
-- Data for Name: user_bonuses; Type: TABLE DATA; Schema: public; Owner: tomsk_app
--

COPY public.user_bonuses (id, user_id, bonus_id, purchased_at) FROM stdin;
\.


--
-- Data for Name: user_tasks; Type: TABLE DATA; Schema: public; Owner: tomsk_app
--

COPY public.user_tasks (id, user_id, task_id, completed_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: tomsk_app
--

COPY public.users (id, username, email, password_hash, role, created_at, balance) FROM stdin;
\.


--
-- Name: articles_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tomsk_app
--

SELECT pg_catalog.setval('public.articles_id_seq', 1, false);


--
-- Name: bonuses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tomsk_app
--

SELECT pg_catalog.setval('public.bonuses_id_seq', 1, false);


--
-- Name: comments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tomsk_app
--

SELECT pg_catalog.setval('public.comments_id_seq', 1, false);


--
-- Name: sponsors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tomsk_app
--

SELECT pg_catalog.setval('public.sponsors_id_seq', 1, false);


--
-- Name: tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tomsk_app
--

SELECT pg_catalog.setval('public.tasks_id_seq', 1, false);


--
-- Name: user_bonuses_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tomsk_app
--

SELECT pg_catalog.setval('public.user_bonuses_id_seq', 1, false);


--
-- Name: user_tasks_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tomsk_app
--

SELECT pg_catalog.setval('public.user_tasks_id_seq', 1, false);


--
-- Name: users_id_seq; Type: SEQUENCE SET; Schema: public; Owner: tomsk_app
--

SELECT pg_catalog.setval('public.users_id_seq', 1, false);


--
-- Name: articles articles_pkey; Type: CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_pkey PRIMARY KEY (id);


--
-- Name: articles articles_slug_key; Type: CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_slug_key UNIQUE (slug);


--
-- Name: bonuses bonuses_pkey; Type: CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.bonuses
    ADD CONSTRAINT bonuses_pkey PRIMARY KEY (id);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: sponsors sponsors_pkey; Type: CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.sponsors
    ADD CONSTRAINT sponsors_pkey PRIMARY KEY (id);


--
-- Name: tasks tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.tasks
    ADD CONSTRAINT tasks_pkey PRIMARY KEY (id);


--
-- Name: user_bonuses user_bonuses_pkey; Type: CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.user_bonuses
    ADD CONSTRAINT user_bonuses_pkey PRIMARY KEY (id);


--
-- Name: user_tasks user_tasks_pkey; Type: CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.user_tasks
    ADD CONSTRAINT user_tasks_pkey PRIMARY KEY (id);


--
-- Name: user_tasks user_tasks_user_id_task_id_key; Type: CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.user_tasks
    ADD CONSTRAINT user_tasks_user_id_task_id_key UNIQUE (user_id, task_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: tasks update_tasks_modtime; Type: TRIGGER; Schema: public; Owner: tomsk_app
--

CREATE TRIGGER update_tasks_modtime BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();


--
-- Name: articles articles_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.articles
    ADD CONSTRAINT articles_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: bonuses bonuses_sponsor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.bonuses
    ADD CONSTRAINT bonuses_sponsor_id_fkey FOREIGN KEY (sponsor_id) REFERENCES public.sponsors(id) ON DELETE CASCADE;


--
-- Name: comments comments_article_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_article_id_fkey FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_bonuses user_bonuses_bonus_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.user_bonuses
    ADD CONSTRAINT user_bonuses_bonus_id_fkey FOREIGN KEY (bonus_id) REFERENCES public.bonuses(id) ON DELETE CASCADE;


--
-- Name: user_bonuses user_bonuses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.user_bonuses
    ADD CONSTRAINT user_bonuses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_tasks user_tasks_task_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.user_tasks
    ADD CONSTRAINT user_tasks_task_id_fkey FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE CASCADE;


--
-- Name: user_tasks user_tasks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: tomsk_app
--

ALTER TABLE ONLY public.user_tasks
    ADD CONSTRAINT user_tasks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: pg_database_owner
--

GRANT USAGE ON SCHEMA public TO site_user;
GRANT USAGE ON SCHEMA public TO site_moderator;
GRANT USAGE ON SCHEMA public TO site_admin;


--
-- Name: TABLE articles; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT SELECT ON TABLE public.articles TO site_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.articles TO site_moderator;
GRANT ALL ON TABLE public.articles TO site_admin;


--
-- Name: SEQUENCE articles_id_seq; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT ALL ON SEQUENCE public.articles_id_seq TO site_admin;


--
-- Name: TABLE bonuses; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT SELECT ON TABLE public.bonuses TO site_user;
GRANT ALL ON TABLE public.bonuses TO site_admin;


--
-- Name: SEQUENCE bonuses_id_seq; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT ALL ON SEQUENCE public.bonuses_id_seq TO site_admin;


--
-- Name: TABLE comments; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT SELECT,INSERT ON TABLE public.comments TO site_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.comments TO site_moderator;
GRANT ALL ON TABLE public.comments TO site_admin;


--
-- Name: SEQUENCE comments_id_seq; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT ALL ON SEQUENCE public.comments_id_seq TO site_admin;


--
-- Name: TABLE tasks; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT SELECT ON TABLE public.tasks TO site_user;
GRANT ALL ON TABLE public.tasks TO site_admin;


--
-- Name: TABLE full_answer_tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.full_answer_tasks TO site_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.full_answer_tasks TO site_moderator;
GRANT ALL ON TABLE public.full_answer_tasks TO site_admin;


--
-- Name: TABLE photo_tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.photo_tasks TO site_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.photo_tasks TO site_moderator;
GRANT ALL ON TABLE public.photo_tasks TO site_admin;


--
-- Name: TABLE sponsors; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT SELECT ON TABLE public.sponsors TO site_user;
GRANT ALL ON TABLE public.sponsors TO site_admin;


--
-- Name: SEQUENCE sponsors_id_seq; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT ALL ON SEQUENCE public.sponsors_id_seq TO site_admin;


--
-- Name: SEQUENCE tasks_id_seq; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT ALL ON SEQUENCE public.tasks_id_seq TO site_admin;


--
-- Name: TABLE test_tasks; Type: ACL; Schema: public; Owner: postgres
--

GRANT SELECT ON TABLE public.test_tasks TO site_user;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.test_tasks TO site_moderator;
GRANT ALL ON TABLE public.test_tasks TO site_admin;


--
-- Name: TABLE user_bonuses; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT INSERT ON TABLE public.user_bonuses TO site_user;
GRANT ALL ON TABLE public.user_bonuses TO site_admin;


--
-- Name: SEQUENCE user_bonuses_id_seq; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT ALL ON SEQUENCE public.user_bonuses_id_seq TO site_admin;


--
-- Name: TABLE user_tasks; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT INSERT ON TABLE public.user_tasks TO site_user;
GRANT ALL ON TABLE public.user_tasks TO site_admin;


--
-- Name: SEQUENCE user_tasks_id_seq; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT ALL ON SEQUENCE public.user_tasks_id_seq TO site_admin;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT ALL ON TABLE public.users TO site_admin;


--
-- Name: SEQUENCE users_id_seq; Type: ACL; Schema: public; Owner: tomsk_app
--

GRANT ALL ON SEQUENCE public.users_id_seq TO site_admin;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: postgres
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT ON TABLES TO site_user;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT SELECT,INSERT,DELETE,UPDATE ON TABLES TO site_moderator;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO site_admin;


--
-- PostgreSQL database dump complete
--

\unrestrict Gd8r39z3jLXPdXW33wong3JzJCT20oGF2m0s4oQesK0E1PS5MxUfxxdFT83dXK2
