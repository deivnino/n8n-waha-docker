import { NextRequest, NextResponse } from "next/server";
import { getQrCode, getSessionStatus } from "@/lib/waha";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  // Check if already connected
  const status = await getSessionStatus(sessionId);
  if (status?.status === "WORKING") {
    return NextResponse.json({ connected: true });
  }

  // Return QR image as base64
  const qrRes = await getQrCode(sessionId);
  if (!qrRes) {
    return NextResponse.json({ error: "QR not available" }, { status: 404 });
  }

  const buffer = await qrRes.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const contentType = qrRes.headers.get("content-type") || "image/png";

  return NextResponse.json({
    connected: false,
    qr: `data:${contentType};base64,${base64}`,
  });
}
