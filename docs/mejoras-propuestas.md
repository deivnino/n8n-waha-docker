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

## Prioridad Alta (Portal)

### IP Whitelist por cliente
- **Problema**: El portal (`/qr`, `/settings`, `/dashboard`, `/upload`) es accesible desde cualquier IP con el token UUID. Un token filtrado compromete el acceso.
- **Solución propuesta**: Guardar `allowed_ips TEXT[]` en `chat_control`. En el middleware de Next.js (`middleware.ts`), verificar que `req.ip` esté en la lista antes de servir cualquier ruta del portal. Fallback: rate limiting por token (max 100 req/hora).
- **Implementación**: `middleware.ts` en `portal/` + columna `allowed_ips` en Postgres + UI en `/settings` para agregar/quitar IPs.
- **Prioridad**: Media-Alta — implementar antes de deploy en producción con clientes reales.

---

## ✅ Resuelto Recientemente

### Portal Cliente Web (2026-03-17)
- **Problema**: Clientes sin acceso técnico no podían re-autenticar WAHA ni hacer self-service
- **Solución**: App Next.js 14 en `portal/` con shadcn/ui + Tailwind. Auth via UUID token en URL.
- **Implementado**: `/qr?token=UUID` — polling WAHA cada 3s, auto-start de sesión, UI dark mode
- **Pendiente**: `/settings` (horarios, modo), `/dashboard` (métricas), upload RAG

---

*Este documento se actualizará conforme se resuelvan los puntos.*
