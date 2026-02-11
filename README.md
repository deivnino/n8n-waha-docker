# n8n + WAHA Docker Setup

Automated WhatsApp workflows using n8n + WAHA (WhatsApp HTTP API)

## Architecture

- **n8n**: Workflow orchestration (http://localhost:5678)
- **WAHA**: WhatsApp API integration (http://localhost:3000)

## Quick Start

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Environment

- Timezone: America/Bogota (GMT-5)
- n8n API: http://localhost:5678/api/v1
- WAHA API: http://localhost:3000

## Next Steps

1. Access n8n at http://localhost:5678
2. Configure WAHA webhook in n8n
3. Create WhatsApp automation workflows

## Resources

- [n8n Docs](https://docs.n8n.io)
- [WAHA Docs](https://waha.devlikeapro.com)
