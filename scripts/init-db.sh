#!/bin/bash
# =============================================================
# init-db.sh — Inicializa el esquema de BD en Postgres
# Prerequisito: docker compose up -d postgres (debe estar corriendo)
#
# Uso: bash scripts/init-db.sh
# =============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Esperando que Postgres este listo..."
until docker exec postgres pg_isready -U chatwoot > /dev/null 2>&1; do
    sleep 1
done

echo "Ejecutando init-db.sql..."
docker exec -i postgres psql -U chatwoot -d chatwoot < "$SCRIPT_DIR/init-db.sql"

echo ""
echo "BD inicializada. Tablas creadas:"
docker exec postgres psql -U chatwoot -d chatwoot -c "\dt" 2>/dev/null | grep -E "chat_control|processing_locks|message_queue|chat_history|system_logs"
echo ""
echo "Siguiente paso: bash scripts/onboard-client.sh"
