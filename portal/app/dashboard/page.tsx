import { notFound } from "next/navigation";
import pool from "@/lib/db";
import DashboardView from "./DashboardView";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function DashboardPage({ searchParams }: Props) {
  const { token } = await searchParams;
  if (!token) notFound();

  // Validate token exists
  const result = await pool.query(
    "SELECT 1 FROM chat_control WHERE auth_token = $1 LIMIT 1",
    [token]
  );
  if (result.rowCount === 0) notFound();

  return <DashboardView token={token} />;
}
