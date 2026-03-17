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

### 9. Sin CI/CD ni tests
- **Problema**: Sin tests, sin linters, sin formato declarado. Todo depende de prueba manual.
- **Acción**: Agregar al menos un linter (ruff/flake8) y un smoke test del docker-compose.

### 10. Licencia placeholder
- **Problema**: README dice "MIT (ajusta según tu preferencia)" — no es una decisión real.
- **Acción**: Definir licencia definitiva y agregar archivo `LICENSE`.

### 11. Problemas de encoding
- **Problema**: Textos con caracteres rotos en README, docs y Makefile.
- **Acción**: Normalizar encoding a UTF-8 en todos los archivos.

### 12. Datos sensibles en el repo
- **Problema**: PDFs y `.txt` de contenido real en `gemini_exported/`.
- **Acción**: Mover a `.gitignore` o a almacenamiento externo.

---

*Este documento se actualizará conforme se resuelvan los puntos.*
