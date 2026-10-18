import { store, json, bad, isAdmin } from "./_lib.mjs";
export default async (req) => {
  if (!isAdmin(req)) return bad("Contraseña incorrecta", 401);
  const s = await store("dastrea");
  const url = new URL(req.url); const key = url.searchParams.get("key");
  if (req.method === "GET" && !key) { const { blobs } = await s.list({ prefix: "backup/" }); return json({ backups: blobs.map((b) => b.key).sort().reverse() }); }
  if (req.method === "POST" && key && key.startsWith("backup/")) {
    const b = await s.get(key, { type: "json" }); if (!b) return bad("No existe", 404);
    await s.setJSON("catalog", b); return json({ ok: true });
  }
  return bad("Método no permitido", 405);
};
export const config = { path: "/api/backups" };
