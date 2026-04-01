-- =====================================================
-- waha v0.6 - SQL Setup Script
-- Ejecutar en pgAdmin o psql contra la BD chatwoot
-- =====================================================

-- 1. Tabla de locks para velocity control
CREATE TABLE IF NOT EXISTS processing_locks (
    phone_number TEXT PRIMARY KEY,
    locked_at    TIMESTAMP DEFAULT NOW(),
    expires_at   TIMESTAMP DEFAULT NOW() + INTERVAL '2 minutes'
);

-- Limpiar locks expirados automáticamente con índice
CREATE INDEX IF NOT EXISTS idx_locks_expires ON processing_locks(expires_at);

-- 2. Tabla de configuración del cliente (el MCP Router la lee)
CREATE TABLE IF NOT EXISTS client_config (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    description TEXT
);

-- Valores por defecto para Zamux
INSERT INTO client_config (key, value, description) VALUES
  ('inventory_source',  'web_scraper',         'Fuente de inventario: alegra | web_scraper | sheets'),
  ('max_concurrent',    '2',                   'Max conversaciones simultaneas globales'),
  ('business_hours',    'L-V:8-19,S:9-14',     'Horario laboral: dias(L-D) y horas (24h)'),
  ('timezone_offset',   '-5',                  'Offset GMT del cliente'),
  ('out_of_hours_msg',  'Hola! Nuestro horario de atencion es L-V 8am-7pm y S 9am-2pm. Tu mensaje es importante para nosotros, te respondemos en cuanto abramos! 🕐', 'Mensaje fuera de horario'),
  ('web_inventory_url', 'https://www.zamux.co/search', 'URL base scraping inventario web'),
  ('alegra_token',      '',                    'Token Alegra: base64(email:api_token)'),
  ('alegra_base_url',   'https://api.alegra.com/api/v1', 'Base URL Alegra API')
ON CONFLICT (key) DO NOTHING;

-- 3. Asegurar que chat_control existe con todos los campos necesarios
CREATE TABLE IF NOT EXISTS chat_control (
    phone_number             TEXT PRIMARY KEY,
    status                   TEXT DEFAULT 'AUTO',
    is_vip                   BOOLEAN DEFAULT FALSE,
    daily_counter            INTEGER DEFAULT 0,
    last_human_interaction   TIMESTAMP DEFAULT NOW(),
    tier                     TEXT DEFAULT 'MEDIUM'
);

-- 4. Vista útil para debugging: locks activos
CREATE OR REPLACE VIEW active_locks AS
SELECT 
    phone_number,
    locked_at,
    expires_at,
    EXTRACT(EPOCH FROM (expires_at - NOW()))::INT AS seconds_remaining
FROM processing_locks
WHERE expires_at > NOW();
