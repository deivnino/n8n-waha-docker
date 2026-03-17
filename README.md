# n8n + WAHA + Qdrant - WhatsApp Automation Stack

Plataforma completa de automatización de WhatsApp con RAG (Retrieval-Augmented Generation).

## 🏗️ Arquitectura

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│    n8n      │◄────►│    WAHA     │◄────►│  WhatsApp   │
│  Workflows  │      │  HTTP API   │      │     Web     │
└──────┬──────┘      └─────────────┘      └─────────────┘
       │
       │
       ▼
┌─────────────┐      ┌─────────────┐
│   Qdrant    │◄────►│  Postgres   │
│  Vector DB  │      │   Storage   │
└─────────────┘      └─────────────┘
```

## 📁 Estructura del Proyecto

```
n8n-waha-docker/
├── docker-compose.yml      # Infraestructura (n8n, WAHA, Qdrant, Postgres)
├── Makefile                # Comandos rápidos (make up, make logs, etc.)
├── README.md               # Este archivo
│
├── workflows/              # n8n workflows (exportar/importar JSON)
│   └── README.md
│
├── scripts/                # Scripts de automatización
│   ├── whatsapp/
│   │   ├── export_chats.py       # ⭐ Exportar chats desde WAHA
│   │   ├── requirements.txt
│   │   └── README.md
│   └── utils/
│
├── data/                   # Datos generados (gitignored)
│   ├── whatsapp_exports/   # Exports de chats (.txt)
│   └── logs/
│
└── docs/                   # Documentación del proyecto
```

## 🚀 Quick Start

### 1. Levantar servicios
```bash
make up
# O manualmente: docker-compose up -d
```

### 2. Verificar servicios
```bash
make ps
```

Servicios disponibles:
- **n8n**: http://localhost:5678 (workflows)
- **WAHA**: http://localhost:3000 (WhatsApp API)
- **Qdrant**: http://localhost:6333 (vector DB)
- **pgAdmin**: http://localhost:5050 (database admin)

### 3. Conectar WhatsApp (primera vez)
```bash
# Ver logs de WAHA para obtener QR
docker-compose logs -f waha

# O acceder a http://localhost:3000 para escanear QR
```

### 4. Exportar chats de WhatsApp
```bash
cd scripts/whatsapp
pip install -r requirements.txt
python export_chats.py
```

Los chats se guardan en `data/whatsapp_exports/`

## 🛠️ Comandos Útiles

```bash
make up       # Iniciar todos los servicios
make down     # Detener servicios
make logs     # Ver logs en tiempo real
make ps       # Estado de contenedores
make clean    # Limpiar todo (⚠️ borra volúmenes)
```

## 📋 Workflows n8n

Los workflows están en la carpeta `workflows/`. Para importar:

1. Accede a n8n: http://localhost:5678
2. Click en **Workflows** → **Import from File**
3. Selecciona el archivo `.json` de `workflows/`

Para exportar tus workflows:
1. En n8n: **Workflows** → [Tu workflow] → **⋮** → **Download**
2. Guarda el `.json` en `workflows/`
3. Commitea a git para versionado

## 🔧 Scripts Python

### Export de Chats
Ver documentación completa en [scripts/whatsapp/README.md](scripts/whatsapp/README.md)

```bash
# Exportar todos los chats
python scripts/whatsapp/export_chats.py

# Exportar chat específico
python scripts/whatsapp/export_chats.py --chat-id "521234567890"

# Limitar a 10 chats
python scripts/whatsapp/export_chats.py --limit 10
```

## 🗄️ Base de Datos

### PostgreSQL
- Host: `localhost:5432`
- Database: `chatwoot` (configurable en `.env`)
- User: `chatwoot` (configurable en `.env`)
- Password: Ver `.env`

### pgAdmin
- URL: http://localhost:5050
- Email/Password: Ver `.env`

### Qdrant
- REST API: http://localhost:6333
- gRPC: `localhost:6334`
- Dashboard: http://localhost:6333/dashboard

## ⚙️ Configuración

Crea un archivo `.env` en la raíz con:

```bash
# Postgres
POSTGRES_DB=chatwoot
POSTGRES_USER=chatwoot
POSTGRES_PASSWORD=tu_password_seguro

# pgAdmin
PGADMIN_DEFAULT_EMAIL=admin@example.com
PGADMIN_DEFAULT_PASSWORD=admin

# WAHA (opcional)
WHATSAPP_API_KEY=tu_api_key
```

## 🔮 Próximos Pasos (Roadmap MVP)

- [x] Setup Docker infrastructure
- [x] Integrar Qdrant vector DB
- [x] Script de export de chats WAHA
- [ ] Workflow n8n: Auto-export diario
- [ ] Indexar chats en Qdrant (RAG)
- [ ] Auto-respuestas con contexto (RAG)
- [ ] Dashboard de métricas

## 📚 Recursos

- [n8n Docs](https://docs.n8n.io)
- [WAHA Docs](https://waha.devlikeapro.com)
- [Qdrant Docs](https://qdrant.tech/documentation/)
- [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp) (para scale futuro)

## 🐛 Troubleshooting

### WAHA no conecta
```bash
docker-compose logs waha
docker-compose restart waha
```

### n8n no guarda workflows
```bash
# Verificar permisos del volumen
docker-compose down
docker volume inspect n8n_data
```

### Qdrant no responde
```bash
curl http://localhost:6333/health
docker-compose restart qdrant
```

## 📄 Licencia

MIT (ajusta según tu preferencia).

