import fs from "node:fs";
import path from "node:path";
import { getUser, audit } from "@/lib/auth";
import { backupFile } from "@/lib/admin";

export const dynamic = "force-dynamic";

/** GET /api/admin/backup: a consistent copy of the database to download (admins). */
export async function GET() {
  const u = await getUser();
  if (!u?.isAdmin) return new Response("Admins only", { status: 403 });
  const file = await backupFile();
  audit(u.id, "backup");
  const data = fs.readFileSync(file);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": "application/vnd.sqlite3",
      "Content-Disposition": `attachment; filename="${path.basename(file)}"`,
      "Content-Length": String(data.length),
    },
  });
}
