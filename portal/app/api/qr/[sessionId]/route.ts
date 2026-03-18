import { NextRequest, NextResponse } from "next/server";
import { getQrCode, getSessionStatus, startSession } from "@/lib/waha";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // Check session status
  const status = await getSessionStatus(sessionId);

  if (status?.status === "WORKING") {
    return NextResponse.json({ connected: true });
  }

  // If stopped, start it — client will keep polling until QR appears
  if (status?.status === "STOPPED") {
    await startSession(sessionId);
    return NextResponse.json({ connected: false, qr: null, starting: true });
  }

  // Still booting up — tell client to keep polling
  if (status?.status === "STARTING") {
    return NextResponse.json({ connected: false, qr: null, starting: true });
  }

  // Return QR image as base64
  const qrRes = await getQrCode(sessionId);
  if (!qrRes) {
    // Session exists but QR not ready yet — keep polling instead of error
    return NextResponse.json({ connected: false, qr: null, starting: true });
  }

  const buffer = await qrRes.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const contentType = qrRes.headers.get("content-type") || "image/png";

  return NextResponse.json({
    connected: false,
    qr: `data:${contentType};base64,${base64}`,
  });
}
