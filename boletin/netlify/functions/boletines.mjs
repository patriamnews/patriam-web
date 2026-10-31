/* Sirve /boletines.js con lo APROBADO (lo que ve el público). Se actualiza al momento al aprobar. */
import { almacen, asegurar } from "../lib/comun.mjs";

export const config = { path: "/boletines.js" };

export default async () => {
  const s = almacen();
  try {
    await asegurar(s);
    const cfg = (await s.get("pubcfg", { type: "json" })) || {};
    delete cfg.usuarios;
    const { blobs } = await s.list({ prefix: "pub/" });
    const boletines = [];
    for (const { key } of blobs) { const b = await s.get(key, { type: "json" }); if (b) boletines.push(b); }
    boletines.sort((a, b) => (Number(a.numero) || 0) - (Number(b.numero) || 0));
    const js = "/* Generado por Netlify con los boletines aprobados. */\n" +
      "window.PATRIAM_CONFIG = " + JSON.stringify(cfg) + ";\nwindow.BOLETINES = " + JSON.stringify(boletines) + ";\n";
    return new Response(js, { headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "no-store" } });
  } catch (e) {
    console.error(e);
    return new Response("window.PATRIAM_CONFIG = {}; window.BOLETINES = [];", { status: 500, headers: { "Content-Type": "text/javascript; charset=utf-8" } });
  }
};
