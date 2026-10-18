import { store, json, bad, isAdmin, token, body, clean } from "./_lib.mjs";

const pub = (l) => { const o = { ...l }; delete o._token; return o; };
function cleanItems(items) {
  if (!Array.isArray(items)) return [];
  return items.slice(0, 60).map((i) => ({
    pid: clean(i.pid, 40), prenda: clean(i.prenda, 40), color: clean(i.color, 40), talla: clean(i.talla, 10),
    q: Math.max(1, Math.min(20, parseInt(i.q) || 1)), comprados: Math.max(0, Math.min(20, parseInt(i.comprados) || 0)),
  }));
}
export default async (req, context) => {
  const s = await store("dastrea-listas");
  const parts = new URL(req.url).pathname.replace(/\/+$/, "").split("/").filter(Boolean); // api, lists, id?, gift?
  const id = parts[2], action = parts[3];
  let data = {};
  if (req.method !== "GET") { try { data = await body(req, 60_000); } catch (e) { return bad(e.message, e.status); } }

  // administrador: ver todas
  if (!id && req.method === "GET") {
    if (!isAdmin(req)) return bad("Contraseña incorrecta", 401);
    const { blobs } = await s.list();
    const all = await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })));
    return json({ lists: all.filter(Boolean).map(pub).sort((a, b) => (b.creada || "").localeCompare(a.creada || "")) });
  }
  // crear
  if (!id && req.method === "POST") {
    const nombre = clean(data.nombre, 60); if (!nombre) return bad("Ponle nombre a tu lista");
    const lid = token(9).replace(/[-_]/g, "x"); const tk = token(20);
    const l = { id: lid, nombre, ocasion: clean(data.ocasion, 30), fecha: clean(data.fecha, 10), mensaje: clean(data.mensaje, 240), items: [], creada: new Date().toISOString(), _token: tk };
    await s.setJSON(lid, l);
    return json({ id: lid, token: tk, list: pub(l) }, 201);
  }
  if (!/^[\w-]{4,20}$/.test(id || "")) return bad("Lista no válida", 404);
  const l = await s.get(id, { type: "json" });
  if (!l) return bad("No encontramos esta lista", 404);

  if (req.method === "GET") return json({ list: pub(l) });

  if (action === "gift" && req.method === "POST") {
    const idx = parseInt(data.idx), q = Math.max(1, Math.min(20, parseInt(data.q) || 1));
    if (!l.items[idx]) return bad("Prenda no encontrada", 404);
    l.items[idx].comprados = Math.min(l.items[idx].q, (l.items[idx].comprados || 0) + q);
    await s.setJSON(id, l);
    return json({ ok: true });
  }
  const owner = data.token && data.token === l._token;
  if (!owner && !isAdmin(req)) return bad("No tienes permiso para cambiar esta lista", 403);
  if (req.method === "PUT") {
    if (data.nombre !== undefined) l.nombre = clean(data.nombre, 60) || l.nombre;
    if (data.ocasion !== undefined) l.ocasion = clean(data.ocasion, 30);
    if (data.fecha !== undefined) l.fecha = clean(data.fecha, 10);
    if (data.mensaje !== undefined) l.mensaje = clean(data.mensaje, 240);
    if (data.items !== undefined) {
      // el dueño no puede reiniciar lo que ya le regalaron
      const prev = l.items || [];
      l.items = cleanItems(data.items).map((it) => {
        const p = prev.find((x) => x.pid === it.pid && x.prenda === it.prenda && x.color === it.color && x.talla === it.talla);
        return { ...it, comprados: isAdmin(req) ? it.comprados : Math.min(it.q, p ? p.comprados || 0 : 0) };
      });
    }
    l.editada = new Date().toISOString();
    await s.setJSON(id, l);
    return json({ list: pub(l) });
  }
  if (req.method === "DELETE") { await s.delete(id); return json({ ok: true }); }
  return bad("Método no permitido", 405);
};
export const config = { path: ["/api/lists", "/api/lists/:id", "/api/lists/:id/:action"] };
