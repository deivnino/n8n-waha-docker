-- =============================================================
-- WAHA Bot v0.6 - Migration Script
-- Run this in pgAdmin against your n8n Postgres DB
-- =============================================================

-- 1. CLIENT CONFIG (replaces chat_control)
--    Stores per-client settings, mode, inventory source, concurrency
CREATE TABLE IF NOT EXISTS client_config (
    phone_number        TEXT PRIMARY KEY,
    status              TEXT DEFAULT 'AUTO',           -- 'AUTO' | 'MANUAL' | 'PAUSED'
    is_vip              BOOLEAN DEFAULT FALSE,
    tier                TEXT DEFAULT 'MEDIUM',         -- 'MEDIUM' (WAHA) | 'HIGH' (Official API)

    -- Business hours (JSONB for flexibility)
    -- Example: {"tz":"America/Bogota","schedule":{"1":["08:00","19:00"],"2":["08:00","19:00"],"3":["08:00","19:00"],"4":["08:00","19:00"],"5":["08:00","19:00"],"6":["09:00","14:00"]}}
    -- Keys: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun. Null = closed.
    business_hours      JSONB DEFAULT '{"tz":"America/Bogota","schedule":{"1":["08:00","19:00"],"2":["08:00","19:00"],"3":["08:00","19:00"],"4":["08:00","19:00"],"5":["08:00","19:00"],"6":["09:00","14:00"]}}',
    off_hours_message   TEXT DEFAULT 'Hola! 👋 Estamos fuera de horario. Te respondemos pronto. Nuestro horario es L-V 8am-7pm y S 9am-2pm.',

    -- Inventory source routing (MCP Router)
    -- 'alegra' | 'web_scraper' | 'sheets' | 'mock'
    inventory_source    TEXT DEFAULT 'mock',
    inventory_config    JSONB DEFAULT '{}',
    -- alegra:      {"base_url":"https://api.alegra.com/api/v1","auth_token":"base64(email:token)"}
    -- web_scraper: {"base_url":"https://zamux.co","search_path":"/search","query_param":"q"}
    -- sheets:      {"spreadsheet_id":"xxx","sheet_name":"Inventario","api_key":"xxx"}
    -- mock:        {}

    -- Concurrency control
    max_concurrent      INTEGER DEFAULT 1,   -- Max simultaneous conversations for this client
    
    last_human_msg_at   TIMESTAMP,
    auto_resume_minutes INTEGER DEFAULT 30,  -- Minutes of silence before switching back to AUTO
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. GLOBAL CONCURRENCY COUNTER (one row, shared state)
CREATE TABLE IF NOT EXISTS concurrency_control (
    id              INTEGER PRIMARY KEY DEFAULT 1,
    active_count    INTEGER DEFAULT 0,        -- Current active agent executions
    max_allowed     INTEGER DEFAULT 3,        -- Global max (configurable)
    updated_at      TIMESTAMP DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Seed the single row
INSERT INTO concurrency_control (id, active_count, max_allowed)
VALUES (1, 0, 3)
ON CONFLICT (id) DO NOTHING;

-- 3. MESSAGE QUEUE (for deferred messages when at capacity)
CREATE TABLE IF NOT EXISTS message_queue (
    id              SERIAL PRIMARY KEY,
    phone_number    TEXT NOT NULL,
    chat_id         TEXT NOT NULL,
    message_body    TEXT NOT NULL,
    received_at     TIMESTAMP DEFAULT NOW(),
    processed_at    TIMESTAMP,
    status          TEXT DEFAULT 'PENDING',   -- 'PENDING' | 'PROCESSING' | 'DONE' | 'FAILED'
    retry_count     INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_queue_pending ON message_queue(status, received_at) WHERE status = 'PENDING';

-- 4. CHAT HISTORY (unchanged from v0.5, just ensure it exists)
CREATE TABLE IF NOT EXISTS chat_history (
    id              SERIAL PRIMARY KEY,
    session_id      TEXT NOT NULL,
    role            TEXT NOT NULL,           -- 'user' | 'assistant' | 'system'
    content         TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_history_session ON chat_history(session_id, created_at);

-- 5. SYSTEM LOGS (observability)
CREATE TABLE IF NOT EXISTS system_logs (
    id          SERIAL PRIMARY KEY,
    severity    TEXT,                        -- 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
    component   TEXT,                        -- 'velocity_guard' | 'hours_check' | 'agent' | 'inventory'
    phone_number TEXT,
    message     TEXT,
    details     JSONB,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- =============================================================
-- SEED: Default config for Zamux (your cuñada's account)
-- Update phone_number to her real WhatsApp number
-- =============================================================
INSERT INTO client_config (
    phone_number,
    status,
    inventory_source,
    inventory_config,
    max_concurrent
) VALUES (
    'DEFAULT',   -- Wildcard: applies when no specific phone config found
    'AUTO',
    'web_scraper',
    '{"base_url":"https://www.zamux.co","search_path":"/search","query_param":"q"}',
    1
) ON CONFLICT (phone_number) DO NOTHING;

-- =============================================================
-- HELPER: Function to auto-resume to AUTO after silence period
-- (Optional: call this from a scheduled n8n workflow)
-- =============================================================
CREATE OR REPLACE FUNCTION auto_resume_check() RETURNS void AS $$
BEGIN
    UPDATE client_config
    SET status = 'AUTO', updated_at = NOW()
    WHERE status = 'MANUAL'
      AND last_human_msg_at IS NOT NULL
      AND last_human_msg_at < NOW() - (auto_resume_minutes || ' minutes')::INTERVAL;
END;
$$ LANGUAGE plpgsql;
