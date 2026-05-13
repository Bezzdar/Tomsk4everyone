-- Migration: user_task_completions
-- Stores task completions by string slug so frontend IDs match DB records

CREATE TABLE IF NOT EXISTS user_task_completions (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_slug     TEXT    NOT NULL,
    points_awarded INTEGER NOT NULL DEFAULT 0,
    completed_at  TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, task_slug)
);
