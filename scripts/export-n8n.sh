#!/bin/bash
# =============================================================
# export-n8n.sh — Exporta el volumen n8n_data (credenciales + config)
# Ejecutar en la PC origen donde corre el stack
#
# Uso: bash scripts/export-n8n.sh
# Resultado: ./backup/n8n_data.tar.gz (~181 MB)
# =============================================================

set -e

BACKUP_DIR="./backup"
mkdir -p "$BACKUP_DIR"

echo "[1/1] Exportando volumen n8n_data..."
docker run --rm \
  -v n8n_data:/data \
  -v "$(cd "$BACKUP_DIR" && pwd)":/backup \
  alpine tar czf /backup/n8n_data.tar.gz -C /data .

echo ""
echo "Listo: $BACKUP_DIR/n8n_data.tar.gz"
ls -lh "$BACKUP_DIR/n8n_data.tar.gz"
echo ""
echo "En la otra PC:"
echo "  1. git clone el repo"
echo "  2. Copia .env y backup/n8n_data.tar.gz al repo"
echo "  3. docker volume create n8n_data"
echo "  4. docker run --rm -v n8n_data:/data -v \$(pwd)/backup:/backup alpine sh -c 'cd /data && tar xzf /backup/n8n_data.tar.gz'"
echo "  5. docker compose up -d"
echo "  6. bash scripts/init-db.sh"
echo "  7. bash scripts/onboard-client.sh (para cada cliente)"
