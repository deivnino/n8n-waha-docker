"""
Crawl a client's website via Crawl4AI and vectorize the content into Qdrant.

Usage:
    python scripts/utils/crawl_and_vectorize.py --phone-number 573168294407@c.us
    python scripts/utils/crawl_and_vectorize.py --phone-number 573168294407@c.us --website https://www.zamux.co
    python scripts/utils/crawl_and_vectorize.py --phone-number 573168294407@c.us --dry-run
"""
import argparse
import json
import re
import time
import urllib.request
from pathlib import Path


DEFAULT_CRAWL4AI_URL = "http://localhost:11235"
DEFAULT_WEBSITE = "https://www.zamux.co"
DEFAULT_QDRANT_URL = "http://localhost:6333"
DEFAULT_COLLECTION = "knowledge_base"

# Category pages to crawl (these list many products with prices)
ZAMUX_CATEGORIES = [
    "/arduino",
    "/semiconductores",
    "/semiconductores/circuitos-integrados",
    "/semiconductores/discretos",
    "/miscelanea",
    "/miscelanea/pulsadores-e-interruptores",
    "/conectores",
    "/robotica",
    "/herramientas",
    "/herramientas-de-soldadura",
    "/bases-para-cautin-y-tercera-mano",
    "/leds-y-visualizacion",
    "/resistencias",
    "/condensadores",
    "/motores-y-servomotores",
    "/tarjetas-de-desarrollo",
    "/productos/montaje-superficial/integrados-y-transistores",
    "/tecnologia",
]

# Info pages (store details, policies)
ZAMUX_INFO_PAGES = [
    "/terminos-y-condiciones",
    "/contacto",
]

SKIP_URL_PATTERNS = ["/cart", "/checkout", "/v2/", "/cuenta", "/login", "/registro"]

NAV_GARBAGE = [
    "Tu carro está vacío",
    "Proceder al Pago",
    "Ir al carrito",
    "Envío $0,00",
    "Impuestos $0,00",
    "Descuentos -$0,00",
    "Gift Cards -$0,00",
    "Los costos de envío serán calculados",
]


def parse_args():
    parser = argparse.ArgumentParser(description="Crawl website + vectorize into Qdrant")
    parser.add_argument("--phone-number", required=True, help="phone_number del cliente (ej: 573168294407@c.us)")
    parser.add_argument("--website", default=DEFAULT_WEBSITE, help=f"URL base del sitio. Default: {DEFAULT_WEBSITE}")
    parser.add_argument("--crawl4ai-url", default=DEFAULT_CRAWL4AI_URL, help=f"URL de Crawl4AI. Default: {DEFAULT_CRAWL4AI_URL}")
    parser.add_argument("--qdrant-url", default=DEFAULT_QDRANT_URL)
    parser.add_argument("--collection", default=DEFAULT_COLLECTION)
    parser.add_argument("--ollama-url", default="http://localhost:11434")
    parser.add_argument("--embedding-model", default="nomic-embed-text")
    parser.add_argument("--embedding-provider", choices=["ollama", "google"], default="ollama")
    parser.add_argument("--chunk-size", type=int, default=800, help="Chunk size in chars. Default: 800")
    parser.add_argument("--chunk-overlap", type=int, default=100)
    parser.add_argument("--output-dir", default=None, help="Save crawled markdown to files (optional)")
    parser.add_argument("--dry-run", action="store_true", help="Only crawl and save markdown, don't vectorize")
    parser.add_argument("--delay", type=float, default=1.0, help="Delay between requests in seconds. Default: 1.0")
    parser.add_argument("--include-product-pages", action="store_true", help="Also crawl individual product pages (slow)")
    return parser.parse_args()


