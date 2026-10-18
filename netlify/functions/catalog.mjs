import { store, json, bad, isAdmin, body } from "./_lib.mjs";

export default async (req) => {
  const s = await store("dastrea");
  if (req.method === "GET") {
    const cat = await s.get("catalog", { type: "json" });
    if (cat) return json({ catalog: cat, origen: "admin" }, 200, { "cache-control": "public, max-age=0, must-revalidate" });
    // primera vez: semilla incluida en el sitio
    const seed = await fetch(new URL("/data/catalog.json", req.url)).then((r) => r.json()).catch(() => null);
    return json({ catalog: seed, origen: "semilla" });
  }
  if (req.method === "PUT") {
    if (!isAdmin(req)) return bad("Contraseña incorrecta", 401);
    let data;
    try { data = await body(req, 3_000_000); } catch (e) { return bad(e.message, e.status); }
    const c = data.catalog;
    if (!c || !Array.isArray(c.productos) || !Array.isArray(c.colecciones) || !Array.isArray(c.prendas) || !c.ajustes) return bad("Catálogo incompleto");
    // respaldo de la versión anterior (se guardan las últimas 10)
    const prev = await s.get("catalog", { type: "json" });
    if (prev) {
      const key = "backup/" + new Date().toISOString().replace(/[:.]/g, "-");
      await s.setJSON(key, prev);
      const { blobs } = await s.list({ prefix: "backup/" });
      const old = blobs.map((b) => b.key).sort().slice(0, -10);
      await Promise.all(old.map((k) => s.delete(k)));
    }
    c.version = (Number(c.version) || 0) + 1;
    c.actualizado = new Date().toISOString();
    await s.setJSON("catalog", c);
    return json({ ok: true, version: c.version, actualizado: c.actualizado });
  }
  return bad("Método no permitido", 405);
};
export const config = { path: "/api/catalog" };
