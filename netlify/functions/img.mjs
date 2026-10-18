import { store } from "./_lib.mjs";
export default async (req, context) => {
  const key = (context.params && context.params.key) || new URL(req.url).pathname.split("/").pop();
  if (!/^[\w.-]+$/.test(key)) return new Response("No", { status: 400 });
  const s = await store("dastrea-img");
  const r = await s.getWithMetadata(key, { type: "arrayBuffer" });
  if (!r) return new Response("No encontrada", { status: 404 });
  return new Response(r.data, { headers: { "content-type": (r.metadata && r.metadata.type) || "image/webp", "cache-control": "public, max-age=31536000, immutable" } });
};
export const config = { path: "/api/img/:key" };
