import { notFound } from "next/navigation";
import pool from "@/lib/db";
import UploadForm from "./UploadForm";

interface Props {
  searchParams: Promise<{ token?: string }>;
}

export default async function UploadPage({ searchParams }: Props) {
  const { token } = await searchParams;
  if (!token) notFound();

  const result = await pool.query(
    "SELECT 1 FROM chat_control WHERE auth_token = $1 LIMIT 1",
    [token]
  );
  if (result.rowCount === 0) notFound();

  return <UploadForm token={token} />;
}
