import { store, json, bad, isAdmin, token } from "./_lib.mjs";
const TYPES = { "image/webp": "webp", "image/png": "png", "image/jpeg": "jpg" };
export default async (req) => {
  if (req.method !== "POST") return bad("Método no permitido", 405);
  if (!isAdmin(req)) return bad("Contraseña incorrecta", 401);
  const type = (req.headers.get("content-type") || "").split(";")[0];
  if (!TYPES[type]) return bad("Formato no permitido (usa PNG, JPG o WEBP)");
  const buf = await req.arrayBuffer();
  if (buf.byteLength > 4_000_000) return bad("La imagen pesa más de 4 MB", 413);
  const key = Date.now().toString(36) + "-" + token(8) + "." + TYPES[type];
  const s = await store("dastrea-img");
  await s.set(key, buf, { metadata: { type } });
  return json({ ok: true, url: "/api/img/" + key });
};
export const config = { path: "/api/upload" };
