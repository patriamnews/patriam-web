/* Sirve las imágenes subidas desde el editor. */
import { almacen } from "../lib/comun.mjs";

export const config = { path: "/img/:clave" };

export default async (req, context) => {
  const clave = context.params.clave;
  if (!/^[0-9a-f]{32}$/.test(clave)) return new Response("No encontrada", { status: 404 });
  const r = await almacen().getWithMetadata("img/" + clave, { type: "arrayBuffer" });
  if (!r) return new Response("No encontrada", { status: 404 });
  return new Response(r.data, { headers: { "Content-Type": (r.metadata && r.metadata.tipo) || "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" } });
};
