import { dbFor, errorResponse, json, optionalHttpUrl, readJson, requireAdmin } from "../../_lib/security.js";

export async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    const row = await dbFor(env).prepare("SELECT value FROM site_settings WHERE key = 'background_url'").first();
    return json({ backgroundUrl: row?.value || "/assets/lezachh-cyber-portrait.jpg" });
  } catch (error) { return errorResponse(error, "Chargement des réglages impossible."); }
}

export async function onRequestPost({ request, env }) {
  try {
    await requireAdmin(request, env, true);
    const body = await readJson(request, 4096);
    const backgroundUrl = optionalHttpUrl(body.backgroundUrl, "Image de fond");
    if (!backgroundUrl) return json({ error: "Indiquez un chemin local ou une URL HTTPS." }, 400);
    const now = Math.floor(Date.now() / 1000);
    await dbFor(env).prepare("INSERT INTO site_settings (key, value, updated_at) VALUES ('background_url', ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").bind(backgroundUrl, now).run();
    return json({ ok: true, backgroundUrl });
  } catch (error) { return errorResponse(error, "Enregistrement de l’image impossible."); }
}
