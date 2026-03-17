# 📚 Documentación del Proyecto

Documentación técnica y arquitectura del stack n8n + WAHA + Qdrant.

## Contenido Planeado

- `architecture.md` - Diagrama de arquitectura completo
- `setup.md` - Guía detallada de instalación y configuración
- `api-reference.md` - Referencia de APIs disponibles
- `deployment.md` - Guía de deployment a producción
- `troubleshooting.md` - Problemas comunes y soluciones

## Stack Tecnológico

- **n8n**: Orquestación de workflows
- **WAHA**: WhatsApp HTTP API
- **Qdrant**: Vector database para RAG
- **PostgreSQL**: Base de datos relacional
- **Docker**: Containerización
- **Python**: Scripts de automatización

## Flujo de Datos

```
WhatsApp → WAHA → n8n → [Export Script] → .txt files
                    ↓
                 Qdrant (vectores) + Postgres (metadata)
                    ↓
                 RAG Context → Auto-respuestas
```

## Arquitectura a Futuro (Cloud + RAG Escalable)

```mermaid
flowchart LR
    U[Usuario / Cliente] --> N[n8n - Orquestación y API]
    N --> R[Retriever Service]
    R --> Q[(Qdrant Cloud\nVector DB)]
    R --> RR[Reranker opcional]
    R --> LLM[LLM / Agente]
    LLM --> U

    D[PDF/CSV/Docs grandes] --> S3[(Object Storage\nS3/GCS/Blob)]
    S3 --> EVT[Evento de subida]
    EVT --> MQ[(Queue\nSQS/PubSub)]
    MQ --> W[Workers de Ingesta\nAutoscaling]
    W --> P[Parse + Chunk + Dedupe + Checkpoints]
    P --> E[Embedding Service\nManaged o GPU propia]
    E --> Q
    P --> META[(Postgres\nMetadata + Estado de jobs)]

    O[Observabilidad\nLogs/Metrics/Alerts] --- W
    O --- R
    O --- Q
```

Notas rápidas:
- n8n se mantiene liviano: dispara jobs y consume retrieval, no hace ETL pesado.
- Ingesta asíncrona por cola para evitar timeouts con archivos grandes.
- Retrieval desacoplado para poder mejorar ranking sin tocar la ingesta.
