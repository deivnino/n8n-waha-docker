# CLAUDE.md — Contexto Maestro del Proyecto
> Archivo de contexto para Claude Code. Leer COMPLETO antes de hacer cualquier cambio.
> Última actualización: 2026-03-17

---

## 🧠 Qué Estamos Construyendo

**"WhatsApp AI Business OS"** — Plataforma de automatización de WhatsApp con IA para SMBs,
construida como agencia replicable que escala a SaaS multi-tenant.

El modelo: David consigue clientes → onboarding rápido → el sistema responde por WhatsApp,
aprende del negocio, y escala a humano cuando es necesario.

**Cliente beta activo**: Tienda de componentes electrónicos de familiar en Bogotá.
**Objetivo inmediato**: Validar ROI con beta → primer cliente de pago → landing page → escala.

---

## 🏗️ Arquitectura del Sistema

### Stack Local (Dev/Beta) — Docker Compose en Windows
| Servicio   | Puerto | Rol                                        |
|------------|--------|--------------------------------------------|
| n8n        | 5678   | Orquestador de flujos / cerebro            |
| WAHA       | 3000   | WhatsApp HTTP API (engine: WEBJS)          |
| PostgreSQL | 5432   | Estado, config, locks, historial           |
| pgAdmin    | 5050   | Admin visual de Postgres                   |
| Qdrant     | 6333   | Vector DB para RAG                         |
| Ollama     | 11434  | Embeddings locales (externo a Docker, host)|

### Stack Producción (Futuro) — VPS con Coolify
- **Apps (Lógica)**: Single-tenant — cada cliente tiene su propio n8n + WAHA aislados
- **Datos**: Multi-tenant lógico — Postgres y Qdrant centrales, segregados por cliente
- **Orquestación**: Coolify + Traefik (`cliente.agencia.com`)

### Rutas internas Docker
- Qdrant: `http://qdrant:6333`
- Ollama: `http://host.docker.internal:11434`
- n8n API: `http://localhost:5678/api/v1`


---

## 🔑 Credenciales n8n (IDs internos)
| Recurso    | Credential ID en n8n  |
|------------|-----------------------|
| WAHA       | `GLDEayRhcouW5kt1`    |
| Anthropic  | `ofIKxCCibm2YNl8G`    |
| PostgreSQL | `MpT6kay8Q7oxgRNE`    |
| Qdrant     | `qdrant-local`        |
| Ollama     | `ollama-local`        |

- **LLM principal del agente**: Anthropic Claude (Haiku o Sonnet según tarea)
- **Embeddings**: Ollama / Qwen (local, `nomic-embed-text`)
- **n8n API Key**: ver TOOLS.md o `.env`
- **n8n Workflow prod ID**: `_jCo7E4j09FGztAPboL2J`

---

## 📂 Estructura del Proyecto

```
n8n-waha-docker/
├── CLAUDE.md                   ← Este archivo (leer primero)
├── README.md                   ← Onboarding rápido
├── docker-compose.yml          ← Stack completo
├── Makefile                    ← make up / make logs / make ps
├── .env                        ← Variables sensibles (NO commitear)
│
├── workflows/                  ← JSONs de n8n (versionados en git)
│   ├── waha-chatting-prod.json       ← WORKFLOW ACTIVO (waha_v6)
│   ├── waha-ia-dev.json              ← Branch de desarrollo / pruebas
│   ├── workflow-4-rag-test.json      ← Test de RAG con Qdrant
│   └── n8n-git-versioning-example.json
│
├── scripts/
│   └── whatsapp/               ← Export de chats para onboarding RAG
│
├── docs/
│   ├── mejoras-propuestas.md   ← Deuda técnica y roadmap
│   └── README.md
│
└── gemini_exported/            ← PDFs de contexto (NO versionar - agregar a .gitignore)
```


---

## 🔄 Workflow de Producción: `waha_v6`

**Archivo**: `workflows/waha-chatting-prod.json`
**ID en n8n**: `_jCo7E4j09FGztAPboL2J`

### Flujo de nodos (en orden)
1. **WAHA Webhook** → recibe mensaje entrante
2. **Load Client Config** → lee config del cliente desde Postgres (`chat_control`)
3. **Velocity Gate** → locks de concurrencia global + por número (`processing_locks`),
   mensajes en cola (`message_queue`)
