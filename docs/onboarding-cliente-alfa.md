# Onboarding Cliente Alfa 0.0 — Guía Paso a Paso
> David (yo) — Tienda de componentes electrónicos, Bogotá
> Última actualización: 2026-03-23

---

## Objetivo

Que el agente IA responda con información **específica del negocio**, no genérica.
Para eso necesitamos alimentar el RAG con contenido real: chats, catálogo, sitio web, FAQs.

---

## Pre-requisitos

- [x] Docker stack corriendo (`make up` o `docker-compose up -d`)
- [x] WAHA con sesión activa (verificar en `http://localhost:3000/api/sessions`)
- [ ] Ollama corriendo en host con modelo `nomic-embed-text` descargado
- [x] Qdrant accesible en `http://localhost:6333`
- [x] Python 3.10+ con dependencias instaladas (ver Paso 0)

---

## Paso 0: Instalar dependencias Python

```powershell
cd scripts/utils
pip install langchain-community langchain-text-splitters langchain-ollama qdrant-client pypdf docx2txt beautifulsoup4
```

```powershell
cd scripts/whatsapp
pip install requests
```

Verificar Ollama:
```powershell
ollama list                          # debe aparecer nomic-embed-text
ollama pull nomic-embed-text         # si no está, descargarlo
```

Para Google embeddings (fase 2/3):
```powershell
pip install langchain-google-genai
# Requiere variable de entorno GOOGLE_API_KEY
```

---

## Paso 1: Exportar chats de WhatsApp desde WAHA ✅ HECHO

> **IMPORTANTE**: El script requiere `--api-key` porque WAHA usa autenticación `X-Api-Key`.

```powershell
cd scripts/whatsapp

# Exportar TODOS los chats
python export_chats.py --api-key bd81ed2fa1be43e69404580174646db6

# Exportar solo un chat específico
python export_chats.py --api-key bd81ed2fa1be43e69404580174646db6 --chat-id 573168294407

# Limitar a los 20 chats más recientes
python export_chats.py --api-key bd81ed2fa1be43e69404580174646db6 --limit 20

# Para otra sesión WAHA (otro cliente)
python export_chats.py --api-key bd81ed2fa1be43e69404580174646db6 --session nombre-cliente
```

**Output**: archivos `.txt` en `data/whatsapp_exports/`

### Qué chats priorizar
1. **Chats con clientes preguntando por productos** — precio, disponibilidad, specs
2. **Chats con preguntas frecuentes** — horarios, ubicación, envíos, garantía
3. **Chats con negociaciones** — el agente aprende cómo responde el negocio

### Qué chats EXCLUIR
- Chats personales / familiares
- Grupos irrelevantes
- Chats con solo multimedia sin texto útil

> **Tip**: Revisa los `.txt` exportados y borra los que no aporten antes de vectorizar.

---

## Paso 2: Limpiar chats exportados ⬅️ AQUÍ ESTAMOS

Ir a `data/whatsapp_exports/` y **borrar manualmente** los .txt irrelevantes.
Quedarse solo con chats que aporten contexto al negocio.

---

## Paso 3: Crear FAQ manual del negocio (MAYOR IMPACTO)

Crear archivo `gemini_exported/faq-tienda.txt` con info real:

```
PREGUNTAS FRECUENTES - [Nombre de la Tienda]

P: ¿Cuál es el horario de atención?
R: Lunes a viernes de 8am a 6pm, sábados de 9am a 2pm. Domingos cerrado.

P: ¿Dónde están ubicados?
R: [Dirección exacta, barrio, ciudad]. Cerca de [referencia].

P: ¿Hacen envíos a otras ciudades?
R: Sí, enviamos a toda Colombia por [transportadora]. El costo depende del peso y destino.

P: ¿Cuáles son los métodos de pago?
R: Efectivo, Nequi, Daviplata, transferencia Bancolombia. Para envíos: pago anticipado.

P: ¿Tienen garantía?
R: Sí, todos los componentes tienen [X] meses de garantía por defectos de fábrica.

P: ¿Pueden conseguir un componente que no tienen en stock?
R: Sí, podemos hacer pedidos especiales. El tiempo de llegada es de [X] días hábiles.
```

