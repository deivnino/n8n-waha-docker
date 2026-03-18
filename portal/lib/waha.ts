const WAHA_URL = process.env.WAHA_URL || "http://localhost:3000";
const WAHA_API_KEY = process.env.WAHA_API_KEY || "";

const headers: Record<string, string> = {
  "Content-Type": "application/json",
  ...(WAHA_API_KEY ? { "X-Api-Key": WAHA_API_KEY } : {}),
};

export async function getSessionStatus(sessionId: string) {
  const res = await fetch(`${WAHA_URL}/api/sessions/${sessionId}`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getQrCode(sessionId: string) {
  const res = await fetch(`${WAHA_URL}/api/${sessionId}/auth/qr?format=image`, {
    headers,
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res; // raw response — caller reads body as buffer
}
