import { notFound } from "next/navigation";
import pool from "@/lib/db";
import QrPoller from "./QrPoller";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function QrPage({ searchParams }: Props) {
  const { token } = await searchParams;

  if (!token) notFound();

  // Validate token in Postgres
  const result = await pool.query(
    "SELECT phone_number, waha_session_id, client_name FROM chat_control WHERE auth_token = $1 LIMIT 1",
    [token]
  );

  if (result.rowCount === 0) notFound();

  const { waha_session_id, client_name, phone_number } = result.rows[0];

  return (
    <QrPoller
      sessionId={waha_session_id || "default"}
      clientName={client_name || "Tu Negocio"}
      phoneNumber={phone_number}
    />
  );
}
