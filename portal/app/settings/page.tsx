import { notFound } from "next/navigation";
import pool from "@/lib/db";
import { ClientSettings } from "@/lib/types";
import SettingsForm from "./SettingsForm";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function SettingsPage({ searchParams }: Props) {
  const { token } = await searchParams;
  if (!token) notFound();

  const result = await pool.query(
    `SELECT phone_number, client_name, status, is_vip, outside_hours_enabled, business_hours
     FROM chat_control WHERE auth_token = $1 LIMIT 1`,
    [token]
  );

  if (result.rowCount === 0) notFound();

  const settings = result.rows[0] as ClientSettings;

  return <SettingsForm token={token} initialSettings={settings} />;
}
