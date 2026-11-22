import { cookieId, dbFor, errorResponse, HttpError, json, newId, readJson, requireSameOrigin } from "../_lib/security.js";

function visitorCookie(request, id) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `lezachh_visitor=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000${secure}`;
}

function cleanPage(value, request) {
  if (typeof value !== "string" || value.length > 512) throw new HttpError(400, "Page invalide.");
  let url;
  try { url = new URL(value, request.url); } catch { throw new HttpError(400, "Page invalide."); }
  if (url.origin !== new URL(request.url).origin) throw new HttpError(400, "Page invalide.");
  return (url.pathname || "/").slice(0, 180);
}

function referrerDomain(request) {
  try {
    const referrer = new URL(request.headers.get("referer") || "");
    return referrer.origin === new URL(request.url).origin ? "" : referrer.hostname.slice(0, 120);
  } catch { return ""; }
}

export async function onRequestPost({ request, env }) {
  try {
    requireSameOrigin(request);
    const body = await readJson(request, 2048);
    const page = cleanPage(body.path, request);
    const id = cookieId(request, "lezachh_visitor") || newId();
    const now = Math.floor(Date.now() / 1000);
    const referrer = referrerDomain(request);
    const db = dbFor(env);
    const isNew = !cookieId(request, "lezachh_visitor");
    if (isNew) {
      const total = await db.prepare("SELECT COUNT(*) AS n FROM visitors").first();
      if (Number(total?.n || 0) >= 100000) return json({ ok: true });
    }
    if (Math.random() < 0.02) {
      await db.prepare("DELETE FROM visitors WHERE last_seen < ?").bind(now - 31536000).run();
      const cutoff = new Date((now - 90 * 86400) * 1000).toISOString().slice(0, 10);
      for (const table of ["visit_days", "daily_views", "daily_referrers"]) await db.prepare(`DELETE FROM ${table} WHERE day < ?`).bind(cutoff).run();
    }
    const day = new Date(now * 1000).toISOString().slice(0, 10);
    await db.prepare("INSERT OR IGNORE INTO visit_days (day, visitor_id) VALUES (?, ?)").bind(day, id).run();
    await db.prepare("INSERT INTO daily_views (day, path, views) VALUES (?, ?, 1) ON CONFLICT(day, path) DO UPDATE SET views = views + 1").bind(day, page).run();
    if (referrer) await db.prepare("INSERT INTO daily_referrers (day, domain, visits) VALUES (?, ?, 1) ON CONFLICT(day, domain) DO UPDATE SET visits = visits + 1").bind(day, referrer).run();
    await db.prepare("INSERT INTO visitors (visitor_id, first_seen, last_seen, view_count, last_page, referrer_domain) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(visitor_id) DO UPDATE SET last_seen=excluded.last_seen, view_count=visitors.view_count+1, last_page=excluded.last_page, referrer_domain=CASE WHEN excluded.referrer_domain != '' THEN excluded.referrer_domain ELSE visitors.referrer_domain END").bind(id, now, now, page, referrer).run();
    return json({ ok: true }, 200, { "set-cookie": visitorCookie(request, id) });
  } catch (error) { return errorResponse(error, "La visite n’a pas pu être enregistrée."); }
}

export async function onRequestDelete({ request, env }) {
  try {
    requireSameOrigin(request);
    const id = cookieId(request, "lezachh_visitor");
    if (id) await dbFor(env).prepare("DELETE FROM visitors WHERE visitor_id = ?").bind(id).run();
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return json({ ok: true }, 200, { "set-cookie": `lezachh_visitor=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}` });
  } catch (error) { return errorResponse(error, "Le retrait des statistiques a échoué."); }
}
