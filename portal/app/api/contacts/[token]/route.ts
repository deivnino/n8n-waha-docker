import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

type Params = { params: Promise<{ token: string }> };

// Validate token and return the business phone_number
async function validateToken(token: string) {
  const result = await pool.query(
    `SELECT phone_number FROM chat_control WHERE auth_token = $1 LIMIT 1`,
    [token]
  );
  return result.rowCount ? result.rows[0].phone_number : null;
}

// GET — list all contacts (rows without auth_token = non-business numbers)
export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;
  const bizPhone = await validateToken(token);
  if (!bizPhone) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const result = await pool.query(
    `SELECT phone_number, status, is_vip, daily_counter, last_human_interaction
     FROM chat_control
     WHERE phone_number != $1
     ORDER BY last_human_interaction DESC NULLS LAST`,
    [bizPhone]
  );

  return NextResponse.json(result.rows);
}

// POST — add a new contact (pre-configure VIP before they write)
export async function POST(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const bizPhone = await validateToken(token);
  if (!bizPhone) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { phone_number, is_vip } = await req.json();

  if (!phone_number) {
    return NextResponse.json({ error: "phone_number required" }, { status: 400 });
  }

  if (phone_number === bizPhone) {
    return NextResponse.json({ error: "Cannot add business number" }, { status: 400 });
  }

  // Normalize: ensure @c.us suffix
  const normalized = phone_number.includes("@") ? phone_number : `${phone_number.replace(/\D/g, "")}@c.us`;

  const result = await pool.query(
    `INSERT INTO chat_control (phone_number, status, is_vip)
     VALUES ($1, $2, $3)
     ON CONFLICT (phone_number) DO UPDATE SET is_vip = $3
     RETURNING phone_number, status, is_vip, daily_counter, last_human_interaction`,
    [normalized, is_vip ? "MANUAL" : "AUTO", is_vip ?? true]
  );

  return NextResponse.json(result.rows[0]);
}

// PATCH — update a contact's is_vip or status
export async function PATCH(req: NextRequest, { params }: Params) {
  const { token } = await params;
  const bizPhone = await validateToken(token);
  if (!bizPhone) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { phone_number, is_vip, status } = await req.json();

  if (!phone_number) {
    return NextResponse.json({ error: "phone_number required" }, { status: 400 });
  }

  // Don't allow editing the business's own row via this endpoint
  if (phone_number === bizPhone) {
    return NextResponse.json({ error: "Cannot edit business number here" }, { status: 400 });
  }

  const result = await pool.query(
    `UPDATE chat_control
     SET is_vip  = COALESCE($1, is_vip),
         status  = COALESCE($2, status),
         last_human_interaction = CASE WHEN $2 = 'AUTO' THEN NOW() ELSE last_human_interaction END
     WHERE phone_number = $3
     RETURNING phone_number, status, is_vip, daily_counter, last_human_interaction`,
    [is_vip ?? null, status ?? null, phone_number]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  return NextResponse.json(result.rows[0]);
}
