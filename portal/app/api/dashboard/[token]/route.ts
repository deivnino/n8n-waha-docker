import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  // Validate token and get client info
  const clientRes = await pool.query(
    `SELECT phone_number, client_name, status, daily_counter, is_vip, last_human_interaction
     FROM chat_control WHERE auth_token = $1 LIMIT 1`,
    [token]
  );
  if (clientRes.rowCount === 0) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const client = clientRes.rows[0];
  const phone = client.phone_number;

  // Run stats queries in parallel
  const [rolesRes, weekRes, recentRes, escalationsRes] = await Promise.all([
    // Messages by role (all time)
    pool.query(
      `SELECT role, count(*)::int as count FROM chat_history
       WHERE phone_number = $1 GROUP BY role`,
      [phone]
    ),
    // Messages per day last 7 days
    pool.query(
      `SELECT DATE(created_at) as day, count(*)::int as count
       FROM chat_history WHERE phone_number = $1
         AND created_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at) ORDER BY day ASC`,
      [phone]
    ),
    // Last 15 messages
    pool.query(
      `SELECT role, content, created_at FROM chat_history
       WHERE phone_number = $1 ORDER BY created_at DESC LIMIT 15`,
      [phone]
    ),
    // Escalations (system_logs)
    pool.query(
      `SELECT count(*)::int as count FROM system_logs
       WHERE component = 'escalation'
         AND details->>'phone_number' = $1`,
      [phone]
    ),
  ]);

  const roleMap = Object.fromEntries(rolesRes.rows.map((r) => [r.role, r.count]));

  return NextResponse.json({
    client,
    stats: {
      total_user:      roleMap["user"]      ?? 0,
      total_assistant: roleMap["assistant"] ?? 0,
      escalations:     escalationsRes.rows[0]?.count ?? 0,
      daily_counter:   client.daily_counter,
    },
    week: weekRes.rows,
    recent: recentRes.rows,
  });
}
