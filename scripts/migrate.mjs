// Chạy: npm run db:migrate  — áp dụng mọi file trong db/migrations/*.sql (idempotent).
import dotenv from "dotenv";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

dotenv.config({ path: existsSync(".env.local") ? ".env.local" : ".env" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ Thiếu DATABASE_URL trong .env.local");
  process.exit(1);
}
const sql = neon(url);
const dir = new URL("../db/migrations/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

for (const file of files) {
  const raw = readFileSync(new URL(`./${file}`, dir), "utf8");
  const statements = raw
    .split(/\r?\n/)
    .filter((l) => !l.trim().startsWith("--"))
    .join("\n")
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.trim())
    .filter(Boolean);
  for (const stmt of statements) {
    await sql.query(stmt);
  }
  console.log(`✓ ${file} (${statements.length} câu)`);
}
console.log("✅ Migrations hoàn tất.");