def crawl_page(crawl4ai_url: str, url: str, query: str = "") -> str:
    """Crawl a single page via Crawl4AI /md endpoint."""
    payload = json.dumps({"url": url, "f": "fit", "q": query or "productos precios descripcion", "c": "0"}).encode()
    req = urllib.request.Request(
        f"{crawl4ai_url}/md",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        data = json.load(resp)
    return data.get("markdown", "")


def clean_markdown(md: str) -> str:
    """Remove nav, cart, and footer garbage from crawled markdown."""
    lines = md.split("\n")
    cleaned = []
    for line in lines:
        if any(garbage in line for garbage in NAV_GARBAGE):
            continue
        if line.strip().startswith("Productos 0"):
            continue
        cleaned.append(line)

    text = "\n".join(cleaned)

    # Remove the navigation menu block (appears at the top of every page)
    # It starts with category names and ends before actual content
    nav_end_markers = ["¡Bienvenidos a Zamux", "SKU:", "Recién Llegados", "###"]
    for marker in nav_end_markers:
        idx = text.find(marker)
        if idx > 0:
            # Check if there's nav above this
            before = text[:idx]
            if "Síguenos" in before:
                sig_idx = before.rfind("Síguenos")
                # Keep from after "Síguenos" line
                next_newline = before.find("\n", sig_idx)
                if next_newline > 0:
                    text = text[next_newline:].strip()
            break

    return text.strip()


def extract_product_urls(md: str, base_url: str) -> list[str]:
    """Extract product URLs from a category page."""
    base = base_url.rstrip("/").lower()
    links = re.findall(rf'{re.escape(base)}/[a-z0-9\-]+(?:/[a-z0-9\-]+)*', md.lower())
    unique = []
    seen = set()
    for link in links:
        if link not in seen and not any(p in link for p in SKIP_URL_PATTERNS):
            seen.add(link)
            unique.append(link)
    return unique


def crawl_website(args) -> list[dict]:
    """Crawl all pages and return list of {url, content} dicts."""
    base = args.website.rstrip("/")
    pages = []

    # 1. Homepage
    print(f"\n📄 Crawling homepage: {base}")
    md = crawl_page(args.crawl4ai_url, base, "información tienda productos categorías dirección horarios")
    cleaned = clean_markdown(md)
    if cleaned:
        pages.append({"url": base, "content": cleaned, "type": "homepage"})
        print(f"   ✅ {len(cleaned)} chars")

    # 2. Category pages (list products with prices)
    all_product_urls = set()
    for cat_path in ZAMUX_CATEGORIES:
        url = f"{base}{cat_path}"
        print(f"📂 Crawling category: {cat_path}")
        try:
            md = crawl_page(args.crawl4ai_url, url, "productos precios disponibilidad")
            cleaned = clean_markdown(md)
            if cleaned and len(cleaned) > 50:
                pages.append({"url": url, "content": cleaned, "type": "category"})
                print(f"   ✅ {len(cleaned)} chars")
                if args.include_product_pages:
                    urls = extract_product_urls(md, base)
                    all_product_urls.update(urls)
            else:
                print(f"   ⚠️ Empty or too short, skipping")
            time.sleep(args.delay)
        except Exception as e:
            print(f"   ❌ Error: {e}")

    # 3. Info pages
    for info_path in ZAMUX_INFO_PAGES:
        url = f"{base}{info_path}"
        print(f"ℹ️  Crawling info: {info_path}")
        try:
            md = crawl_page(args.crawl4ai_url, url, "dirección horarios contacto políticas garantía envío")
            cleaned = clean_markdown(md)
            if cleaned and len(cleaned) > 50:
                pages.append({"url": url, "content": cleaned, "type": "info"})
                print(f"   ✅ {len(cleaned)} chars")
            time.sleep(args.delay)
        except Exception as e:
            print(f"   ❌ Error: {e}")

    # 4. Individual product pages (optional, slow)
    if args.include_product_pages and all_product_urls:
        # Filter out category URLs
        cat_paths_lower = {f"{base.lower()}{p}" for p in ZAMUX_CATEGORIES}
        product_urls = [u for u in all_product_urls if u not in cat_paths_lower]
        print(f"\n🔍 Crawling {len(product_urls)} individual product pages...")
        for i, url in enumerate(sorted(product_urls)):
            print(f"   [{i+1}/{len(product_urls)}] {url.split('/')[-1]}")
            try:
                md = crawl_page(args.crawl4ai_url, url, "nombre precio descripción stock SKU")
                cleaned = clean_markdown(md)
                if cleaned and len(cleaned) > 50:
                    pages.append({"url": url, "content": cleaned, "type": "product"})
                time.sleep(args.delay)
            except Exception as e:
                print(f"      ❌ {e}")

    return pages


def save_markdown_files(pages: list[dict], output_dir: str):
    """Save crawled pages as markdown files."""
    out = Path(output_dir)
    out.mkdir(parents=True, exist_ok=True)
    for page in pages:
        slug = page["url"].replace("https://", "").replace("http://", "").replace("/", "_").replace(".", "_")
        filepath = out / f"{slug}.md"
        filepath.write_text(f"# {page['url']}\n\n{page['content']}", encoding="utf-8")
    print(f"\n💾 Saved {len(pages)} markdown files to {out}")


def vectorize_pages(pages: list[dict], args):
    """Chunk and vectorize crawled pages into Qdrant."""
    from hashlib import md5
    import uuid

    from langchain_text_splitters import RecursiveCharacterTextSplitter

    if args.embedding_provider == "google":
        from langchain_google_genai import GoogleGenerativeAIEmbeddings
        embed_model = args.embedding_model if args.embedding_model != "nomic-embed-text" else "models/text-embedding-004"
        embeddings = GoogleGenerativeAIEmbeddings(model=embed_model)
        print(f"\nEmbeddings: Google ({embed_model})")
    else:
        from langchain_ollama import OllamaEmbeddings
        embeddings = OllamaEmbeddings(model=args.embedding_model, base_url=args.ollama_url)
        print(f"\nEmbeddings: Ollama ({args.embedding_model} @ {args.ollama_url})")

    from qdrant_client import QdrantClient, models

    splitter = RecursiveCharacterTextSplitter(
        chunk_size=args.chunk_size,
        chunk_overlap=args.chunk_overlap,
    )

    # Build chunks with metadata
    all_chunks = []
    for page in pages:
        text = page["content"]
        chunks = splitter.split_text(text)
        for i, chunk_text in enumerate(chunks):
            content_hash = md5(chunk_text.encode("utf-8")).hexdigest()
            chunk_id = str(uuid.UUID(content_hash))
            all_chunks.append({
                "id": chunk_id,
                "text": chunk_text,
                "metadata": {
                    "source_url": page["url"],
                    "page_type": page["type"],
                    "chunk_index": i,
                    "phone_number": args.phone_number,
                    "content_hash": content_hash,
                },
            })

    print(f"\nTotal chunks: {len(all_chunks)} from {len(pages)} pages")

    if not all_chunks:
        print("No chunks to vectorize!")
        return

    # Connect to Qdrant and create collection if needed
    client = QdrantClient(url=args.qdrant_url)
    existing = {c.name for c in client.get_collections().collections}

    texts_for_embed = [c["text"] for c in all_chunks]

    # Embed in batches
    print("Generating embeddings...")
    batch_size = 64
    all_vectors = []
    for i in range(0, len(texts_for_embed), batch_size):
        batch = texts_for_embed[i:i + batch_size]
        vectors = embeddings.embed_documents(batch)
        all_vectors.extend(vectors)
        print(f"  Embedded {min(i + batch_size, len(texts_for_embed))}/{len(texts_for_embed)}")

    # Create collection if needed
    if args.collection not in existing:
        client.create_collection(
            collection_name=args.collection,
            vectors_config=models.VectorParams(
                size=len(all_vectors[0]),
                distance=models.Distance.COSINE,
            ),
        )
        print(f"Created collection: {args.collection}")

    # Upsert in batches
    upsert_batch = 128
    inserted = 0
    for i in range(0, len(all_chunks), upsert_batch):
        batch_chunks = all_chunks[i:i + upsert_batch]
        batch_vectors = all_vectors[i:i + upsert_batch]
        points = [
            models.PointStruct(
                id=chunk["id"],
                vector=vector,
                payload={
                    "page_content": chunk["text"],
                    "text": chunk["text"],
                    "content": chunk["text"],
                    "metadata": chunk["metadata"],
                    **chunk["metadata"],
                },
            )
            for chunk, vector in zip(batch_chunks, batch_vectors)
        ]
        client.upsert(collection_name=args.collection, points=points, wait=True)
        inserted += len(points)
        print(f"  Upserted {inserted}/{len(all_chunks)}")

    print(f"\n✅ Done! {inserted} chunks vectorized into '{args.collection}'")
    print(f"   phone_number: {args.phone_number}")
    print(f"   pages crawled: {len(pages)}")


def main():
    args = parse_args()

    print(f"🌐 Website: {args.website}")
    print(f"📱 Phone: {args.phone_number}")
    print(f"🔗 Crawl4AI: {args.crawl4ai_url}")

    # Crawl
    pages = crawl_website(args)
    print(f"\n📊 Crawled {len(pages)} pages total")

    # Save markdown if requested
    if args.output_dir:
        save_markdown_files(pages, args.output_dir)

    # Vectorize (unless dry-run)
    if args.dry_run:
        print("\n🏁 Dry run complete. Use without --dry-run to vectorize.")
        for p in pages:
            print(f"  {p['type']:10s} | {len(p['content']):5d} chars | {p['url']}")
    else:
        vectorize_pages(pages, args)


if __name__ == "__main__":
    main()
