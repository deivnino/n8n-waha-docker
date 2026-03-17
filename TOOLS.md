# TOOLS.md — Guía de APIs Locales para AI Assistants
> Este archivo es para que cualquier AI assistant (Claude Code, Copilot, Codex, etc.)
> sepa cómo interactuar con las herramientas locales del proyecto.
> Leer este archivo al inicio de cada sesión de desarrollo.

---

## n8n REST API (Local)

### Conexión
| Campo | Valor |
|-------|-------|
| Base URL | `http://localhost:5678/api/v1` |
| Auth Header | `X-N8N-API-KEY` |
| API Key | Ver variable `N8N_API_KEY` en `.env` |
| UI | http://localhost:5678 |

### Workflows del Proyecto

| Workflow ID | Nombre | Archivo Local | Rol |
|-------------|--------|---------------|-----|
| `xXQ0R_KRA2teh7aVZe-kQ` | WAHA - Chatting Template | `workflows/waha-chatting-prod.json` | **PRODUCCIÓN** — NO romper |
| `nSsRhEbujpKWX6ZmGaDpc` | waha | `workflows/waha-ia-dev.json` | Desarrollo / pruebas |
| `HuGpwByTPX0Zd6p0lHKZ3` | Work with GitHub \| examples | `workflows/n8n-git-versioning-example.json` | Ejemplo git |
| `Ylb8wH6qNE6F1GpWZLuD5` | My workflow 4 | `workflows/workflow-4-rag-test.json` | Test RAG |

### Credenciales Disponibles

| Credential ID | Nombre | Tipo | Uso |
|---------------|--------|------|-----|
| `GLDEayRhcouW5kt1` | WAHA account | wahaApi | Nodos WAHA |
| `ofIKxCCibm2YNl8G` | Anthropic | anthropicApi | AI Agent (Claude) |
| `MpT6kay8Q7oxgRNE` | PostgreSQL | postgres | Queries a BD |
| `XyRuoriQdpduVqzm` | n8n API Key | httpHeaderAuth | Git push/pull → n8n API |
| `iplCsBC0BvkwkJGt` | GitHub PAT | httpHeaderAuth | Git push/pull → GitHub API |
| `EiuFA75Qlu3mNvku` | GitHub account | githubApi | Nodos nativos GitHub |

### Operaciones Comunes

#### Leer un workflow desde n8n
```bash
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" \
  http://localhost:5678/api/v1/workflows/{WORKFLOW_ID}
```

#### Actualizar un workflow en n8n (PUT)
```bash
curl -s -X PUT \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Workflow Name","nodes":[...],"connections":{...},"settings":{...}}' \
  http://localhost:5678/api/v1/workflows/{WORKFLOW_ID}
```

**Campos requeridos en el body**: `name`, `nodes`, `connections`, `settings`

**Settings permitidos** (solo estos, otros causan error 400):
- `executionOrder`
- `callerPolicy`
- `errorWorkflow`
- `timezone`

#### Crear una credencial
```bash
curl -s -X POST \
  -H "X-N8N-API-KEY: $N8N_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nombre","type":"httpHeaderAuth","data":{"name":"Header-Name","value":"valor"}}' \
  http://localhost:5678/api/v1/credentials
```

#### Exportar workflow a archivo local (Python)
```python
import json, urllib.request

API_KEY = "..."  # from .env
WORKFLOW_ID = "xXQ0R_KRA2teh7aVZe-kQ"

req = urllib.request.Request(
    f"http://localhost:5678/api/v1/workflows/{WORKFLOW_ID}",
    headers={"X-N8N-API-KEY": API_KEY}
)
with urllib.request.urlopen(req) as resp:
    wf = json.load(resp)

# Limpiar campos de runtime antes de guardar
for key in ["statistics", "updatedAt", "createdAt", "shared", "versionId",
            "activeVersionId", "triggerCount", "isArchived", "activeVersion", "tags"]:
    wf.pop(key, None)

with open("workflows/waha-chatting-prod.json", "w", encoding="utf-8") as f:
    json.dump(wf, f, indent=2, ensure_ascii=False)
```

### Errores Conocidos (Gotchas)

| Error | Causa | Solución |
|-------|-------|----------|
| `400: settings must NOT have additional properties` | Settings tiene campos como `binaryMode`, `availableInMCP` | Solo pasar: `executionOrder`, `callerPolicy`, `errorWorkflow`, `timezone` |
| `400: missing name` | PUT sin campo `name` | Siempre incluir `name` del workflow |
| `405: GET method not allowed` en `/credentials` | La API pública no soporta listar credenciales | Usar la GUI o crear nuevas via POST |
| Credential `id: ""` en JSON exportado | n8n no exporta IDs de credenciales por seguridad | Re-asignar manualmente o via API después de importar |
| Nodo no se conecta después de importar | Conexiones usan campo `name` del nodo, NO `id` | Verificar que los `name` coincidan exactamente |

---

## WAHA API (WhatsApp)

| Campo | Valor |
|-------|-------|
| Base URL | `http://localhost:3000` (host) / `http://waha:3000` (desde Docker) |
| Docs | http://localhost:3000/docs |
| Engine | WEBJS |
| Session path | `/app/.sessions` (con punto — crítico) |

---

## PostgreSQL

| Campo | Valor |
|-------|-------|
| Host | `localhost:5432` (host) / `postgres:5432` (desde Docker) |
| Database | Ver `.env` |
| pgAdmin | http://localhost:5050 |

---

## Qdrant (Vector DB)

| Campo | Valor |
|-------|-------|
| URL | `http://localhost:6333` (host) / `http://qdrant:6333` (desde Docker) |
| Dashboard | http://localhost:6333/dashboard |

---

## Ollama (Embeddings)

| Campo | Valor |
|-------|-------|
| URL | `http://localhost:11434` (host) / `http://host.docker.internal:11434` (desde Docker) |
| Modelo | `nomic-embed-text` |
| Nota | Corre fuera de Docker, en el host Windows |
