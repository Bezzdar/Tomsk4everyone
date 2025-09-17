-- ---------------------------
-- 1. USERS
-- ---------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    balance INT DEFAULT 0,
    role TEXT DEFAULT 'user',  -- user, moderator, admin
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------
-- 2. TASKS (общие)
-- ---------------------------
CREATE TABLE IF NOT EXISTS tasks (
    task_id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    points INT DEFAULT 0,
    task_type TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------
-- 3. TASKS наследники
-- ---------------------------
CREATE TABLE IF NOT EXISTS test_tasks (
    options TEXT[],             
    correct_option INT
) INHERITS (tasks);

CREATE TABLE IF NOT EXISTS full_answer_tasks (
    expected_answer TEXT
) INHERITS (tasks);

CREATE TABLE IF NOT EXISTS photo_tasks (
    expected_location TEXT,
    example_photo_url TEXT
) INHERITS (tasks);

-- Дефолтные значения task_type
ALTER TABLE test_tasks ALTER COLUMN task_type SET DEFAULT 'test';
ALTER TABLE full_answer_tasks ALTER COLUMN task_type SET DEFAULT 'full_answer';
ALTER TABLE photo_tasks ALTER COLUMN task_type SET DEFAULT 'photo';

-- Варианты для тестов
CREATE TABLE IF NOT EXISTS task_options (
    id SERIAL PRIMARY KEY,
    task_id INTEGER REFERENCES tasks(task_id) ON DELETE CASCADE,
    option_text TEXT NOT NULL,
    is_correct BOOLEAN DEFAULT false
);

-- ---------------------------
-- 4. ARTICLES
-- ---------------------------
CREATE TABLE IF NOT EXISTS articles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    author_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
    body TEXT NOT NULL,
    rating INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------
-- 5. COMMENTS
-- ---------------------------
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------
-- 6. USER_TASKS и ответы пользователей
-- ---------------------------
CREATE TABLE IF NOT EXISTS user_tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    task_id INTEGER REFERENCES tasks(task_id) ON DELETE CASCADE,
    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, task_id)
);

CREATE TABLE IF NOT EXISTS user_task_answers (
    id SERIAL PRIMARY KEY,
    user_task_id INTEGER REFERENCES user_tasks(id) ON DELETE CASCADE,
    answer_text TEXT,
    answer_file TEXT
);

-- ---------------------------
-- 7. SPONSORS и BONUSES
-- ---------------------------
CREATE TABLE IF NOT EXISTS sponsors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bonuses (
    id SERIAL PRIMARY KEY,
    sponsor_id INTEGER REFERENCES sponsors(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_bonuses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
    bonus_id INTEGER REFERENCES bonuses(id) ON DELETE CASCADE,
    purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------
-- 8. РОЛИ
-- ---------------------------
CREATE ROLE site_user NOINHERIT;
CREATE ROLE site_moderator NOINHERIT;
CREATE ROLE site_admin NOINHERIT;

GRANT CONNECT ON DATABASE tomsk_for_all TO site_user, site_moderator, site_admin;
GRANT USAGE ON SCHEMA public TO site_user, site_moderator, site_admin;

GRANT SELECT ON articles, comments, tasks, bonuses, sponsors TO site_user;
GRANT INSERT ON comments, user_tasks, user_bonuses TO site_user;

GRANT SELECT, INSERT, UPDATE, DELETE ON comments, articles TO site_moderator;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO site_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO site_admin;

-- ---------------------------
-- 9. Триггер для updated_at
-- ---------------------------
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_tasks_modtime ON tasks;

CREATE TRIGGER update_tasks_modtime
BEFORE UPDATE ON tasks
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
