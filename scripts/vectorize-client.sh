#!/bin/sh
# =============================================================
# vectorize-client.sh — Vectoriza todo el material RAG de un cliente
# Corre DENTRO de un contenedor python en la red del stack:
#
#   docker run --rm --network n8n-waha-docker_n8n-network \
#     -v "<ruta-repo>:/work" -w /work python:3.11-slim \
#     sh scripts/vectorize-client.sh "573168294407@c.us"
#
# Vectoriza: gemini_exported/zamux_crawl/*.md + data/whatsapp_exports/*.txt
# =============================================================
set -e

PHONE="${1:?Uso: vectorize-client.sh <phone_number ej. 573168294407@c.us>}"
QDRANT_URL="${QDRANT_URL:-http://qdrant:6333}"
OLLAMA_URL="${OLLAMA_URL:-http://ollama:11434}"

pip install -q langchain-community langchain-text-splitters langchain-ollama qdrant-client requests pypdf

echo "=== Catalogo web (chunk 500) ==="
for f in gemini_exported/zamux_crawl/*.md; do
  [ -e "$f" ] || continue
  python scripts/utils/vectorize.py "$f" --chunk-size 500 \
    --qdrant-url "$QDRANT_URL" --ollama-url "$OLLAMA_URL" \
    --phone-number "$PHONE" --skip-existing-check
done

echo "=== Chats WhatsApp ==="
for f in data/whatsapp_exports/*.txt; do
  [ -e "$f" ] || continue
  python scripts/utils/vectorize.py "$f" \
    --qdrant-url "$QDRANT_URL" --ollama-url "$OLLAMA_URL" \
    --phone-number "$PHONE" --skip-existing-check
done

echo "VECTORIZACION_COMPLETA"
