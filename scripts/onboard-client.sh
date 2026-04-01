#!/bin/bash
# =============================================================
# onboard-client.sh — Registra un nuevo cliente en la BD
# Prerequisito: init-db.sh ya ejecutado, stack corriendo
#
# Uso interactivo:  bash scripts/onboard-client.sh
# Uso directo:      bash scripts/onboard-client.sh \
#                     --phone "573168294407@c.us" \
#                     --name "Mercawow" \
#                     --session "default" \
#                     --website "https://www.zamux.co"
#
# Despues de esto:
#   1. Vectorizar documentos: python scripts/utils/vectorize.py --phone-number PHONE archivos...
#   2. Escanear QR: abrir /qr?token=TOKEN en el navegador
# =============================================================

set -e

# --- Parse argumentos ---
PHONE=""
BIZ_NAME=""
SESSION="default"
WEBSITE=""
HOURS='{"tz":"America/Bogota","schedule":{"1":["08:00","19:00"],"2":["08:00","19:00"],"3":["08:00","19:00"],"4":["08:00","19:00"],"5":["08:00","19:00"],"6":["09:00","14:00"]}}'

while [[ $# -gt 0 ]]; do
    case $1 in
        --phone)    PHONE="$2"; shift 2 ;;
        --name)     BIZ_NAME="$2"; shift 2 ;;
        --session)  SESSION="$2"; shift 2 ;;
        --website)  WEBSITE="$2"; shift 2 ;;
        --hours)    HOURS="$2"; shift 2 ;;
        *) echo "Argumento desconocido: $1"; exit 1 ;;
    esac
done

# --- Modo interactivo si faltan datos ---
if [ -z "$PHONE" ]; then
    read -p "Numero WhatsApp (ej: 573168294407@c.us): " PHONE
fi
if [ -z "$BIZ_NAME" ]; then
    read -p "Nombre del negocio: " BIZ_NAME
fi
if [ -z "$SESSION" ]; then
    read -p "WAHA session ID [default]: " SESSION
    SESSION="${SESSION:-default}"
fi
if [ -z "$WEBSITE" ]; then
    read -p "URL del sitio web (dejar vacio si no tiene): " WEBSITE
fi

# --- Generar auth token ---
AUTH_TOKEN=$(python -c "import uuid; print(uuid.uuid4())" 2>/dev/null || cat /proc/sys/kernel/random/uuid 2>/dev/null || echo "$(date +%s)-$(shuf -i 1000-9999 -n 1)")

echo ""
echo "=== Registrando cliente ==="
echo "  Telefono:  $PHONE"
echo "  Negocio:   $BIZ_NAME"
echo "  Session:   $SESSION"
echo "  Website:   ${WEBSITE:-N/A}"
echo "  Token:     $AUTH_TOKEN"
echo ""

# --- INSERT en BD ---
docker exec -i postgres psql -U chatwoot -d chatwoot <<SQL
INSERT INTO chat_control (
    phone_number,
    status,
    business_name,
    business_hours,
    outside_hours_enabled,
    website_url,
    waha_session_id,
    auth_token,
    client_name
) VALUES (
    '${PHONE}',
    'AUTO',
    '${BIZ_NAME}',
    '${HOURS}'::jsonb,
    TRUE,
    NULLIF('${WEBSITE}', ''),
    '${SESSION}',
    '${AUTH_TOKEN}'::uuid,
    '${BIZ_NAME}'
)
ON CONFLICT (phone_number) DO UPDATE SET
    business_name = EXCLUDED.business_name,
    website_url = EXCLUDED.website_url,
    waha_session_id = EXCLUDED.waha_session_id,
    auth_token = COALESCE(chat_control.auth_token, EXCLUDED.auth_token),
    client_name = EXCLUDED.client_name,
    updated_at = CURRENT_TIMESTAMP;
SQL

echo ""
echo "=== Cliente registrado ==="
echo ""
echo "Siguientes pasos:"
echo "  1. Vectorizar documentos RAG:"
echo "     python scripts/utils/vectorize.py --phone-number $PHONE archivos.txt"
echo ""
echo "  2. Si hay sitio web, crawlear:"
echo "     python scripts/utils/crawl_and_vectorize.py --phone-number $PHONE --url ${WEBSITE:-https://ejemplo.com}"
echo ""
echo "  3. Escanear QR de WhatsApp:"
echo "     Abrir en navegador: http://localhost:3001/qr?token=$AUTH_TOKEN"
echo ""
