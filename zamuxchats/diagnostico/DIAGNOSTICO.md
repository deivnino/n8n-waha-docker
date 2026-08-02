# Diagnóstico Cliente 0 Beta — Zamux Electrónica
> Análisis de 518 chats reales de WhatsApp (13.340 mensajes, ~julio 2026).
> Generado programáticamente — ver scripts `analyze_chats.ps1` / `extract_canned.ps1` y datos `_stats_global.json`, `_chats_index.csv`, `_canned_responses.txt`.
> Fecha: 2026-08-02

---

## 0. TL;DR (para decidir el rediseño en LangChain)

Zamux **ya opera como un agente humano con respuestas predefinidas**. El chat no es soporte,
es un **canal de ventas de componentes**: cliente pide lista → asesor busca en zamux.co →
manda links → cliente paga por Nequi → **un humano confirma el comprobante** → despacho + guía.

El agente IA es viable **solo si aceptamos que el 100% del cierre (pago + despacho) es humano**.
La IA debe cubrir el **pre-venta** (identificar productos, cotizar, dar links, resolver FAQ de
sedes/horarios/envíos) y **escalar limpio** en el momento del pago. Eso es ~70% del trabajo de
mensajes y libera al humano para lo que de verdad requiere criterio.

**Lo que hoy tenemos NO sirve** porque asume RAG sobre chats como cerebro. El negocio necesita
3 planos de datos separados (config operativa, catálogo en vivo, y conocimiento curado), no un
solo Qdrant con todo mezclado.

---

## 1. Cómo funciona Zamux realmente (flujo observado)

Patrón dominante (confirmado en decenas de chats, ej. `+57 315 3358040`):

1. **Cliente saluda** → Zamux responde con canned *"Gracias por comunicarte con Zamux Electrónica…"* (353 veces).
2. **Cliente pide componentes** en 3 formatos:
   - Texto plano (lista escrita a mano en el chat) — el más común.
   - **Imagen** de la lista/protoboard/componente físico (**258 de 518 chats = 50% tienen imagen**).
   - **PDF / XLSX** de requerimiento formal (**50 chats con documento**, muchos B2B/institucional).
3. **Asesor busca cada ítem en zamux.co** y manda los **links de producto** uno por uno.
4. Fricción frecuente: el producto **no aparece / no se puede agregar al carrito** → el asesor
   lo **"activa" manualmente** (*"ya te la activo", "ya las puedes poner en tu carrito"*). Esto es
   una acción de catálogo/inventario que hoy es 100% manual.
5. **Cliente paga por Nequi** (318 209 2687, a nombre de Natalia Toro) y **envía comprobante** (imagen/PDF).
6. **Humano confirma el pago** → canned *"Recibimos tu pago, gracias por tu compra"* (22+ veces).
7. **Despacho**: domicilio urgente (cliente pide su propio Rappi/Picap) o transportadora (Envía $9.000 Bogotá).
   Zamux avisa *"pedido listo ✅"* (46+ veces) y luego manda **número de guía** (*"despachado hoy… guía por Envía"*, 45+ veces).

### Segmentos de contacto (no todos son cliente final)
- **Cliente final / estudiantes**: mayoría. Compra rápida, pocos ítems.
- **B2B / institucional** (**68 chats**): colegios, empresas (ej. *Upper Express*, *Colegio Ave María*),
  piden cotización formal con XLSX/PDF, exigen **equivalentes, garantías, NIT, factura electrónica, OC**.
  Flujo distinto y más lento → candidato a **escalado directo a humano** en beta.
- **Proveedores / otros**: ruido para el agente de ventas (no indexar, no responder con lógica de venta).

---

## 2. Números clave (de `_stats_global.json`)

