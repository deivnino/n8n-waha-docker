import { Pool } from "pg";

const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB || "chatwoot",
  user: process.env.POSTGRES_USER || "chatwoot",
  password: process.env.POSTGRES_PASSWORD || "chatwoot",
});

export default pool;
