import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

const OLLAMA_URL  = process.env.OLLAMA_URL  || "http://localhost:11434";
const QDRANT_URL  = process.env.QDRANT_URL  || "http://localhost:6333";
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || "nomic-embed-text";
const COLLECTION  = "knowledge_base";
const VECTOR_SIZE = 768;
const CHUNK_SIZE  = 500;

// ── Text chunking ──────────────────────────────────────────────────────────
function chunkText(text: string): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];

  for (const para of paragraphs) {
    if (para.length <= CHUNK_SIZE) {
      chunks.push(para);
    } else {
      // Split long paragraphs at sentence boundaries
      const sentences = para.match(/[^.!?]+[.!?]*/g) ?? [para];
      let current = "";
      for (const s of sentences) {
        if ((current + s).length > CHUNK_SIZE && current) {
          chunks.push(current.trim());
          current = s;
        } else {
          current += s;
        }
      }
      if (current.trim()) chunks.push(current.trim());
    }
  }

  return chunks.filter((c) => c.length > 20); // skip trivially short chunks
}

// ── Ollama embed ───────────────────────────────────────────────────────────
async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.embeddings?.[0] ?? data.embedding;
}

// ── Qdrant helpers ─────────────────────────────────────────────────────────
async function ensureCollection() {
  const check = await fetch(`${QDRANT_URL}/collections/${COLLECTION}`);
  if (check.status === 404) {
    await fetch(`${QDRANT_URL}/collections/${COLLECTION}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        vectors: { size: VECTOR_SIZE, distance: "Cosine" },
      }),
    });
  }
}

async function upsertPoints(points: { id: number; vector: number[]; payload: Record<string, unknown> }[]) {
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION}/points`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
  });
  if (!res.ok) throw new Error(`Qdrant upsert error: ${res.status}`);
}

// ── Route ──────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const token    = formData.get("token") as string | null;
  const file     = formData.get("file") as File | null;

  if (!token || !file) {
    return NextResponse.json({ error: "Missing token or file" }, { status: 400 });
  }

  // Validate token
  const clientRes = await pool.query(
    "SELECT phone_number, client_name FROM chat_control WHERE auth_token = $1 LIMIT 1",
    [token]
  );
  if (clientRes.rowCount === 0) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const { phone_number, client_name } = clientRes.rows[0];

  // Extract text
  const bytes  = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  let text = "";

  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require("pdf-parse");
    const parsed   = await pdfParse(buffer);
    text = parsed.text;
  } else {
    text = buffer.toString("utf-8");
  }

  if (!text.trim()) {
    return NextResponse.json({ error: "No text extracted from file" }, { status: 422 });
  }

  // Chunk + embed + upsert
  const chunks = chunkText(text);
  await ensureCollection();

  const baseId = Date.now();
  const BATCH  = 10;
  let processed = 0;

  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const points = await Promise.all(
      batch.map(async (chunk, j) => ({
        id:      baseId + i + j,
        vector:  await embed(chunk),
        payload: {
          text:         chunk,
          source:       file.name,
          phone_number,
          client_name,
          uploaded_at:  new Date().toISOString(),
        },
      }))
    );
    await upsertPoints(points);
    processed += batch.length;
  }

  return NextResponse.json({ chunks_processed: processed, collection: COLLECTION });
}