| Métrica | Valor | Implicación para el agente |
|---|---|---|
| Chats totales | 518 | Volumen real de 1 mes |
| Mensajes totales | 13.340 | ~26 msgs/chat promedio |
| Chats con **imagen** del cliente | **258 (50%)** | **Visión es obligatoria**, no opcional |
| Chats con **documento** (PDF/XLSX) | 50 | Parseo de listas/cotizaciones |
| Intención **precio/cotización** | 293 | Núcleo del negocio |
| Intención **stock/disponibilidad** | 281 | Requiere catálogo en vivo (Allegra/web) |
| Intención **sede/dirección** | 249 | FAQ estructurada (config) |
| Intención **horario** | 210 | FAQ estructurada (config) |
| Intención **envío** | 181 | FAQ estructurada (config) |
| Intención **factura/OC/RUT** | 217 | Señal B2B → escalar |
| Intención **pago/comprobante** | 147 | **Punto de escalado a humano** |
| Intención **humano/asesor** | 334 | Alta; muchos ya piden persona |
| Chats **ruido** (≤2 msgs) | 27 | No indexar |
| Chats **solo bot** (cliente 1 msg) | 46 | No indexar como conocimiento |
| Chats **sin cerrar** (última del cliente sin respuesta) | 62 | **Oportunidad**: el agente recupera estos |
| Chats **B2B/proveedor** | 68 | Ruta de escalado / segmento aparte |
| Chats que **exigen humano** (pago/mensajero) | 140 | El 27% toca a un humano sí o sí |