También agregar:
| Tipo de documento | Formato | Ejemplo |
|---|---|---|
| Catálogo de productos | PDF/TXT/DOCX | Lista con nombres, precios, specs |
| Info de la tienda | TXT | Dirección, horarios, métodos de pago, envíos |
| Políticas | TXT | Garantía, devoluciones, tiempos de entrega |

> **Este archivo es el que más impacto tiene**. Entre más específico, menos genérico el agente.

---

## Paso 4: Vectorizar todo en Qdrant

`vectorize.py` ya apunta por defecto a la colección `knowledge_base` (la misma que lee el workflow n8n).

### Vectorizar archivos individuales

```powershell
cd scripts/utils

# FAQ (chunks pequeños = respuestas precisas)
python vectorize.py "../../gemini_exported/faq-tienda.txt" --chunk-size 500

# Chat exportado
python vectorize.py "../../data/whatsapp_exports/nombre_chat.txt" --chunk-size 500

# PDF de catálogo (chunks más grandes)
python vectorize.py "../../gemini_exported/catalogo.pdf" --chunk-size 1000

# Forzar re-indexado si ya existía
python vectorize.py "../../gemini_exported/faq-tienda.txt" --force-reindex --chunk-size 500
```

### Vectorizar TODOS los chats de un tirón (PowerShell)

```powershell
Get-ChildItem "../../data/whatsapp_exports/*.txt" | ForEach-Object {
    Write-Host ">>> Vectorizando: $($_.Name)"
    python vectorize.py $_.FullName --chunk-size 500 --skip-existing-check
}
```

### Vectorizar TODO en gemini_exported/

```powershell
Get-ChildItem "../../gemini_exported/*" -Include *.pdf,*.txt,*.docx | ForEach-Object {
    Write-Host ">>> Vectorizando: $($_.Name)"
    python vectorize.py $_.FullName --skip-existing-check
}
```

### Opciones avanzadas del CLI

```
--collection NOMBRE      Colección Qdrant (default: knowledge_base)
--embedding-provider     ollama | google (default: ollama)
--embedding-model        Modelo específico (default: nomic-embed-text / text-embedding-004)
--ollama-url             URL de Ollama (default: http://localhost:11434)
--qdrant-url             URL de Qdrant (default: http://localhost:6333)
--chunk-size N           Tamaño de chunk en chars (default: 1000)
--chunk-overlap N        Overlap entre chunks (default: 100)
--force-reindex          Re-embeber todo aunque ya exista
--skip-existing-check    No verificar duplicados (más rápido para carga inicial)
```

### Google Embeddings (Fase 2/3)

```powershell
$env:GOOGLE_API_KEY = "tu-api-key-aquí"
python vectorize.py "archivo.pdf" --embedding-provider google
# Usa text-embedding-004 por defecto, o especificar:
python vectorize.py "archivo.pdf" --embedding-provider google --embedding-model models/text-embedding-004
```

> ⚠️ **IMPORTANTE**: Si cambias de provider de embeddings, debes re-vectorizar TODO.
> Los vectores de Ollama y Google no son compatibles entre sí.

---

## Paso 5: Verificar datos en Qdrant

```powershell
# Ver colecciones
curl http://localhost:6333/collections

# Ver cuántos puntos tiene knowledge_base
curl http://localhost:6333/collections/knowledge_base

# Ver algunos puntos con su contenido
curl -X POST http://localhost:6333/collections/knowledge_base/points/scroll `
  -H "Content-Type: application/json" `
  -d '{\"limit\": 5, \"with_payload\": true}'
```

