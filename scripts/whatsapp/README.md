# 📱 WhatsApp Chat Exporter

Exporta chats de WhatsApp a archivos `.txt` usando la API de WAHA.

## 🚀 Setup Rápido

```bash
# 1. Instalar dependencias
pip install -r requirements.txt

# 2. Asegurar que WAHA está corriendo
cd ../..
docker-compose up -d waha

# 3. Verificar WAHA
curl http://localhost:3000/api/health

# 4. Exportar chats
python export_chats.py
```

## 📖 Uso

### Exportar todos los chats
```bash
python export_chats.py
```

### Exportar chat específico
```bash
python export_chats.py --chat-id "521234567890"
```

### Limitar número de chats
```bash
python export_chats.py --limit 5
```

### Cambiar URL de WAHA
```bash
python export_chats.py --waha-url http://localhost:3000
```

### Especificar sesión de WAHA
```bash
python export_chats.py --session "mi-sesion"
```

## 📁 Output

Los archivos se guardan en:
```
../../data/whatsapp_exports/
    [nombre_chat]_20260220_143000.txt
    [nombre_chat2]_20260220_143015.txt
```

## 📝 Formato de Export

```
============================================================
WhatsApp Chat Export - Juan Pérez
Chat ID: 521234567890@c.us
Fecha de exportación: 20/02/2026, 14:30
Total mensajes: 150
============================================================

[20/02/2026, 10:15] 521234567890: Hola, ¿cómo estás?
[20/02/2026, 10:16] Tú: ¡Muy bien! ¿Y tú?
[20/02/2026, 10:17] 521234567890: 📷 [Imagen] Mira esto
```

## 🔧 Troubleshooting

### Error: No se puede conectar a WAHA
```bash
# Verificar que WAHA está corriendo
docker-compose ps

# Ver logs de WAHA
docker-compose logs waha

# Reiniciar WAHA
docker-compose restart waha
```

### No se encontraron chats
- Asegúrate de que WhatsApp Web está conectado en WAHA
- Accede a http://localhost:3000 y verifica el QR
- Espera unos segundos después de escanear el QR

### Error de permisos
```bash
# Linux/Mac
chmod +x export_chats.py

# Windows: ejecutar PowerShell como Admin si es necesario
```

## 🔮 Próximos Pasos (Fase 2)

- [ ] Integración con Qdrant (indexar automáticamente)
- [ ] Exportar multimedia (imágenes, videos)
- [ ] Filtros por fecha/remitente
- [ ] Cron job automático
- [ ] Webhook desde n8n

## 📚 Referencias

- [WAHA API Docs](https://waha.devlikeapro.com/docs/api/)
- [n8n Workflows](../../workflows/)
