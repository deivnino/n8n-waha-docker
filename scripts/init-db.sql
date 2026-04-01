-- =============================================================
-- init-db.sql — Esquema unificado (fuente de verdad)
-- Reemplaza: setup_v06.sql, migration_v6.sql, migration_claude_md_sync.sql
--
-- Uso: bash scripts/init-db.sh
--   o: docker exec -i postgres psql -U chatwoot -d chatwoot < scripts/init-db.sql
-- =============================================================

BEGIN;

-- =============================================================
-- 1. chat_control — Config por cliente + estado de conversacion
-- =============================================================
CREATE TABLE IF NOT EXISTS chat_control (
    phone_number           TEXT PRIMARY KEY,        -- ej: '573168294407@c.us'
    status                 TEXT DEFAULT 'AUTO',     -- AUTO | MANUAL | PAUSED
    is_vip                 BOOLEAN DEFAULT FALSE,
    daily_counter          INTEGER DEFAULT 0,
    last_human_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tier                   TEXT DEFAULT 'MEDIUM',   -- MEDIUM (WAHA) | HIGH (Official API)

    -- Negocio
    business_name          TEXT,                    -- Nombre visible del negocio
    business_hours         JSONB DEFAULT '{"tz":"America/Bogota","schedule":{"1":["08:00","19:00"],"2":["08:00","19:00"],"3":["08:00","19:00"],"4":["08:00","19:00"],"5":["08:00","19:00"],"6":["09:00","14:00"]}}',
    outside_hours_enabled  BOOLEAN DEFAULT TRUE,
    website_url            TEXT,                    -- URL para tool "Consultar Sitio Web"

    -- Inventario / ERP
    allegra_url            TEXT,                    -- Base URL Allegra API
    allegra_api_key        TEXT,                    -- Token Allegra

    -- WAHA / Portal
    waha_session_id        TEXT,                    -- Session ID en WAHA (ej: 'default')
    auth_token             UUID,                    -- Token para portal cliente (/qr, /settings)
    client_name            TEXT,                    -- Nombre del cliente (portal)
    client_logo_url        TEXT,                    -- Logo del cliente (portal)

    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================
-- 2. processing_locks — Velocity Gate (concurrencia por numero)
-- =============================================================
CREATE TABLE IF NOT EXISTS processing_locks (
    phone_number TEXT PRIMARY KEY,
    locked_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    workflow_id  TEXT
);

-- Indice para cleanup de locks expirados
CREATE INDEX IF NOT EXISTS idx_locks_locked_at ON processing_locks(locked_at);

-- =============================================================
-- 3. message_queue — Cola de mensajes cuando hay lock activo
-- =============================================================
CREATE TABLE IF NOT EXISTS message_queue (
    id           SERIAL PRIMARY KEY,
    phone_number TEXT NOT NULL,
    message_body TEXT NOT NULL,
    queued_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed    BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_queue_pending
    ON message_queue(queued_at) WHERE processed = FALSE;

-- =============================================================
-- 4. chat_history — Historial conversacional del agente
-- =============================================================
CREATE TABLE IF NOT EXISTS chat_history (
    id           SERIAL PRIMARY KEY,
    session_id   TEXT NOT NULL,              -- = phone_number
    role         TEXT NOT NULL,              -- user | assistant | system
    content      TEXT NOT NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_history_session
    ON chat_history(session_id, created_at);

-- =============================================================
-- 5. system_logs — Observabilidad
-- =============================================================
CREATE TABLE IF NOT EXISTS system_logs (
    id           SERIAL PRIMARY KEY,
    severity     TEXT,                       -- INFO | WARN | ERROR | CRITICAL
    component    TEXT,                       -- velocity_guard | hours_check | agent | inventory
    phone_number TEXT,
    message      TEXT,
    details      JSONB,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================
-- Vista util: locks activos
-- =============================================================
CREATE OR REPLACE VIEW active_locks AS
SELECT
    phone_number,
    locked_at,
    locked_at + INTERVAL '5 minutes' AS expires_at,
    EXTRACT(EPOCH FROM (locked_at + INTERVAL '5 minutes' - NOW()))::INT AS seconds_remaining
FROM processing_locks
WHERE locked_at > NOW() - INTERVAL '5 minutes';

COMMIT;
