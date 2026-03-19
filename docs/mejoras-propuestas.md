# Mejoras Propuestas del Proyecto

> Análisis generado a partir de revisión de Codex (2026-03-16)

## Prioridad Alta

### 1. Workflows no versionados
- **Problema**: La carpeta `workflows/` estaba vacía y `.gitignore` bloqueaba `*.json`
- **Estado**: ✅ Resuelto — se descargaron los 4 workflows y se ajustó `.gitignore`

### 2. Falta `.env.example`
- **Problema**: El repo depende de `.env` pero no hay plantilla versionada. Onboarding frágil.
- **Acción**: Crear `.env.example` con todas las variables necesarias (sin valores sensibles).

### 3. Inconsistencia en modelo SQL
- **Problema**: `setup_v06.sql` y `migration_v6.sql` definen `client_config` de forma contradictoria (tabla global key/value vs tabla por teléfono). Dos arquitecturas coexisten.
- **Acción**: Unificar en un solo esquema autoritativo y deprecar el otro.

### 4. Imágenes Docker sin versión fija
- **Problema**: Todas las imágenes usan `latest`, lo que genera inestabilidad operativa.
- **Acción**: Pinear versiones específicas en `docker-compose.yml`.

### 5. Workflow maestro de versionamiento (reemplazar botones individuales)
- **Problema**: Actualmente los botones Push/Pull están dentro del workflow WAHA. Esto no escala si hay más workflows.
- **Solución futura**: Crear un **workflow maestro separado** que versione cualquier workflow via Webhook con `?id=XYZ`.
- **Referencia**: [Video tutorial](https://youtu.be/d7hNUFrbJxo) — Canal: Alvin (AstraVenture)
- **Características del enfoque maestro**:
  - Un solo workflow sirve para todos los demás (link clickeable desde cualquier flujo)
  - Exporta via API de n8n, compara con GitHub, evita commits duplicados
  - Formulario para mensaje de commit
  - Crea archivo nuevo o actualiza existente según corresponda
- **Estado**: Pendiente — por ahora se usan botones Push/Pull dentro del workflow WAHA

### 6. Soporte para Notas de Voz (Audio → Texto)
- **Problema**: En LATAM los clientes envían notas de voz constantemente. Si WAHA recibe un mensaje tipo `ptt` o `audio`, el campo `body` viene vacío y el agente IA no puede responder.
- **Solución**: Agregar un nodo Switch al inicio del flujo. Si el tipo es audio, descargar el archivo de WAHA y pasarlo por **Whisper (OpenAI)** o **Groq** (rápido y gratuito) para transcribir a texto antes de inyectarlo al agente.
- **Impacto**: Alto — diferenciador clave para clientes LATAM.
- **Fuente**: Revisión Gemini 2026-03-17

### 7. Fallback de LLM ante caídas de API
- **Problema**: El flujo depende de Anthropic Claude. Si la API tiene timeout o caída, el cliente se queda "en visto" sin respuesta.
- **Solución**: Configurar **Error Routing** (On Error: Continue) en el nodo AI Agent. Si Anthropic falla, desviar a un nodo de texto estático: *"Mi sistema se está actualizando, ¿me dejas tu consulta y te responde un asesor en breve?"* o pensar en mukti ias?
- **Fuente**: Revisión Gemini 2026-03-17

### 8. Embedding GPU vs CPU para producción
- **Problema**: `vectorize.py` usa `nomic-embed-gpu`. En un VPS de producción (Coolify) es muy probable que no haya GPU dedicada, causando fallo silencioso o degradación.
- **Solución**: Parametrizar el modelo de embedding para usar `nomic-embed-text` (CPU) en entornos de producción. Configurar via variable de entorno o config por entorno.
- **Fuente**: Revisión Gemini 2026-03-17

## Prioridad Media

### 5. Vectorizador acoplado a datos locales
- **Problema**: `vectorize.py` depende de `gemini_exported/`, un PDF fijo y colección hardcodeada en Qdrant. Poco portable.
- **Acción**: Refactorizar para aceptar carpeta de entrada genérica y nombre de colección como parámetros.

### 6. Dependencias incompletas
- **Problema**: Solo hay `requirements.txt` para el exportador de WhatsApp. `vectorize.py` usa `langchain`, `qdrant-client`, `langchain-ollama` sin declararlas.
- **Acción**: Crear `scripts/utils/requirements.txt` o unificar en uno solo.

### 7. Script no modular
- **Problema**: `vectorize.py` está escrito como script ejecutable con `parse_args()` a nivel superior. No se puede importar como módulo.
- **Acción**: Encapsular lógica en funciones/clases reutilizables.

### 8. Ollama no está en Docker
- **Problema**: El README vende RAG completo pero no hay servicio Ollama en `docker-compose.yml`. El vectorizador apunta a `localhost:11434`.
- **Acción**: Agregar Ollama al stack o documentar que es dependencia externa.

## Prioridad Baja

### 9. Sin CI/CD ni tests + pre-commit hooks
- **Problema**: Sin tests, sin linters, sin formato declarado. Todo depende de prueba manual. No hay guardrails de repo que prevengan errores comunes.
- **Acción**: Agregar al menos un linter (ruff/flake8) y un smoke test del docker-compose. Implementar **pre-commit hooks** mínimos: `check-merge-conflict`, `end-of-file-fixer`, `detect-secrets`.
- **Fuente**: Revisión Copilot 2026-03-17

### 10. Smoke test / preflight script
- **Problema**: No hay forma automatizada de verificar que el stack está listo para operar. Se necesita validar: servicios Docker levantados, credenciales mínimas configuradas, tablas SQL existentes, nodos de comunidad instalados en n8n.
- **Acción**: Crear script de preflight (`scripts/preflight.sh` o similar) que haga health checks básicos antes de operar.
- **Fuente**: Revisión Codex 2026-03-17

### 11. Documentar dependencia de nodos/plugins n8n
- **Problema**: Los workflows usan nodos de comunidad (WAHA, LangChain/AI Agent) que no vienen con n8n vanilla. Si alguien levanta n8n limpio, los workflows no importan correctamente.
- **Acción**: Documentar lista de nodos de comunidad requeridos y versiones, idealmente en README o en un manifiesto separado.
- **Fuente**: Revisión Codex 2026-03-17

### 12. Tercer archivo SQL conflictivo
- **Problema**: Además de `setup_v06.sql` y `migration_v6.sql`, existe `migration_claude_md_sync.sql` como tercera fuente de verdad compitiendo. Agrava el problema de inconsistencia SQL (Prioridad Alta #3).
- **Acción**: Unificar o archivar junto con la resolución del esquema autoritativo.
- **Fuente**: Revisión Codex 2026-03-17

### 13. Licencia placeholder
- **Problema**: README dice "MIT (ajusta según tu preferencia)" — no es una decisión real.
- **Acción**: Definir licencia definitiva y agregar archivo `LICENSE`.

### 14. Problemas de encoding
- **Problema**: Textos con caracteres rotos en README, docs y Makefile.
- **Acción**: Normalizar encoding a UTF-8 en todos los archivos.

### 15. Datos sensibles y ruido en el repo
- **Problema**: PDFs y `.txt` de contenido real en `gemini_exported/`. Además, `.history/` y `.continue/` (generados por IDEs) ensucian el árbol de trabajo y pueden filtrar contexto sensible en PRs.
- **Acción**: Agregar a `.gitignore`: `gemini_exported/*.pdf`, `.history/`, `.continue/`. Mover datos reales a almacenamiento externo.

### 16. Deriva de documentación (docs drift)
- **Problema**: IDs de workflows, estado operativo, y configuración no están 100% alineados entre CLAUDE.md, TOOLS.md, README.md y los archivos SQL. Cada doc tiene su propia versión de la verdad.
- **Acción**: Auditar y sincronizar los 4 archivos. Definir cuál es autoritativo para cada tipo de dato (IDs → CLAUDE.md, API → TOOLS.md, onboarding → README).
- **Fuente**: Revisión Copilot 2026-03-17

### 17. Estado autogenerado (`docs/state.md`)
- **Problema**: Depender de docs manuales para reflejar el estado real del sistema genera drift inevitable (ver #16).
- **Solución**: Crear un script o target `make state` que genere `docs/state.md` automáticamente a partir de `docker-compose.yml` (servicios, puertos, imágenes), workflows exportados (IDs, nombres), y esquema SQL actual (tablas).
- **Fuente**: Revisión Copilot 2026-03-17

### 18. Política de releases de workflows
- **Problema**: No hay convención para versionar cambios a workflows de forma trazable. Los commits son ad-hoc y no hay forma clara de hacer rollback a un estado anterior.
- **Solución**: Definir política: cambios a workflows solo vía export + commit semántico + etiqueta git (`vX.Y-workflows`). Permite rollback claro y changelog legible.
- **Fuente**: Revisión Copilot 2026-03-17

---

## Prioridad Alta (Arquitectura Multi-tenant)

### Separar `chat_control` en `clients` + `chat_control`
- **Problema**: `chat_control` hace dos trabajos: registro estático de cliente (business_name, auth_token, tier…) y estado operacional por conversación (status, daily_counter, locks…). No escala para multi-tenant.
- **Solución**: Crear tabla `clients` para config estática, conservar `chat_control` solo para estado operacional, unirlas por `phone_number`.
- **Impacto**: Requiere migrar portal + workflow. Post-MVP.

### RAG filtrado por cliente en Qdrant (multi-tenant)
- **Problema**: El workflow n8n busca en `knowledge_base` sin filtrar por cliente. Con múltiples negocios en el mismo Qdrant, el agente del negocio A podría ver datos del negocio B.
- **Opción A — filtro por phone_number (MVP)**: Agregar al nodo Qdrant:
  ```json
  "filter": { "must": [{ "key": "phone_number", "match": { "value": "{{ $('WAHA Trigger').item.json.payload.from }}" } }] }
  ```
  El upload ya guarda `phone_number` en el payload ✅. Suficiente para beta.
- **Opción B — colección por cliente (producción)**: Nombre dinámico `knowledge_{{ $('WAHA Trigger').item.json.session }}`. Aislamiento total, fácil de borrar por cliente, mejor performance. El nodo Qdrant en n8n ya acepta expresiones en el nombre de colección. Requiere actualizar el portal upload para usar la colección correcta.
- **Impacto**: **Crítico antes de agregar segundo cliente.**

### ~~Ollama en docker-compose (stack autocontenido)~~ ✅ Resuelto 2026-03-18
- Servicio `ollama` agregado al docker-compose con entrypoint que hace pull automático de `nomic-embed-text`.
- **Pendiente**: actualizar credencial Ollama en n8n de `http://host.docker.internal:11434` → `http://ollama:11434`

---

## Prioridad Alta (Portal)

### Admin panel: gestión de clientes por negocio
- **Problema**: El portal actual es per-token (cada usuario ve solo su config). El dueño del negocio no puede ver la lista de clientes que le han escrito, ni marcar VIPs, ni ver historial por cliente. Esto es lo que da valor real al producto — configuración cliente a cliente.
- **Solución**: Nueva vista `/admin?token=BUSINESS_TOKEN` en el portal:
  - Lista de todos los `chat_control` rows que han interactuado con el negocio (filtrar por `waha_session_id`)
  - Toggle VIP por cliente (is_vip)
  - Ver status (AUTO/MANUAL/PAUSED) por cliente
  - Ver historial de conversación de cada cliente
  - Métricas por cliente (mensajes, escalaciones)
- **VIP routing en workflow**: Cuando `is_vip = true`, el flujo debe:
  - NO marcar como leído (skip Send Seen) → el dueño ve el mensaje pendiente en WhatsApp
  - NO pasar por AI Agent → va directo a humano
  - Notificar al dueño (futuro: WhatsApp/Slack alert)
- **Impacto**: Alto — esto es el panel de control que el dueño del negocio usa día a día. Sin esto, la configuración es por SQL/portal individual.
- **Requiere**: API route nueva (`/api/admin/[token]`), página Next.js, query a chat_control por session.

### IP Whitelist por cliente
- **Problema**: El portal (`/qr`, `/settings`, `/dashboard`, `/upload`) es accesible desde cualquier IP con el token UUID. Un token filtrado compromete el acceso.
- **Solución propuesta**: Guardar `allowed_ips TEXT[]` en `chat_control`. En el middleware de Next.js (`middleware.ts`), verificar que `req.ip` esté en la lista antes de servir cualquier ruta del portal. Fallback: rate limiting por token (max 100 req/hora).
- **Implementación**: `middleware.ts` en `portal/` + columna `allowed_ips` en Postgres + UI en `/settings` para agregar/quitar IPs.
- **Prioridad**: Media-Alta — implementar antes de deploy en producción con clientes reales.

---

## Prioridad Alta (Pre-producción — pendientes críticos)

### Fix: `Escalar a Humano` tool no funciona
- **Problema**: El tool usa `$helpers.pool.query()` que no existe en el contexto de `toolCode` en n8n. El agente puede llamar el tool pero el status nunca se actualiza a MANUAL en Postgres.
- **Solución**: Reemplazar `toolCode` por un `toolWorkflow` que llame a un sub-workflow de n8n dedicado a hacer el UPDATE, o inyectar la lógica como un nodo post-agente que parsea la respuesta y actualiza si detecta `action: escalate`.
- **Workaround temporal**: El agente responde el mensaje de escalación pero el chat queda en AUTO. El humano debe cambiar manualmente a MANUAL desde el portal.

### Notificación al humano en escalaciones
- **Problema**: Cuando el agente escala a humano, nadie se entera. El dueño del negocio no sabe que hay un cliente esperando. No hay canal de notificación.
- **Solución propuesta**:
  - Agregar columna `agent_whatsapp TEXT` en `chat_control` (número del agente/dueño que recibe alertas)
  - En el flujo de escalación: después de poner status=MANUAL, enviar mensaje via WAHA al `agent_whatsapp`:
    ```
    🔔 *Escalación requerida*
    Cliente: {phone_number}
    Último mensaje: {mensaje_del_cliente}
    Responde directo desde WhatsApp o ve al portal.
    ```
  - El agente puede responder desde su celular directamente al cliente (WAHA actúa como bridge)
- **Alternativa futura**: Integrar con Slack, email o Telegram para notificaciones
- **Impacto**: Alto — sin esto el "paso a humano" no funciona en producción real.

### ~~RAG no filtra por cliente (Qdrant multi-tenant)~~ ✅ Resuelto 2026-03-18
- **Fix aplicado**: Filtro Qdrant cambiado de `session` (no existía en vectores) a `phone_number` (alineado con portal upload).
- **Extras**: Stale lock auto-cleanup (5min), AI Agent error handling con fallback message, Check AI OK? gate.
- **Versión**: Workflow dev v0.5

### Portal: rebuild requerido tras cambios TypeScript
- **Problema**: Los cambios a `types.ts`, `SettingsForm.tsx` y `route.ts` requieren rebuild del contenedor portal.
- **Acción**: `docker compose up --build portal -d`

### Qdrant collection por cliente (en upload)
- **Problema actual**: El portal sube archivos a colección `knowledge_base` fija. Con múltiples clientes necesitas colecciones separadas o filtros por `phone_number`.
- **Solución**: Ya hay `phone_number` en el payload de cada chunk ✅ — el filtro Qdrant es suficiente para MVP. Colecciones separadas son mejor para escala pero no urgente.

---

## ✅ Resuelto Recientemente

### Portal Cliente Web (2026-03-17)
- **Problema**: Clientes sin acceso técnico no podían re-autenticar WAHA ni hacer self-service
- **Solución**: App Next.js 14 en `portal/` con shadcn/ui + Tailwind. Auth via UUID token en URL.
- **Implementado**: `/qr?token=UUID` — polling WAHA cada 3s, auto-start de sesión, UI dark mode
- **Pendiente**: `/settings` (horarios, modo), `/dashboard` (métricas), upload RAG

---

---

## 🚀 Migración a FastAPI + LangGraph (Post-validación Beta)

### Cuándo migrar
Cuando n8n se convierta en bottleneck real: 2-3 clientes pagando, testing imposible, o lógica demasiado compleja para nodos visuales. **No antes de validar ROI con beta.**

### Stack destino
| Componente | Tecnología |
|-----------|-----------|
| API / Webhooks | FastAPI |
| Agent Orchestration | LangGraph (grafo visual + debugging) |
| RAG Embeddings | Gemini Embeddings 2.0 (multimodal) o Ollama (fallback local) |
| RAG Vector DB | Qdrant (se reutiliza) |
| Testing | pytest + pytest-asyncio |
| Visualización de flujos | LangGraph Studio (equivalente visual a n8n) |
| DB | PostgreSQL (se reutiliza) |
| Deploy | Coolify / Docker (se reutiliza) |

### Estructura multi-agente con Claude Code

La migración se ejecuta desde este mismo repo usando **agentes especializados de Claude Code** en subcarpetas. Cada agente tiene su contexto, su CLAUDE.md y su responsabilidad:

```
openclaw/
├── n8n-waha-docker/          ← Proyecto actual (n8n, referencia)
│   ├── CLAUDE.md
│   └── ...
│
└── whatsapp-ai-api/          ← Proyecto FastAPI (nuevo)
    ├── CLAUDE.md              ← Contexto maestro del proyecto FastAPI
    │
    ├── agents/                ← Agentes Claude Code especializados
    │   ├── 01-requirements/
    │   │   └── CLAUDE.md      ← Agente: Requerimientos / Historia de negocio
    │   │                        Input: CLAUDE.md del proyecto n8n, entrevistas con David
    │   │                        Output: PRD, user stories, acceptance criteria
    │   │
    │   ├── 02-architecture/
    │   │   └── CLAUDE.md      ← Agente: Diseño / Arquitectura
    │   │                        Input: PRD del agente 01
    │   │                        Output: diagramas, schemas, API contracts, DB migrations
    │   │
    │   ├── 03-development/
    │   │   └── CLAUDE.md      ← Agente: Desarrollo + Tests unitarios + Versionado
    │   │                        Input: arquitectura del agente 02
    │   │                        Output: código FastAPI + LangGraph, unit tests, commits
    │   │                        Tools: pytest, git, linters
    │   │
    │   ├── 04-qa/
    │   │   └── CLAUDE.md      ← Agente: QA / Tests E2E automáticos
    │   │                        Input: código del agente 03
    │   │                        Output: test suite E2E, integration tests, load tests
    │   │                        Tools: pytest, httpx, Playwright (portal), k6 (load)
    │   │
    │   └── 05-deployment/
    │       └── CLAUDE.md      ← Agente: Deployment / Infra
    │                            Input: código probado del agente 03+04
    │                            Output: Dockerfiles, docker-compose, Coolify config,
    │                                    CI/CD pipeline, monitoring, backups
    │
    ├── src/
    │   ├── main.py            ← FastAPI app
    │   ├── agents/            ← LangGraph agent definitions
    │   │   ├── customer_agent.py    ← Agente principal (reemplaza AI Agent de n8n)
    │   │   ├── rag_tool.py          ← RAG search tool
    │   │   ├── inventory_tool.py    ← MCP Router (Allegra/Sheets/mock)
    │   │   └── escalation_tool.py   ← Escalación a humano
    │   ├── middleware/
    │   │   ├── locks.py       ← Velocity gate (try/catch nativo, adiós locks huérfanos)
    │   │   ├── business_hours.py
    │   │   └── rate_limit.py
    │   ├── models/            ← SQLAlchemy / Pydantic
    │   └── routers/           ← FastAPI routers (webhook, portal API)
    │
    ├── tests/
    │   ├── unit/              ← pytest: cada componente aislado
    │   ├── integration/       ← pytest: flujo completo con DB real
    │   └── e2e/               ← Playwright + httpx: portal + WhatsApp mock
    │
    ├── docker-compose.yml
    ├── Dockerfile
    └── pyproject.toml
```

### Workflow de migración por fases

**Fase 1 — Agente 01 (Requerimientos)**:
- Revisar CLAUDE.md + workflow n8n + docs existentes
- Documentar TODOS los flujos como user stories con acceptance criteria
- Identificar lo que n8n hace bien vs. lo que es workaround

**Fase 2 — Agente 02 (Arquitectura)**:
- Diseñar API contracts (OpenAPI spec)
- Definir LangGraph state graph (equivalente visual al workflow n8n)
- Schema DB unificado (resolver deuda técnica SQL de una vez)

**Fase 3 — Agente 03 (Desarrollo)**:
- Implementar endpoint por endpoint con TDD
- Unit tests para cada componente (locks, business hours, RAG, escalation)
- Git commits semánticos, branches por feature

**Fase 4 — Agente 04 (QA)**:
- E2E tests: simular mensaje WhatsApp → verificar respuesta
- Integration tests: webhook → DB → Qdrant → LLM → response
- Load tests: verificar que soporta N mensajes concurrentes

**Fase 5 — Agente 05 (Deployment)**:
- Dockerizar, Coolify config, DNS, SSL
- CI/CD: GitHub Actions → tests → deploy automático
- Monitoring: health checks, alertas, logs centralizados

### RAG Multimodal con Gemini Embeddings 2.0 (Post-beta)

**Referencia**: [Google y Claude Code cambian el RAG para siempre](http://www.youtube.com/watch?v=74iB941XRPk) — Agustín Medina

**Problema actual**: El pipeline RAG extrae texto plano de PDFs (OCR) y lo embede con Ollama/nomic-embed-text. Se pierden tablas, diagramas, pinouts e imágenes de productos — contenido crítico para una tienda de electrónica.

**Solución**: Gemini Embeddings 2.0 procesa texto, imagen, video y audio en un **espacio de incrustación unificado**. Un datasheet con tabla de specs + diagrama de pines se embede completo, sin perder contexto visual.

**Impacto para el negocio**:
- Catálogos de componentes con tablas de specs → búsqueda precisa por parámetros visuales
- Manuales técnicos con diagramas → el agente responde "cómo conectar X" con la imagen exacta
- Datasheets de fabricantes → embeddings que entienden pinouts, footprints, valores de resistencias

**Implementación (en la migración FastAPI)**:
```
PDF/imagen → Gemini Embeddings 2.0 API → Qdrant → RAG multimodal
```
- Reemplaza Ollama embeddings por Gemini API en el pipeline de ingesta
- Qdrant compatible (solo cambia dimensión del vector)
- Costo: API de pago (Google AI Studio) — evaluar vs. valor del caso de uso
- Fallback: mantener Ollama/nomic-embed-text para clientes que no requieran multimodal

**Timing**: No para beta actual (agrega riesgo). Implementar en Fase 3 de la migración FastAPI, cuando el pipeline de ingesta se reescriba en Python con tests.

### Ventajas de la migración
- **Testing real**: pytest con mocks de LLM, assertions exactas, CI/CD
- **Error handling nativo**: try/catch en vez de locks huérfanos
- **Visualización**: LangGraph Studio muestra el grafo como n8n
- **Multi-tenant limpio**: middleware de FastAPI, no hacks en nodos
- **Velocidad de desarrollo**: Claude Code con agentes especializados, no edición manual de JSON

---

### Nota de facturación multi-tenant
Revisar si es posible que TODO (a excepción del despliegue Coolify) cambie por cliente para temas de facturación: API key de Claude, Firecrawl, embeddings, etc. Cada cliente debería poder tener sus propias credenciales para que el consumo se facture directamente a ellos, no a la agencia.

---

## 🧠 Mejoras de IA avanzadas (Fase 2-3, post-migración FastAPI)

### 1. Crawl4AI como reemplazo de Firecrawl
- **Problema**: Firecrawl es SaaS de pago y falla con sitios protegidos. La tool web actual solo extrae de 1 URL (homepage), no hace crawl de páginas de producto.
- **Solución**: [Crawl4AI](https://github.com/unclecode/crawl4ai) — open-source, self-hosted, soporta JavaScript rendering, crawl profundo y extracción con LLM.
- **Estado**: Servicio agregado al `docker-compose.yml` comentado, listo para descomentar.
- **Implementación**: Reemplazar Firecrawl API call en la tool `Consultar_Sitio_Web` por llamada a `http://crawl4ai:11235/crawl`. Permite crawl de múltiples páginas de producto, no solo homepage.
- **Timing**: Fase 2. Para MVP, el RAG con docs subidos manualmente es suficiente.

### 2. Intent classification pre-agente
- **Qué es**: Un clasificador ligero (regex, modelo pequeño, o LLM con prompt mínimo) que ANTES del AI Agent determina la intención del mensaje: `pregunta_producto`, `saludo`, `queja`, `pedir_humano`, `fuera_de_tema`, `nota_de_voz`.
- **Por qué**: Hoy el AI Agent recibe todo y decide él mismo qué hacer. Con un clasificador previo, puedes:
  - Rutear saludos simples a una respuesta estática (sin gastar tokens de Claude)
  - Detectar notas de voz y mandarlas a transcripción antes del agente
  - Identificar quejas/frustración y escalar directamente sin pasar por el agente
  - Filtrar spam o mensajes fuera de tema sin consumir API
- **Costo sin clasificador**: Cada mensaje consume ~500-2000 tokens de Claude, incluso un "hola" o un "ok"
- **Implementación**: En n8n sería un Code node con regex + Switch. En FastAPI/LangGraph sería un nodo del grafo con un modelo barato (Haiku) o incluso reglas.
- **Timing**: Fase 2 (n8n) o Fase 3 (LangGraph).

### 3. Quality gate post-respuesta
- **Qué es**: Un filtro que revisa la respuesta del agente ANTES de enviarla al cliente. Verifica:
  - ¿La respuesta contiene precios inventados? (comparar vs RAG source)
  - ¿Está en el idioma correcto?
  - ¿Es demasiado larga? (truncar)
  - ¿Contiene alucinaciones evidentes? (ej: menciona productos que no están en el RAG)
  - ¿Tiene tono inapropiado?
- **Por qué**: El agente puede generar respuestas plausibles pero incorrectas. Sin gate, esas respuestas llegan directo al cliente. Con gate, se puede redirigir a un fallback: "No estoy seguro de esa información, ¿te conecto con un asesor?"
- **Implementación**: En n8n, un Code node post-AI Agent con reglas heurísticas. En FastAPI, un nodo LangGraph con un segundo LLM call (barato) que evalúa la respuesta contra el contexto RAG.
- **Timing**: Fase 2-3. Para MVP, el fallback actual ("no tengo esa info") es suficiente si el system prompt es bueno.

### 4. Agente de onboarding autónomo
- **Qué es**: Un flujo separado que automatiza la configuración de un cliente nuevo:
  1. Recibe URL del sitio web del cliente
  2. Crawlea el sitio automáticamente (Crawl4AI)
  3. Extrae productos, precios, FAQs, horarios, políticas
  4. Genera chunks y los sube a Qdrant con la clave del negocio
  5. Crea el registro en `chat_control` con config inicial
  6. Genera un system prompt personalizado basado en el contenido encontrado
  7. Opcionalmente: genera las 10 preguntas de prueba esperadas
- **Por qué**: Hoy el onboarding es manual (subir PDFs, configurar en portal, etc.). Con esto, dar de alta un cliente pasa de 2 horas a 10 minutos.
- **Impacto en el negocio**: Esto es lo que hace que "$1,000 setup" sea rentable — el costo real de onboarding baja a casi cero.
- **Timing**: Fase 3 (requiere Crawl4AI funcionando + pipeline de ingesta robusto).

### 5. Router inteligente de tools con LangGraph
- **Qué es**: En vez de que el LLM decida qué tool usar (poco confiable con Haiku), un grafo de estado explícito define las reglas:
  ```
  intent=producto → RAG primero → si vacío → Web → si vacío → fallback humano
  intent=stock    → ERP primero → si error → RAG → fallback
  intent=humano   → escalación directa
  intent=saludo   → respuesta estática
  ```
- **Por qué**: El LLM es bueno generando lenguaje natural pero malo decidiendo cuándo usar qué tool. Con un router explícito, la lógica de negocio es determinista y testeable, y el LLM solo se encarga de generar la respuesta final.
- **Diferencia con intent classification**: El intent classifier dice QUÉ quiere el cliente. El router decide CÓMO resolverlo (qué tools, en qué orden, con qué fallbacks).
- **Implementación**: En n8n sería un Switch gigante (frágil). En LangGraph es exactamente para lo que fue diseñado: grafos de estado con transiciones condicionales.
- **Timing**: Fase 2-3 (core de la migración a LangGraph).

---

## Prioridad Alta (Migración WhatsApp API)

### Migrar de WAHA a WhatsApp Business API (Fase 2-3)
- **Problema**: WAHA usa web scraping del WhatsApp web, lo que implica riesgo de ban, necesidad de lógica de delay/typing simulation, hard cap de 50 mensajes, y re-autenticación manual por QR.
- **Solución**: Migrar a la **API oficial de WhatsApp Business** (Cloud API de Meta). Elimina:
  - Riesgo de ban (es la API oficial)
  - Lógica de delay/typing (no necesaria con API oficial)
  - Hard cap artificial (los límites son los de Meta, mucho más altos)
  - Re-autenticación QR (auth por token, no por sesión web)
- **Costo**: La API oficial cobra por mensaje (~$0.005-0.08 USD según tipo y país). Se traslada al cliente como parte del tier "High Ticket".
- **Timing**: Fase 2-3, cuando haya clientes pagando que justifiquen el costo. WAHA sigue siendo válido para beta/demo.
- **Impacto**: Elimina toda la deuda técnica de anti-ban, delays, QR portal, y WAHA session management.

---

*Este documento se actualizará conforme se resuelvan los puntos.*
