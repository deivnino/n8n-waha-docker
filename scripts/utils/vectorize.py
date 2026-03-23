import argparse
from concurrent.futures import ThreadPoolExecutor
import uuid
from hashlib import md5
from pathlib import Path

from langchain_community.document_loaders import (
    BSHTMLLoader,
    Docx2txtLoader,
    PyPDFLoader,
    TextLoader,
)
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_ollama import OllamaEmbeddings
from qdrant_client import QdrantClient, models


DEFAULT_PDF_NAME = "Dualidad Curiosa_ Detective y Biólogo_ -1.pdf"
DEFAULT_COLLECTION = "knowledge_base"
DEFAULT_OLLAMA_MODEL = "nomic-embed-text"
SUPPORTED_EXTENSIONS = {".pdf", ".txt", ".html", ".htm", ".docx"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Vectoriza documentos en Qdrant con deduplicación por contenido.")
    parser.add_argument(
        "source",
        nargs="?",
        default=DEFAULT_PDF_NAME,
        help="Nombre o ruta del archivo (pdf/txt/html/docx). Si no se pasa, usa el archivo por defecto.",
    )
    parser.add_argument(
        "--force-reindex",
        action="store_true",
        help="Fuerza reindexado del archivo actual (re-embebe y hace upsert de todos sus chunks).",
    )
    parser.add_argument(
        "--chunk-size",
        type=int,
        default=1000,
        help="Tamaño de chunk en caracteres. Default: 1000",
    )
    parser.add_argument(
        "--chunk-overlap",
        type=int,
        default=100,
        help="Overlap entre chunks en caracteres. Default: 100",
    )
    parser.add_argument(
        "--embed-batch-size",
        type=int,
        default=128,
        help="Cantidad de chunks por llamada a embeddings. Default: 128",
    )
    parser.add_argument(
        "--upsert-batch-size",
        type=int,
        default=256,
        help="Cantidad de puntos por upsert a Qdrant. Default: 256",
    )
    parser.add_argument(
        "--embed-workers",
        type=int,
        default=1,
        help="Hilos para paralelizar batches de embeddings (1 = secuencial). Default: 1",
    )
    parser.add_argument(
        "--skip-existing-check",
        action="store_true",
        help="Omite retrieve de IDs existentes (útil para cargas iniciales masivas).",
    )
    parser.add_argument(
        "--collection",
        default=DEFAULT_COLLECTION,
        help=f"Nombre de la colección en Qdrant. Default: {DEFAULT_COLLECTION}",
    )
    parser.add_argument(
        "--embedding-provider",
        choices=["ollama", "google"],
        default="ollama",
        help="Proveedor de embeddings: ollama (local) o google (API). Default: ollama",
    )
    parser.add_argument(
        "--embedding-model",
        default=None,
        help="Modelo de embeddings. Default: nomic-embed-text (ollama) o text-embedding-004 (google)",
    )
    parser.add_argument(
        "--ollama-url",
        default="http://localhost:11434",
        help="URL de Ollama. Default: http://localhost:11434",
    )
    parser.add_argument(
        "--qdrant-url",
        default="http://localhost:6333",
        help="URL de Qdrant. Default: http://localhost:6333",
    )
    return parser.parse_args()


def resolve_source_path(requested_name: str) -> Path:
    repo_root = Path(__file__).resolve().parents[2]
    gemini_dir = repo_root / "gemini_exported"

    requested_path = Path(requested_name)
    if requested_path.is_absolute() and requested_path.is_file():
        return requested_path

    candidates = [
        Path.cwd() / requested_name,
        gemini_dir / requested_name,
    ]

    for candidate in candidates:
        if candidate.is_file():
            return candidate

    available_docs = sorted(
        p.name for p in gemini_dir.glob("*") if p.suffix.lower() in SUPPORTED_EXTENSIONS
    ) if gemini_dir.exists() else []
    available_msg = (
        "\nArchivos disponibles en gemini_exported:\n- " + "\n- ".join(available_docs)
        if available_docs
        else "\nNo se encontraron archivos soportados en gemini_exported."
    )

    raise FileNotFoundError(
        f"No se encontró el archivo: {requested_name}.\n"
        f"Probado en: {Path.cwd()} y {gemini_dir}.{available_msg}"
    )


def get_loader(file_path: Path):
    suffix = file_path.suffix.lower()

    if suffix == ".pdf":
        return PyPDFLoader(str(file_path))
    if suffix == ".txt":
        return TextLoader(str(file_path), encoding="utf-8")
    if suffix in {".html", ".htm"}:
        return BSHTMLLoader(str(file_path), open_encoding="utf-8")
    if suffix == ".docx":
        return Docx2txtLoader(str(file_path))

    raise ValueError(
        f"Formato no soportado: {suffix}. Soportados: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
    )


def normalize_text(text: str) -> str:
    return " ".join(text.split()).strip()


def build_content_hash(text: str) -> str:
    return md5(normalize_text(text).encode("utf-8")).hexdigest()


def build_chunk_id(content_hash: str) -> str:
    return str(uuid.UUID(content_hash))


def batch_items(items: list[str], size: int = 200) -> list[list[str]]:
    return [items[i:i + size] for i in range(0, len(items), size)]


def embed_documents_batched(
    embedding_client: OllamaEmbeddings,
    documents,
    batch_size: int,
    workers: int,
) -> list[list[float]]:
    batches = [
        [doc.page_content for doc in documents[i:i + batch_size]]
        for i in range(0, len(documents), batch_size)
    ]

    if workers <= 1:
        vectors: list[list[float]] = []
        for batch in batches:
            vectors.extend(embedding_client.embed_documents(batch))
        return vectors

    vectors_by_batch_index: dict[int, list[list[float]]] = {}
    with ThreadPoolExecutor(max_workers=workers) as executor:
        futures = {
            executor.submit(embedding_client.embed_documents, batch): idx
            for idx, batch in enumerate(batches)
        }
        for future, batch_index in futures.items():
            vectors_by_batch_index[batch_index] = future.result()

    vectors: list[list[float]] = []
    for idx in range(len(batches)):
        vectors.extend(vectors_by_batch_index[idx])
    return vectors

# 1. Configurar Embeddings
args = parse_args()

if args.embedding_provider == "google":
    from langchain_google_genai import GoogleGenerativeAIEmbeddings
    embed_model = args.embedding_model or "models/text-embedding-004"
    embeddings = GoogleGenerativeAIEmbeddings(model=embed_model)
    print(f"Embeddings: Google ({embed_model})")
else:
    embed_model = args.embedding_model or DEFAULT_OLLAMA_MODEL
    embeddings = OllamaEmbeddings(model=embed_model, base_url=args.ollama_url)
    print(f"Embeddings: Ollama ({embed_model} @ {args.ollama_url})")

COLLECTION_NAME = args.collection
print(f"Colección Qdrant: {COLLECTION_NAME}")

# 2. Cargar y procesar el documento
source_path = resolve_source_path(args.source)
loader = get_loader(source_path)
pages = loader.load()

# Dividir el texto en fragmentos (chunks)
text_splitter = RecursiveCharacterTextSplitter(
    chunk_size=args.chunk_size,
    chunk_overlap=args.chunk_overlap,
)
chunks = text_splitter.split_documents(pages)

if not chunks:
    raise RuntimeError(f"El archivo {source_path.name} no produjo fragmentos para vectorizar.")

for chunk_index, doc in enumerate(chunks):
    doc.metadata["source_file"] = source_path.name
    doc.metadata["file_format"] = source_path.suffix.lower().lstrip(".")
    doc.metadata["chunk_index"] = chunk_index
    doc.metadata["page"] = doc.metadata.get("page", -1)
    doc.metadata["content_hash"] = build_content_hash(doc.page_content)

# 3. Almacenar en Qdrant (solo nuevos)
chunk_ids = [
    build_chunk_id(str(doc.metadata["content_hash"]))
    for doc in chunks
]

client = QdrantClient(url=args.qdrant_url)
existing_collections = {collection.name for collection in client.get_collections().collections}

if COLLECTION_NAME not in existing_collections:
    sample_vector = embeddings.embed_documents([chunks[0].page_content])[0]
    client.create_collection(
        collection_name=COLLECTION_NAME,
        vectors_config=models.VectorParams(
            size=len(sample_vector),
            distance=models.Distance.COSINE,
        ),
    )

existing_ids: set[str] = set()
if not args.force_reindex and not args.skip_existing_check:
    for id_batch in batch_items(chunk_ids):
        records = client.retrieve(collection_name=COLLECTION_NAME, ids=id_batch)
        existing_ids.update(str(record.id) for record in records)

new_docs = []
new_ids = []
for doc, doc_id in zip(chunks, chunk_ids):
    if args.force_reindex or doc_id not in existing_ids:
        new_docs.append(doc)
        new_ids.append(doc_id)

inserted_count = 0
if new_docs:
    vectors = embed_documents_batched(
        embedding_client=embeddings,
        documents=new_docs,
        batch_size=args.embed_batch_size,
        workers=args.embed_workers,
    )

    for start in range(0, len(new_docs), args.upsert_batch_size):
        end = start + args.upsert_batch_size
        points = [
            models.PointStruct(
                id=doc_id,
                vector=vector,
                payload={
                    # Claves de contenido para mapear fácil en n8n (contentPayloadKey / textKey / document field)
                    "page_content": doc.page_content,
                    "text": doc.page_content,
                    "content": doc.page_content,
                    # Metadata anidada para usar metadataPayloadKey="metadata" en n8n
                    "metadata": dict(doc.metadata),
                    # También mantenemos metadata plana por compatibilidad hacia atrás
                    **doc.metadata,
                },
            )
            for doc_id, doc, vector in zip(new_ids[start:end], new_docs[start:end], vectors[start:end])
        ]
        client.upsert(collection_name=COLLECTION_NAME, points=points, wait=True)
        inserted_count += len(points)

print(
    f"Archivo: {source_path.name} | chunks totales: {len(chunks)} | "
    f"procesados: {inserted_count} | ya existentes: {len(chunks) - inserted_count} | "
    f"modo: {'force-reindex' if args.force_reindex else 'incremental'}"
)
