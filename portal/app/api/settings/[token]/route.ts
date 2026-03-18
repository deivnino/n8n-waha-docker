import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { ClientSettings } from "@/lib/types";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { token } = await params;

  const result = await pool.query(
    `SELECT phone_number, client_name, business_name, website_url, status, is_vip, outside_hours_enabled, business_hours
     FROM chat_control WHERE auth_token = $1 LIMIT 1`,
    [token]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  return NextResponse.json(result.rows[0] as ClientSettings);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { token } = await params;

  const body = await req.json();
  const { status, is_vip, outside_hours_enabled, business_hours, client_name, business_name, website_url } = body;

  const result = await pool.query(
    `UPDATE chat_control
     SET status               = COALESCE($1, status),
         is_vip               = COALESCE($2, is_vip),
         outside_hours_enabled= COALESCE($3, outside_hours_enabled),
         business_hours       = COALESCE($4, business_hours),
         client_name          = COALESCE($5, client_name),
         business_name        = COALESCE($6, business_name),
         website_url          = COALESCE($7, website_url)
     WHERE auth_token = $8
     RETURNING phone_number, client_name, business_name, website_url, status, is_vip, outside_hours_enabled, business_hours`,
    [status ?? null, is_vip ?? null, outside_hours_enabled ?? null,
     business_hours ? JSON.stringify(business_hours) : null,
     client_name ?? null, business_name ?? null, website_url ?? null, token]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  return NextResponse.json(result.rows[0]);
}
