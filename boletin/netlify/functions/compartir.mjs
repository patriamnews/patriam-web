/* Dirección propia de cada boletín: /boletin/2. Sirve la web con la vista previa (WhatsApp, redes) de ese boletín. */
import { almacen, asegurar } from "../lib/comun.mjs";

export const config = { path: "/boletin/:numero" };

const esc = t => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const fecha = f => { const m = String(f || "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? +m[3] + " de " + MESES[+m[2] - 1] + " de " + m[1] : ""; };

export default async (req, context) => {
  const origen = new URL(req.url).origin;
  const r = await fetch(origen + "/index.html");
  let html = await r.text();
  try {
    const s = almacen();
    await asegurar(s);
    const { blobs } = await s.list({ prefix: "pub/" });
    let b = null;
    for (const { key } of blobs) { const x = await s.get(key, { type: "json" }); if (x && String(x.numero) === String(context.params.numero)) { b = x; break; } }
    if (b) {
      const n = String(b.numero).padStart(2, "0");
      const titulo = "Boletín Nº " + n + " · " + ((b.editorial || {}).titulo || "Lo que hay que saber") + " · PATRIAM";
      const desc = "Lo que hay que saber, con criterio. Boletín de PATRIAM del " + fecha(b.fecha) + ".";
      const url = origen + "/boletin/" + encodeURIComponent(b.numero);
      html = html
        .replace(/<title>[^<]*<\/title>/, "<title>" + esc(titulo) + "</title>")
        .replace(/(<meta property="og:title" content=")[^"]*/, "$1" + esc(titulo))
        .replace(/(<meta name="twitter:title" content=")[^"]*/, "$1" + esc(titulo))
        .replace(/(<meta property="og:description" content=")[^"]*/, "$1" + esc(desc))
        .replace(/(<meta name="twitter:description" content=")[^"]*/, "$1" + esc(desc))
        .replace(/(<meta name="description" content=")[^"]*/, "$1" + esc(desc))
        .replace(/(<meta property="og:url" content=")[^"]*/, "$1" + esc(url));
      if (b.tarjeta && /^\/img\/[0-9a-f]{32}$/.test(b.tarjeta)) {
        const img = origen + b.tarjeta;
        html = html
          .replace(/(<meta property="og:image" content=")[^"]*/, "$1" + esc(img))
          .replace(/(<meta property="og:image:width" content=")[^"]*/, "$11200")
          .replace(/(<meta property="og:image:height" content=")[^"]*/, "$1630")
          .replace(/(<meta name="twitter:image" content=")[^"]*/, "$1" + esc(img))
          .replace(/(<meta name="twitter:card" content=")[^"]*/, "$1summary_large_image");
      }
    }
  } catch (e) { console.error(e); }
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
};
