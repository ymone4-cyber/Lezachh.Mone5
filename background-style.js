import { dbFor, optionalHttpUrl } from "../_lib/security.js";

export async function onRequestGet({ env }) {
  try {
    const row = await dbFor(env).prepare("SELECT value FROM site_settings WHERE key = 'background_url'").first();
    const image = optionalHttpUrl(row?.value || "/assets/lezachh-cyber-portrait.jpg", "Image de fond");
    const escaped = image.replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[\r\n\f]/g, "");
    return new Response(`body::before { background-image: url("${escaped}") !important; }`, {
      headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=60", "x-content-type-options": "nosniff", "cross-origin-resource-policy": "same-origin" }
    });
  } catch { return new Response("/* arrière-plan par défaut */", { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } }); }
}
