import { store, json, bad, isAdmin, body, clean } from "./_lib.mjs";
export default async (req) => {
  const s = await store("dastrea");
  if (req.method === "POST") {
    let d; try { d = await body(req, 2000); } catch (e) { return bad(e.message, e.status); }
    const c = clean(d.contacto, 80); if (c.length < 5) return bad("Escribe tu correo o WhatsApp");
    const list = (await s.get("subs", { type: "json" })) || [];
    if (!list.some((x) => x.contacto === c)) { list.push({ contacto: c, fecha: new Date().toISOString() }); await s.setJSON("subs", list.slice(-5000)); }
    return json({ ok: true });
  }
  if (req.method === "GET") { if (!isAdmin(req)) return bad("Contraseña incorrecta", 401); return json({ subs: (await s.get("subs", { type: "json" })) || [] }); }
  if (req.method === "DELETE") { if (!isAdmin(req)) return bad("Contraseña incorrecta", 401); await s.setJSON("subs", []); return json({ ok: true }); }
  return bad("Método no permitido", 405);
};
export const config = { path: "/api/subs" };
