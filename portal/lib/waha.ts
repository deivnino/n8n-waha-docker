const WAHA_URL = process.env.WAHA_URL || "http://localhost:3000";

function getHeaders(): Record<string, string> {
  const key = process.env.WAHA_API_KEY;
  return {
    "Content-Type": "application/json",
    ...(key ? { "X-Api-Key": key } : {}),
  };
}

export async function getSessionStatus(sessionId: string) {
  const res = await fetch(`${WAHA_URL}/api/sessions/${sessionId}`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function startSession(sessionId: string) {
  const res = await fetch(`${WAHA_URL}/api/sessions/${sessionId}/start`, {
    method: "POST",
    headers: getHeaders(),
  });
  return res.ok;
}

export async function getQrCode(sessionId: string) {
  const res = await fetch(`${WAHA_URL}/api/${sessionId}/auth/qr?format=image`, {
    headers: getHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res;
}
