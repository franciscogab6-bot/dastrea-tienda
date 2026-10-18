import { store, json, bad, isAdmin, body } from "./_lib.mjs";

export default async (req) => {
  const s = await store("dastrea");
  if (req.method === "GET") {
    const cat = await s.get("catalog", { type: "json" });
    const seed = await fetch(new URL("/data/catalog.json", req.url)).then((r) => r.json()).catch(() => null);
    if (!cat) return json({ catalog: seed, origen: "semilla" });
    // productos y colecciones nuevos que llegan con una actualización del sitio
    // se agregan sin tocar lo que ya se editó en el administrador
    if (seed) {
      const gone = new Set(cat.eliminados || []);
      const haveC = new Set((cat.colecciones || []).map((x) => x.id));
      const haveP = new Set((cat.productos || []).map((x) => x.id));
      const newC = (seed.colecciones || []).filter((x) => !haveC.has(x.id) && !gone.has("col:" + x.id));
      const newP = (seed.productos || []).filter((x) => !haveP.has(x.id) && !gone.has(x.id));
      if (newC.length) cat.colecciones = [...newC.map((x) => ({ ...x, orden: (x.orden ?? 0) - 100 })), ...cat.colecciones];
      if (newP.length) cat.productos = [...newP.map((x) => ({ ...x, orden: (x.orden ?? 0) - 1000 })), ...cat.productos];
      for (const k of ["prendas", "colores"]) {
        const have = new Set((cat[k] || []).map((x) => x.id));
        const add = (seed[k] || []).filter((x) => !have.has(x.id) && !gone.has(k + ":" + x.id));
        if (add.length) cat[k] = [...(cat[k] || []), ...add];
      }
    }
    return json({ catalog: cat, origen: "admin" }, 200, { "cache-control": "public, max-age=0, must-revalidate" });
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
