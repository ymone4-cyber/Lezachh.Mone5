import { dbFor, errorResponse, json } from "../_lib/security.js";

export async function onRequestGet({ env }) {
  try {
    const db = dbFor(env);
    const [productRows, announcementRows, settingRow] = await Promise.all([
      db.prepare("SELECT id, placement, name, category, description, price, old_price AS oldPrice, currency, external_url AS externalUrl, featured FROM products WHERE active = 1 ORDER BY placement, featured DESC, name COLLATE NOCASE").all(),
      db.prepare("SELECT id, title, message, external_url AS externalUrl FROM announcements WHERE active = 1 ORDER BY updated_at DESC LIMIT 20").all(),
      db.prepare("SELECT value FROM site_settings WHERE key = 'background_url'").first()
    ]);
    return json({ products: productRows.results || [], announcements: announcementRows.results || [], backgroundUrl: settingRow?.value || "/assets/lezachh-cyber-portrait.jpg" }, 200, { "cache-control": "public, max-age=60, stale-while-revalidate=300" });
  } catch (error) { return errorResponse(error, "Contenu temporairement indisponible."); }
}