4. **Business Hours Check** → horario configurable en JSON, timezone Colombia GMT-5
5. **Mode Gate** → gatekeeper AUTO / MANUAL
6. **AI Agent** (Claude) con 3 tools:
   - Knowledge Base Search → Qdrant RAG
   - Inventory Lookup → MCP Router (Allegra API / Sheets / mock, switchable por cliente en DB)
   - Human Escalation → pasa a MANUAL + notifica
7. **Release Lock** → en TODOS los exit paths (crítico para evitar deadlocks)

### Reglas de desarrollo (NO romper)
- Leer el JSON **antes** de cualquier edición
- Las claves de conexión entre nodos usan el campo `name` del nodo, **NO el `id`** — crítico en n8n
- El proyecto **no tiene CI** — toda validación es manual, ser conservador
- Preferir cambios quirúrgicos sobre rewrites completos

---

## 🚪 Fix Crítico Ya Aplicado (NO revertir)

**WAHA Session Persistence**: El volumen Docker debe montarse en `/app/.sessions` (con punto),
NO en `/app/sessions`. Sin este fix, WAHA pierde la sesión en cada restart.

```yaml
# docker-compose.yml — correcto:
volumes:
  - ./data/waha:/app/.sessions
```

---

## 📱 Portal de Re-autenticación QR (Diseñado, Pendiente Construir)

**Problema**: Cuando WAHA pierde sesión, hay que ir físicamente a escanear el QR. No escala.

**Solución (Option A — reutiliza n8n, sin infraestructura nueva)**:
- n8n sirve una página HTML via Webhook con token en URL:
  `https://tudominio.com/webhook/qr-auth?token=UUID`
- El token UUID está en `chat_control.auth_token` (Postgres)
- La página HTML hace polling a WAHA `GET /api/sessions/{session_id}/qr`
- Al confirmar sesión abierta → muestra "✅ Conectado" automáticamente
- El cliente escanea desde su celular sin acceso SSH

**Columnas a agregar en `chat_control`** (migration pendiente):
- `auth_token UUID`
- `waha_session_id TEXT`
- `client_name TEXT`
- `client_logo_url TEXT`


---

## 🗄️ Esquema SQL (Fuente de Verdad)

> ⚠️ `setup_v06.sql` y `migration_v6.sql` tienen definiciones contradictorias de `client_config`.
> El esquema abajo es el autoritativo. Deprecar los otros.

```sql
-- Config por cliente
CREATE TABLE chat_control (
    phone_number     TEXT PRIMARY KEY,
    status           TEXT DEFAULT 'AUTO',   -- AUTO | MANUAL | PAUSED
    is_vip           BOOLEAN DEFAULT FALSE,
    daily_counter    INTEGER DEFAULT 0,
    last_human_interaction TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tier             TEXT DEFAULT 'MEDIUM', -- MEDIUM (WAHA) | HIGH (Official API)
    auth_token       UUID,                  -- portal QR
    waha_session_id  TEXT,
    client_name      TEXT,
    client_logo_url  TEXT
);

-- Locks de concurrencia (Velocity Gate)
CREATE TABLE processing_locks (
    phone_number TEXT PRIMARY KEY,
    locked_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    workflow_id  TEXT
);

-- Cola de mensajes cuando hay lock activo
CREATE TABLE message_queue (
    id           SERIAL PRIMARY KEY,
    phone_number TEXT,
    message_body TEXT,
    queued_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed    BOOLEAN DEFAULT FALSE
);

-- Logs de sistema
CREATE TABLE system_logs (
    id SERIAL PRIMARY KEY, severity TEXT, component TEXT,
    message TEXT, details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Historial conversacional del agente
CREATE TABLE chat_history (
    id SERIAL PRIMARY KEY, phone_number TEXT,
    role TEXT, -- user | assistant | system
    content TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Nota SQL en n8n**: usar `$1, $2` placeholders con `options.queryReplacement`, nunca concatenación.


---

## 🤖 System Prompt Maestro del Agente

```
Eres "Asistente Virtual", el IA de soporte de [NOMBRE_EMPRESA].
TU OBJETIVO: Responder basándote EXCLUSIVAMENTE en el Contexto RAG proporcionado.

REGLAS:
1. BASE DE CONOCIMIENTO: Busca en RAG primero. Si no está, di "No tengo esa info a mano"
   y ofrece conectar con un humano. NO INVENTES PRECIOS.
