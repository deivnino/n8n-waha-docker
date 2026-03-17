-- ===========================================
-- Migration: Align DB with CLAUDE.md schema
-- Executed: 2026-03-16
-- ===========================================

BEGIN;

-- 1. ALTER chat_control: add missing columns
ALTER TABLE chat_control
  ADD COLUMN IF NOT EXISTS daily_counter INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_human_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS auth_token UUID,
  ADD COLUMN IF NOT EXISTS waha_session_id TEXT,
  ADD COLUMN IF NOT EXISTS client_name TEXT,
  ADD COLUMN IF NOT EXISTS client_logo_url TEXT;

-- 2. CREATE processing_locks (Velocity Gate)
CREATE TABLE IF NOT EXISTS processing_locks (
    phone_number TEXT PRIMARY KEY,
    locked_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    workflow_id  TEXT
);

-- 3. CREATE message_queue
CREATE TABLE IF NOT EXISTS message_queue (
    id           SERIAL PRIMARY KEY,
    phone_number TEXT,
    message_body TEXT,
    queued_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed    BOOLEAN DEFAULT FALSE
);

-- 4. CREATE system_logs
CREATE TABLE IF NOT EXISTS system_logs (
    id         SERIAL PRIMARY KEY,
    severity   TEXT,
    component  TEXT,
    message    TEXT,
    details    JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
