import { json, bad, isAdmin } from "./_lib.mjs";
export default async (req) => {
  if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 6) return bad("Falta configurar ADMIN_PASSWORD en Netlify (mínimo 6 caracteres)", 500);
  if (!isAdmin(req)) { await new Promise((r) => setTimeout(r, 700)); return bad("Contraseña incorrecta", 401); }
  return json({ ok: true });
};
export const config = { path: "/api/login" };