2. TONO: Amable, profesional, conciso. Emojis con moderación.
3. LÍMITES: No discutas, no política, no aceptes pagos directos por chat.
4. ESCALADO: Si el usuario pide "humano" o parece frustrado:
   {"action": "escalate", "reply": "Entiendo, te paso con un asesor."}

CONTEXTO RAG: {{ $json.rag_context }}
HISTORIAL: {{ $json.chat_history }}
```

## 📥 Onboarding RAG de Cliente Nuevo
1. Cliente exporta historial de WhatsApp (`.txt` nativo de WhatsApp)
2. Code node en n8n parsea el `.txt`
3. Chunks cargados a Qdrant (colección `{client_id}_knowledge`)
4. Opcional: Firecrawl para scraping del sitio web del cliente

---

## 💼 Modelo de Negocio

### Posicionamiento
No es SaaS de $20/mes. Es **"Transformación Operativa"**: $1,000 USD setup + mantenimiento.

### Tiers
| Tier           | Tech                | Riesgo | Costo Meta | Target                 |
|----------------|---------------------|--------|------------|------------------------|
| Medium (Beta)  | WAHA + Hard Cap 50  | Medio  | $0         | PYMES, tienda cuñada   |
| High Ticket    | WhatsApp Cloud API  | Nulo   | Por mensaje| Empresas establecidas  |

**Hard Cap**: Máximo 50 mensajes/día por número en WAHA → evita ban de cuenta.

### GTM (Go-to-Market)
1. Validar beta → medir tiempo ahorrado, leads convertidos
2. Landing page: "Tu WhatsApp en Autopiloto con IA"
3. 5-10 slots limitados → Scraper → AI Emailer → Loom Demo → Pago

---

## 🌐 Portal Cliente Externo — Next.js (En construcción)

**Decisión**: Se eligió **Option B** (Next.js App Router) sobre Option A (n8n HTML) por escalabilidad.
Option A genera deuda técnica inmediata al agregar features; Next.js permite crecer limpio.

**Stack**: Next.js 14 (App Router) + Tailwind + shadcn/ui + pg (PostgreSQL) — `portal/`

**Auth**: Token UUID por cliente en `chat_control.auth_token`. URL: `/qr?token=UUID`

### Páginas implementadas
| Ruta | Estado | Descripción |
|------|--------|-------------|
| `/qr?token=UUID` | ✅ Funcionando | QR re-auth con polling a WAHA, auto-start de sesión |
| `/settings?token=UUID` | 🔨 Stub | Config horarios, modo AUTO/MANUAL |
| `/dashboard?token=UUID` | 🔨 Stub | Métricas: mensajes, escalados, historial |

### Flujo QR implementado
1. Server component valida token en Postgres → obtiene `waha_session_id`
2. Client component (`QrPoller`) hace polling a `/api/qr/{sessionId}` cada 3s
3. API route verifica estado WAHA: STOPPED → start automático, STARTING → espera, SCAN_QR_CODE → devuelve QR
4. Al conectar → muestra ✅

### Beta client configurado
- `phone_number`: `573168294407@c.us`
- `waha_session_id`: `default`
- `auth_token`: en Postgres (`chat_control`)

### Pendiente (próximas sesiones)
- `/settings`: horarios de atención, modo AUTO/MANUAL, mensaje fuera de horario
- `/dashboard`: métricas desde `chat_history` y `system_logs`
- Upload de archivos al RAG (catálogos PDF → Qdrant)

---

## 🚀 Deployment — Coolify Multi-tenant (Diseñado, Pendiente)

**Arquitectura de producción**:
- **Coolify** como orquestador en VPS (reemplaza docker-compose manual)
- **Traefik** como reverse proxy (`cliente.agencia.com`)
- **Single-tenant apps**: cada cliente tiene su propio n8n + WAHA aislados
- **Multi-tenant datos**: Postgres y Qdrant centrales, segregados por `client_id`

**Pasos para deployment**:
1. VPS con Coolify instalado
2. Migrar docker-compose a Coolify stacks
3. DNS wildcard `*.agencia.com` → Coolify/Traefik
4. Script de onboarding: crear stack por cliente + BD + colección Qdrant
5. Portal de cliente apuntando al stack correcto

**Pendiente definir**: estrategia de backups, monitoreo, y escalado horizontal.

---

## 🔧 Integración de Inventario — MCP Router (Pendiente)

Router switchable por cliente via DB config:
- **Allegra API** (ERP colombiano) — docs disponibles, credenciales pendientes
- **Google Sheets** — fallback simple
- **Web scraper** — via Firecrawl
- **Mock backend** — para demos y desarrollo

---

## 📊 DevOps / Git Workflow

- **Local**: Experimentar y desarrollar (puede romperse)
- **GitHub `dev`**: Backup automático via workflow n8n
- **GitHub `main` → Coolify**: Producción — NUNCA editar directamente en prod
- **Hotfix**: Local → push `dev` → PR a `main` → pull en Coolify

**Mejora futura**: Workflow maestro de versionamiento (1 workflow versiona todos los demás).
Referencia: https://youtu.be/d7hNUFrbJxo (Canal Alvin / AstraVenture)


---

## ⚠️ Deuda Técnica Pendiente

### Prioridad Alta
1. **Ejecutar SQL migrations** para `processing_locks`, `message_queue`, y columnas nuevas en `chat_control`
2. **Crear `.env.example`** — el repo no tiene plantilla de variables de entorno
3. **Unificar esquema SQL** — `setup_v06.sql` vs `migration_v6.sql` contradictorios
4. **Pinear versiones Docker** — todas usan `latest`, inestable en producción

### Prioridad Media
5. **Refactorizar `vectorize.py`** — hardcodeado a `gemini_exported/` y colección fija
6. **Declarar dependencias Python** — `vectorize.py` usa langchain/qdrant-client sin `requirements.txt`
7. **Agregar Ollama al docker-compose** (o documentar como dependencia externa explícita)
8. **`gemini_exported/` a `.gitignore`** — PDFs con contenido real no deben versionarse
9. **Soporte para notas de voz** — Switch + Whisper/Groq para transcribir audios antes del agente IA
10. **Fallback de LLM** — Error Routing en AI Agent con mensaje estático si Anthropic cae
11. **Embedding GPU vs CPU** — Parametrizar `nomic-embed-gpu` → `nomic-embed-text` para VPS sin GPU
12. **Workflow maestro de versionamiento** — Reemplazar botones Push/Pull individuales por workflow centralizado

### Prioridad Baja
9. Normalizar encoding UTF-8 en todos los archivos
10. Definir licencia definitiva (`LICENSE`)

---

## 🛑 Reglas para Claude Code (LEER SIEMPRE)

1. **Leer antes de editar** — nunca modificar sin haber leído el archivo primero
2. **Cambios quirúrgicos** — ediciones mínimas y dirigidas, no rewrites
3. **No romper producción** — `waha-chatting-prod.json` tiene cliente beta real activo
4. **Conexiones n8n** — las claves usan el campo `name` del nodo, **NO el `id`**
5. **Preguntar ante duda** — si hay ambigüedad en SQL o lógica de workflow, preguntar antes de asumir
6. **SQL con parámetros** — usar `$1, $2` con `options.queryReplacement`, nunca string concat
7. **Sin CI** — toda validación es manual; ser conservador con cambios automáticos
8. **Revisar `docs/mejoras-propuestas.md`** para deuda técnica antes de proponer nuevas mejoras

---

## 📌 Estado Actual (2026-03-17)

| Componente                  | Estado                                   |
|-----------------------------|------------------------------------------|
| Stack Docker local          | ✅ Funcionando                           |
| WAHA session persistence    | ✅ Fix aplicado (`/app/.sessions`)       |
| Workflow waha_v6            | ✅ Diseñado, pendiente deploy final      |
| SQL migrations v6           | ✅ Ejecutadas (2026-03-16)              |
| Portal QR re-auth           | ✅ Funcionando (`/qr?token=UUID`)        |
| Portal cliente externo      | 🔨 En construcción (`portal/` Next.js)  |
| Portal /settings            | 📋 Próxima sesión                        |
| Portal /dashboard           | 📋 Próxima sesión                        |
| Inventario MCP Router       | 📋 Diseñado, pendiente construir         |
| Beta client activo          | ✅ Tienda electrónica, Bogotá            |
| Primer cliente de pago      | 🎯 Objetivo post-validación beta         |
| Git workflow (push/pull)    | ✅ Botones en waha-chatting-prod y waha-ia-dev |
| Deployment (Coolify)        | 📋 Diseñado, pendiente construir         |

---

*Este archivo es la fuente de verdad del proyecto.*
*Actualizar cuando cambie algo significativo. No agregar ruido.*