> Nota: `chats_con_audio/video/llamada` salen bajos porque **el export excluyó la mayoría de multimedia**
> (solo hay marcadores `<imagen omitida>`). Los `.ogg`/`.mp4`/`.jpeg` sueltos en `zamuxchats/` son las
> muestras reales de audio/imagen. Las notas de voz existen y **habrá que transcribir** (deuda técnica #9 del CLAUDE.md).

---

## 3. Qué debe hacer el agente (capacidades requeridas)

### 3.1 Debe AUTOMATIZAR (alto volumen, bajo riesgo)
1. **Saludo + FAQ operativa**: horarios, sedes, métodos de pago, opciones de envío. Ya son canned
   → mover a config estructurada (ver §5).
2. **Identificación de producto por texto**: "protoboard 102", "resistencia 220", "2N2222" → match a catálogo.
3. **Identificación de producto por IMAGEN** (50% de chats). **Capacidad crítica, no negociable.** Ver pipeline detallado en §3.4.
4. **Búsqueda en catálogo + links**: devolver enlace `zamux.co/<producto>`, precio y disponibilidad reales.
   Debe salir de **Allegra o la web de Zamux**, NO de RAG (los precios cambian; RAG inventa).
5. **Armar la lista/cotización** y sugerir agregar al carrito.
6. **Recuperar conversaciones colgadas** (62 chats sin cerrar): follow-up automático.

### 3.4 Pipeline imagen → concepto → inventario (la capacidad núcleo)

El cliente casi nunca da un SKU. Da una **foto** o una **lista** y espera que Zamux traduzca eso a
productos vendibles. El agente necesita una cadena de 4 pasos, con la imagen como entrada y una
consulta de inventario como salida:

```
[imagen]  →  (1) VISIÓN        →  (2) NORMALIZACIÓN     →  (3) BÚSQUEDA          →  (4) RESPUESTA
                Claude vision       texto crudo a           consulta al catálogo     link + precio + stock
                describe qué es     "concepto consultable"  (Allegra/web), no RAG    o "no lo tenemos"
```

**(1) Visión** — hay dos sub-casos distintos, con dificultad distinta:
- **Foto de un componente físico** (una protoboard, un sensor, un chip): el modelo debe *reconocer el
  tipo* y sus atributos (ej. "transistor NPN, encapsulado TO-92, marcado 2N2222"). Es lo más difícil:
  a veces solo se ve el marcado impreso, a veces hay que inferir por forma/pines.
- **Foto/scan de una lista escrita** (cuaderno, Excel impreso, PDF): es OCR + estructura. Más fácil,
  se resuelve extrayendo texto y partiéndolo en ítems.

**(2) Normalización a "concepto consultable"** — el paso que hoy hace el asesor en su cabeza y que
más se subestima. "una resistencia de 220" → `{tipo: resistencia, valor: 220Ω, potencia: 1/4W?}`;
"protoboard de 102" → `protoboard MB102`. Sin este paso, la búsqueda en inventario falla porque el
texto del cliente no matchea el nombre del catálogo. Aquí es donde el **conocimiento de vertical**
(equivalencias, sinónimos, jerga: "protoboard wish", "porta pilas") hace la diferencia — ver §4 y §8.

**(3) Búsqueda en inventario** — con el concepto normalizado se consulta el **catálogo en vivo**
(Allegra / web, vía MCP Router), NUNCA RAG para precio/stock. Devuelve match exacto, equivalente, o nada.

**(4) Respuesta / escalado** — si hay match: link + precio + disponibilidad. Si el producto existe
pero está agotado/oculto (caso real muy frecuente, *"ya te la activo"*) → **escalar**, porque activar
producto en el catálogo es acción manual de backend (§3.2.3).

> Estado en lo que tenemos hoy: **no existe**. El workflow actual asume texto y RAG. Este pipeline
> es el trabajo central del rediseño en LangChain y el mayor riesgo técnico del beta.

### 3.2 Debe ESCALAR a humano (sí o sí)
1. **Confirmación de pago** desde comprobante/Nequi (147 chats). El agente detecta el comprobante,
   registra, y pasa a MANUAL para que un humano valide. No confirmar pagos con IA en beta.
2. **Gestión de despacho**: cliente que manda foto del mensajero de la moto, coordinar Rappi/Picap,
   generar y enviar el número de guía. Acción física/operativa → humano.
3. **Activar producto agotado/oculto en el catálogo** (acción de backend manual hoy).
4. **B2B / institucional** (68 chats): cotización formal, equivalentes, garantías, NIT, OC, factura electrónica.
5. **Cliente frustrado o que pide "asesor/humano"** (patrón explícito muy frecuente).

### 3.3 Debe FILTRAR / IGNORAR (ruido)
- Chats ≤2 mensajes (27), solo-bot (46), proveedores, mensajes de sistema/cifrado.
- **No indexar estos en el conocimiento** (§4).

---

## 4. Estrategia de datos para RAG (filtrar ruido + qué indexar)

**Error a evitar**: vectorizar los 518 chats crudos. Problemas: (a) precios viejos/contradictorios,
(b) datos personales de clientes reales (privacidad), (c) ruido y chats de proveedores,
(d) el chat es transaccional, no conocimiento.

**Qué indexar en Qdrant (curado, no crudo):**
- ✅ **FAQ derivada** de las respuestas predefinidas (§ `_canned_responses.txt`): envíos, sedes, horarios,
  pago, políticas. → Convertir a documentos limpios "pregunta → respuesta".
- ✅ **Equivalencias y descripciones técnicas** de componentes (para preguntas tipo "¿sirve un 2N3904 en vez de 2N2222?").
- ✅ **Catálogo enriquecido** (descripciones de zamux.co) para búsqueda semántica de producto — **pero el precio/stock siempre en vivo**.
- ❌ **NO** los chats crudos como fuente de verdad de precios.

**Filtro de ruido ya calculado** en `_chats_index.csv` (columnas `noise`, `only_bot`, `b2b_prov`).
Regla de indexado propuesta: incluir solo chats con `total >= 6`, `noise=False`, `only_bot=False`,
y aun así **extraer conocimiento, no volcar el diálogo**.

---

## 5. Config editable por cliente (respuestas, sedes, horarios) — LA PREGUNTA CLAVE

**Recomendación: Postgres como fuente de verdad + Portal (Next.js) para editar. NO archivos de texto ni Excel.**

Razón: horarios, sedes, número de Nequi, políticas de envío y respuestas predefinidas son
**datos operativos exactos que cambian y que el cliente debe poder editar sin tocarte a ti**.
Un `.txt`/`.xlsx` no versiona, no valida, y no escala multi-tenant. RAG tampoco sirve
(necesitas el dato *exacto*, no el más "parecido"). → **Datos estructurados en BD.**

### Los 3 planos de datos (arquitectura para el rediseño LangChain)

| Plano | Qué contiene | Dónde vive | Cómo se actualiza |
|---|---|---|---|
| **1. Config operativa** | Horarios, sedes, métodos de pago, políticas de envío, respuestas predefinidas, modo AUTO/MANUAL | **Postgres** (tablas/JSONB) | **Portal `/settings`** (el cliente lo edita) |
| **2. Catálogo (precio/stock)** | Productos, precios, disponibilidad, links | **Allegra API / web zamux.co** (en vivo, vía tool) | Automático desde el ERP/web |
| **3. Conocimiento fuzzy** | FAQ, equivalencias, specs técnicas | **Qdrant** (curado) | Re-indexado al onboardear / actualizar catálogo |

### Esquema Postgres propuesto (extiende `chat_control`)
```sql
-- Config operativa editable por cliente (una fila por cliente / phone_number)
CREATE TABLE client_settings (
    phone_number     TEXT PRIMARY KEY REFERENCES chat_control(phone_number),
    business_name    TEXT,
    timezone         TEXT DEFAULT 'America/Bogota',
    schedule         JSONB,   -- horarios por día {"mon":{"open":"08:00","close":"18:00"}, ...}
    locations        JSONB,   -- [{"name":"Sede Santo Tomás","address":"Calle 51 #13-21","hours":"..."}]
    payment_methods  JSONB,   -- [{"type":"nequi","number":"3182092687","holder":"Natalia Toro"}]
    shipping_policy  JSONB,   -- {"domicilio":"...","transportadora":{"envia_bogota":9000}}
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Respuestas predefinidas (canned) — reemplaza el copy/paste manual actual
CREATE TABLE canned_responses (
    id           SERIAL PRIMARY KEY,
    phone_number TEXT REFERENCES chat_control(phone_number),
    intent       TEXT,    -- 'saludo' | 'horarios' | 'envios' | 'pago' | 'pedido_listo' | 'despachado'
    body         TEXT,
    active       BOOLEAN DEFAULT TRUE
);
```

El agente LangChain lee `client_settings` + `canned_responses` al arrancar cada conversación
(o cacheado), y el **portal ya planeado (`/settings`)** es la UI para que el cliente los edite.
Esto convierte el copy/paste manual de hoy en config gobernada.

### Seed inmediato
Las 55 plantillas de `_canned_responses.txt` **son el seed de `canned_responses`**. Ya está el
contenido real, validado por el uso. Solo hay que limpiarlas (quitar nombres de asesor tipo
"mi nombre es JULIETH") y clasificarlas por `intent`.

---

## 6. Capacidades técnicas nuevas requeridas (checklist para viabilidad)

- [ ] **Visión / OCR de imágenes** (50% de chats): componente físico o lista escrita → texto → catálogo.
      Claude vision como tool del agente. **Bloqueante para beta.**
- [ ] **Tool de catálogo en vivo** (Allegra API o scraper zamux.co) con precio+stock+link. **Bloqueante.**
- [ ] **Parseo de PDF/XLSX** de listas de materiales (50 chats, B2B). Media prioridad.
- [ ] **Transcripción de notas de voz** (.ogg) — Whisper/Groq antes del agente. Media prioridad.
- [ ] **Detección de comprobante de pago** → registrar + escalar. Alta prioridad (147 chats).
- [ ] **Config operativa en Postgres + portal** (§5). Alta prioridad.
- [ ] **Escalado B2B/institucional** por intención (factura/OC/NIT). Media prioridad.
- [ ] **Follow-up de chats colgados** (62). Baja prioridad (mejora, no bloqueante).

---

## 7. Recomendación de alcance para el Beta (MVP realista)

**Fase 1 (beta que sí sirve):** agente cubre pre-venta —
saludo + FAQ (config), identificación de producto por **texto e imagen**, búsqueda en catálogo +
links, y **escala a humano en el pago**. B2B → escalado directo. Nada de confirmar pagos ni
despachos con IA.

**Fase 2:** parseo PDF/XLSX, notas de voz, follow-up de colgados, y agregar al carrito automático.

Con Fase 1 el agente absorbe la mayoría de los 13.340 mensajes/mes (saludos, FAQ, búsqueda de
producto) y el humano solo entra en pago/despacho/B2B. Eso es un ROI medible y defendible ante el cliente.

---

## 8. Qué es reusable multi-tenant (de "agente para Zamux" a "agencia replicable")

El diagnóstico se hizo sobre Zamux, pero la mayoría de lo que revela **no es específico de Zamux**.
La regla de diseño para el rediseño en LangChain: separar lo que se construye **una vez** (plataforma),
de lo que se **reusa por sector** (vertical), de lo que **cambia por cliente** (config/datos). El objetivo
es que dar de alta un cliente nuevo sea "correr el diagnóstico + llenar config", **cero código**.

### 8.1 Núcleo de plataforma — genérico, se construye UNA vez (es el producto)
- **Esqueleto del agente**: automatizar pre-venta + escalar en el pago/logística. Ese patrón sirve a
  casi cualquier PYME de venta por WhatsApp, no solo electrónica.
- **Tools genéricas** (reciben input, devuelven texto; no saben que es Zamux): visión/OCR, parseo
  PDF/XLSX, transcripción de audio, detección de comprobante → escalar.
- **MCP Router de inventario** (ya diseñado en CLAUDE.md): el agente llama "buscar producto"; detrás
  se enchufa Allegra / Sheets / Shopify / scraper según el cliente. Router genérico, backend por cliente.
- **Esquema de BD** (`client_settings`, `canned_responses`, `chat_control`, locks, colas): las tablas
  son genéricas; el contenido es por cliente.
- **Taxonomía de intenciones** (precio, stock, sede, horario, envío, pago, humano, factura): casi
  universal para retail. Se reutiliza tal cual.
- **Motor de escalado** (reglas: comprobante→humano, "asesor"→humano, B2B→humano) y **filtro de ruido** para RAG.
- **Portal** (`/qr`, `/settings`, `/dashboard`) segregado por token/cliente.

### 8.2 El activo más valioso: el pipeline de onboarding
`analyze_chats.ps1` **no es un script de una vez, es un producto de agencia.** Todo cliente nuevo
entrega su export de WhatsApp igual que Zamux. Generalizándolo (quitar hardcodeo de `Tú`/Nequi,
parametrizar carpeta y sector) se convierte en un **"diagnóstico de onboarding automático"** que por
cada prospecto:
- mide volumen, intenciones y % de imágenes → **sabes si es viable antes de venderle**;
- extrae sus respuestas predefinidas reales → **seed de `canned_responses` sin escribir a mano**;
- detecta su ruta de escalado (dónde entra el humano en *su* negocio).

Esto baja el onboarding de días a horas y es diferenciador comercial.

### 8.3 Capa por vertical — reusable entre clientes del MISMO sector
No universal, pero no se reconstruye por cliente. Para electrónica:
- Prompt de visión de dominio ("identifica este componente electrónico y su marcado/valor").
- Normalización y **equivalencias/sinónimos/jerga** ("protoboard wish", "porta pilas", 2N2222≈2N3904).

Segundo cliente de electrónica → se reutiliza entero. Farmacia/repuestos → se cambia esta capa.
**Guardar como "paquete de vertical" separado**: ni mezclado con lo genérico, ni reconstruido por cliente.

### 8.4 Config y conocimiento — por cliente, puro dato (nunca código)
- Respuestas predefinidas, horarios, sedes, métodos de pago, políticas de envío → `client_settings` / `canned_responses`.
- Backend de catálogo elegido (Allegra para Zamux; otro cliente otro).
- Umbrales de negocio (qué es B2B, hard cap de mensajes).
- Conocimiento curado en Qdrant, segregado por `client_id`.

### Resumen
| Capa | Qué es | Se construye/actualiza |
|---|---|---|
| **Plataforma** | Motor, tools, MCP Router, esquema BD, escalado, portal, pipeline onboarding | Una vez |
| **Vertical** | Prompt de visión de dominio, equivalencias/jerga | Una vez por sector |
| **Cliente** | Config operativa, canned, backend catálogo, RAG curado | Dato en BD/portal, cero código |

---

## Anexos (archivos en esta carpeta)
- `_stats_global.json` — métricas agregadas
- `_chats_index.csv` — una fila por chat con métricas, intenciones y flags (noise/b2b/needs_human/unfinished)
- `_canned_responses.txt` — 55 respuestas predefinidas reales (seed para `canned_responses`)
- `analyze_chats.ps1` / `extract_canned.ps1` — pipeline reproducible (reejecutar si llegan más chats)
