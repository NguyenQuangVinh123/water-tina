// Chạy: npm run db:init  (cần DATABASE_URL trong .env.local)
// Đọc db/schema.sql và thi hành từng câu lệnh CREATE/INSERT.
import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

// Ưu tiên .env.local (Next.js), fallback .env
dotenv.config({ path: existsSync(".env.local") ? ".env.local" : ".env" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("❌ Thiếu DATABASE_URL trong .env.local");
  process.exit(1);
}

const sql = neon(url);
const raw = readFileSync(new URL("../db/schema.sql", import.meta.url), "utf8");

// Loại bỏ dòng comment trước, rồi tách các câu lệnh theo dấu ;
// (an toàn vì schema không có ; nằm trong chuỗi)
const withoutComments = raw
  .split(/\r?\n/)
  .filter((line) => !line.trim().startsWith("--"))
  .join("\n");

const statements = withoutComments
  .split(/;\s*(?:\r?\n|$)/)
  .map((s) => s.trim())
  .filter((s) => s.length > 0);

console.log(`▶ Executing ${statements.length} statement(s)...`);
for (const stmt of statements) {
  try {
    await sql.query(stmt);
    console.log("  ✓ ok:", stmt.split("\n")[0].slice(0, 60));
  } catch (err) {
    console.error("  ✗ lỗi:", err.message);
    process.exit(1);
  }
}
console.log("✅ Khởi tạo schema hoàn tất.");
