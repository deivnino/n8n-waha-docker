# 📋 n8n Workflows

Esta carpeta contiene los workflows de n8n exportados como JSON.

## 🔄 Importar Workflow

1. Accede a n8n: http://localhost:5678
2. Click en **Workflows** (menú lateral)
3. Click en **Import from File**
4. Selecciona el archivo `.json` de esta carpeta
5. Activa el workflow

## 💾 Exportar Workflow

1. En n8n, abre tu workflow
2. Click en el menú **⋮** (tres puntos)
3. **Download**
4. Guarda el archivo en esta carpeta
5. Renombra con nombre descriptivo (ejemplo: `whatsapp-autoresponder.json`)
6. Commit a git

## 📝 Convención de Nombres

Usa nombres descriptivos:
- `whatsapp-autoresponder.json` - Auto-respuestas de WhatsApp
- `daily-chat-export.json` - Export diario de chats
- `qdrant-indexer.json` - Indexar mensajes en Qdrant
- `crm-integration.json` - Integración con CRM

## 🏷️ Metadata Recomendada

En cada workflow, agrega un nodo "Sticky Note" al inicio con:
```
Workflow: [Nombre]
Descripción: [Qué hace]
Trigger: [Manual/Webhook/Cron]
Última actualización: [Fecha]
Autor: [Tu nombre]
```

## 🔗 Workflows Planeados

- [ ] Auto-export diario de chats WAHA
- [ ] Indexar chats en Qdrant (RAG)
- [ ] Auto-respuestas inteligentes con contexto
- [ ] Notificaciones por palabra clave
- [ ] Backup automático a Google Drive

## 📚 Recursos

- [n8n Workflow Templates](https://n8n.io/workflows)
- [WAHA API Reference](https://waha.devlikeapro.com/docs/api/)
- [Qdrant API](https://qdrant.tech/documentation/quick-start/)
