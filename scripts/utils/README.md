# 🧰 Utilidades Python

Helper functions y utilidades compartidas para los scripts del proyecto.

## Planificado

- `db_helpers.py` - Helpers para Postgres/Qdrant
- `waha_client.py` - Cliente wrapper para WAHA API
- `logger.py` - Configuración centralizada de logging
- `config.py` - Carga de configuración desde .env

## Uso

```python
from utils.waha_client import WAHAClient

client = WAHAClient(base_url="http://localhost:3000")
chats = client.get_chats()
```