Debe mostrar `points_count` > 0 y el contenido de tus documentos en el payload.

---

## Paso 6: Scraping web con Firecrawl (opcional)

Si la tienda tiene sitio web o redes sociales con info de productos:

```
# Desde Claude Code, usar Firecrawl MCP para:
1. Scrape de la página de productos
2. Scrape de la página de contacto / sobre nosotros
3. Guardar output como .txt → vectorizar con Paso 4
```

Alternativa: Crawl4AI (gratuito, en roadmap) — ver `docs/mejoras-propuestas.md`.

---

## Paso 7: Probar el agente

1. Enviar mensaje de WhatsApp al número conectado
2. Verificar en n8n que el workflow se activa
3. Revisar en los logs del nodo RAG si encontró contexto relevante
4. Si las respuestas siguen genéricas → ver Troubleshooting

---

## Troubleshooting: "Las respuestas son muy genéricas"

| Causa | Síntoma | Fix |
|-------|---------|-----|
| RAG no encuentra nada | Nodo RAG devuelve vacío | Agregar más docs (FAQ, catálogo con precios) |
| Colección equivocada | Hay datos pero agente no los usa | Verificar que workflow y vectorize.py usen `knowledge_base` |
| System prompt débil | Agente ignora contexto RAG | Reforzar: "RESPONDE EXCLUSIVAMENTE basándote en el contexto" |
| Chunks mal dimensionados | RAG encuentra doc pero no la respuesta precisa | `--chunk-size 500` para FAQ/chats, `1000` para docs largos |
| Embeddings inconsistentes | Búsquedas no devuelven lo esperado | Mismo modelo en indexación Y consulta (nomic-embed-text) |

---

## Checklist de Onboarding

- [x] **Paso 0**: Dependencias instaladas
- [x] **Paso 1**: Chats exportados (76 chats)
- [ ] **Paso 2**: Chats limpiados (borrar irrelevantes)
- [ ] **Paso 3**: FAQ creado con info real del negocio
- [ ] **Paso 4**: Todo vectorizado en Qdrant (colección `knowledge_base`)
- [ ] **Paso 5**: Verificado que Qdrant tiene puntos con contenido correcto
- [ ] **Paso 6**: (Opcional) Sitio web scrapeado y vectorizado
- [ ] **Paso 7**: Mensaje de prueba enviado, respuesta específica confirmada

---

## Mejora Pendiente: Metadata de speaker en vectorización

**Objetivo**: Que `vectorize.py` detecte el formato de chat WhatsApp y tagee cada chunk con `speaker: business | customer` en el payload de Qdrant.

**Por qué**: Permitiría filtrar/boostear nativamente en Qdrant los chunks donde habla el negocio (3124376800), mejorando la precisión del RAG sin depender solo del system prompt.

**Implementación**:
1. Detectar si el archivo es un chat WhatsApp exportado (formato `[fecha] nombre: mensaje`)
2. Parsear cada línea para identificar el sender
3. Si el sender es el número del negocio → `speaker: "business"`, si no → `speaker: "customer"`
4. Agregar campo `speaker` al payload en Qdrant
5. En n8n, usar filtro `must` en el nodo RAG para priorizar `speaker: "business"`

**Workaround actual**: System prompt del AI Agent usa `config.phone_number` (de `Get Business Config`) para instruir al LLM a priorizar respuestas del negocio en el contexto RAG. No está hardcodeado — funciona para cualquier cliente.

---

## Post-Onboarding

Una vez que el agente responda bien con datos reales:
1. Replicar el proceso para **cliente 1** (usar `--collection cliente1_knowledge`)
2. Conectar el MCP Router de inventario (Allegra API / Sheets)
3. Activar Firecrawl/Crawl4AI como parte del onboarding automatizado
4. Migrar a Google embeddings para mejor calidad semántica

---

*Guía creada: 2026-03-20 | Actualizada: 2026-03-23*
