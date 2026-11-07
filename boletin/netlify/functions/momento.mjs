/* Dirección propia de cada envío «Al momento»: /a/nombre. Sirve la web con la vista previa (imagen y título) para WhatsApp y redes. */
import { almacen, asegurar } from "../lib/comun.mjs";

export const config = { path: "/a/:slug" };

const esc = t => String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const plano = t => String(t || "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").replace(/[*_>#]/g, "").replace(/\s+/g, " ").trim();

export default async (req, context) => {
  const origen = new URL(req.url).origin;
  let html = await (await fetch(origen + "/index.html")).text();
  try {
    const s = almacen(); await asegurar(s);
    const cfg = (await s.get("pubcfg", { type: "json" })) || {};
    const slug = String(context.params.slug || "").replace(/\.html?$/, "");
    const x = (cfg.alMomento || []).find(y => y.estado === "aprobado" && (y.slug === slug || y.id === slug));
    if (x) {
      const t = (x.titulo || "PATRIAM") + " · PATRIAM", url = origen + "/a/" + encodeURIComponent(x.slug || x.id);
      let d = plano(x.resumen || x.comentario || "Lo que hay que saber, con criterio. PATRIAM."); if (d.length > 190) d = d.slice(0, 189) + "…";
      const img = x.tarjeta && /^\/img\/[0-9a-f]{32}$/.test(x.tarjeta) ? origen + x.tarjeta : "";
      html = html
        .replace(/<title>[^<]*<\/title>/, "<title>" + esc(t) + "</title>")
        .replace(/(<meta property="og:type" content=")[^"]*/, "$1article")
        .replace(/(<meta property="og:title" content=")[^"]*/, "$1" + esc(t))
        .replace(/(<meta name="twitter:title" content=")[^"]*/, "$1" + esc(t))
        .replace(/(<meta property="og:description" content=")[^"]*/, "$1" + esc(d))
        .replace(/(<meta name="twitter:description" content=")[^"]*/, "$1" + esc(d))
        .replace(/(<meta name="description" content=")[^"]*/, "$1" + esc(d))
        .replace(/(<meta property="og:url" content=")[^"]*/, "$1" + esc(url));
      if (img) html = html
        .replace(/(<meta property="og:image" content=")[^"]*/, "$1" + esc(img))
        .replace(/(<meta name="twitter:image" content=")[^"]*/, "$1" + esc(img))
        .replace(/(<meta property="og:image:width" content=")[^"]*/, "$1800")
        .replace(/(<meta property="og:image:height" content=")[^"]*/, "$1800");
    }
  } catch (e) { console.error(e); }
  return new Response(html, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
};
