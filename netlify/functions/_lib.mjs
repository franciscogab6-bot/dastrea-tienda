// utilidades compartidas de las funciones
import { timingSafeEqual, randomBytes, createHash } from "node:crypto";

let _getStore = null;
export async function store(name) {
  if (globalThis.__DA_STORE__) return globalThis.__DA_STORE__(name); // pruebas locales
  if (!_getStore) ({ getStore: _getStore } = await import("@netlify/blobs"));
  return _getStore({ name, consistency: "strong" });
}
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers } });
export const bad = (msg, status = 400) => json({ error: msg }, status);
export function isAdmin(req) {
  const pass = process.env.ADMIN_PASSWORD || "";
  const got = req.headers.get("x-admin-key") || "";
  if (pass.length < 6 || !got) return false;
  const a = createHash("sha256").update(pass).digest(), b = createHash("sha256").update(got).digest();
  return timingSafeEqual(a, b);
}
export const token = (n = 16) => randomBytes(n).toString("base64url").slice(0, n);
export async function body(req, max = 300_000) {
  const t = await req.text();
  if (t.length > max) throw Object.assign(new Error("Demasiado grande"), { status: 413 });
  try { return JSON.parse(t || "{}"); } catch { throw Object.assign(new Error("JSON inválido"), { status: 400 }); }
}
export const clean = (s, n = 200) => String(s ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);
