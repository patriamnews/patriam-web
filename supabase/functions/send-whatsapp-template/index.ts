// Supabase Edge Function: server-to-server WhatsApp template sender.
// Never call this endpoint from the browser or expose its internal secret.
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("WHATSAPP_INTERNAL_SECRET");
  if (!secret || req.headers.get("x-internal-secret") !== secret)
    return new Response("Unauthorized", { status: 401 });
  const token = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const version = Deno.env.get("WHATSAPP_GRAPH_VERSION");
  if (!token || !phoneId || !version)
    return new Response("WhatsApp not configured", { status: 503 });
  let body: { to?: string; template?: string; language?: string; parameters?: string[] };
  try { body = await req.json(); } catch { return new Response("Invalid JSON", { status: 400 }); }
  if (!body.to || !/^\+?[1-9]\d{7,14}$/.test(body.to) ||
      !body.template || !/^[a-z0-9_]+$/.test(body.template) ||
      !body.language || !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(body.language) ||
      !Array.isArray(body.parameters ?? []) ||
      !(body.parameters ?? []).every((v) => typeof v === "string" && v.length <= 1024))
    return new Response("Invalid message", { status: 400 });
  const payload = {
    messaging_product: "whatsapp", to: body.to.replace(/^\+/, ""),
    type: "template", template: {
      name: body.template, language: { code: body.language },
      ...((body.parameters?.length ?? 0) > 0 ? { components: [{
        type: "body", parameters: body.parameters!.map((text) => ({ type: "text", text }))
      }] } : {})
    }
  };
  try {
    const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    return Response.json({ ok: response.ok, result }, { status: response.ok ? 200 : 502 });
  } catch {
    return Response.json({ ok: false, error: "WhatsApp request failed" }, { status: 502 });
  }
});
