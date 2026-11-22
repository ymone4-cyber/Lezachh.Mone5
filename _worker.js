var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// _lib/security.js
var encoder = new TextEncoder();
var SESSION_COOKIE = "lezachh_admin_session";
function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
      ...extraHeaders
    }
  });
}
__name(json, "json");
function errorResponse(error, fallback = "Une erreur est survenue.") {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  return json({ error: fallback }, 500);
}
__name(errorResponse, "errorResponse");
var HttpError = class extends Error {
  static {
    __name(this, "HttpError");
  }
  constructor(status, message) {
    super(message);
    this.status = status;
  }
};
function dbFor(env) {
  if (!env.DB) throw new HttpError(503, "La base de donn\xE9es n\u2019est pas configur\xE9e.");
  return env.DB;
}
__name(dbFor, "dbFor");
function requireSameOrigin(request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  if (!origin || origin !== new URL(request.url).origin || site === "cross-site") {
    throw new HttpError(403, "Origine de requ\xEAte refus\xE9e.");
  }
}
__name(requireSameOrigin, "requireSameOrigin");
async function readJson(request, maxBytes = 16384) {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("application/json")) throw new HttpError(415, "Format JSON requis.");
  const declared = Number(request.headers.get("content-length") || 0);
  if (declared > maxBytes) throw new HttpError(413, "Requ\xEAte trop volumineuse.");
  const text = await request.text();
  if (encoder.encode(text).byteLength > maxBytes) throw new HttpError(413, "Requ\xEAte trop volumineuse.");
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    throw new HttpError(400, "JSON invalide.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "Objet JSON attendu.");
  return value;
}
__name(readJson, "readJson");
function base64url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
__name(base64url, "base64url");
function fromBase64url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
__name(fromBase64url, "fromBase64url");
function sessionSecret(env) {
  const secret = env.ADMIN_SESSION_SECRET || "";
  if (encoder.encode(secret).byteLength < 32) throw new HttpError(503, "La cl\xE9 de session doit contenir au moins 32 octets.");
  return secret;
}
__name(sessionSecret, "sessionSecret");
async function hmacKey(env) {
  return crypto.subtle.importKey("raw", encoder.encode(sessionSecret(env)), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
__name(hmacKey, "hmacKey");
async function issueSession(env, username) {
  const now = Math.floor(Date.now() / 1e3);
  const payload = base64url(encoder.encode(JSON.stringify({ iss: "lezachh-admin", sub: username, iat: now, exp: now + 28800 })));
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(env), encoder.encode(payload)));
  return payload + "." + base64url(signature);
}
__name(issueSession, "issueSession");
function cookieValue(request, name) {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return "";
}
__name(cookieValue, "cookieValue");
function sessionCookie(request, value, maxAge = 28800) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`;
}
__name(sessionCookie, "sessionCookie");
async function isAdmin(request, env) {
  const token = cookieValue(request, SESSION_COOKIE);
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 2 || parts.some((part) => part.length > 2048)) return false;
  try {
    const key = await hmacKey(env);
    if (!await crypto.subtle.verify("HMAC", key, fromBase64url(parts[1]), encoder.encode(parts[0]))) return false;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(parts[0])));
    const now = Math.floor(Date.now() / 1e3);
    return payload.iss === "lezachh-admin" && typeof payload.sub === "string" && payload.iat <= now + 60 && payload.exp > now && payload.exp - payload.iat <= 28800;
  } catch {
    return false;
  }
}
__name(isAdmin, "isAdmin");
async function requireAdmin(request, env, mutate = false) {
  if (mutate) requireSameOrigin(request);
  if (!await isAdmin(request, env)) throw new HttpError(401, "Connexion administrateur requise.");
}
__name(requireAdmin, "requireAdmin");
async function verifyPassword(password, encodedHash) {
  const [scheme, roundsText, saltText, hashText, extra] = String(encodedHash || "").split("$");
  const rounds = Number(roundsText);
  if (scheme !== "pbkdf2-sha256" || extra !== void 0 || !Number.isInteger(rounds) || rounds < 1e5 || rounds > 1e6) return false;
  try {
    const salt = fromBase64url(saltText);
    const expected = fromBase64url(hashText);
    if (salt.length < 16 || expected.length !== 32) return false;
    const base = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
    const derived = new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: rounds, hash: "SHA-256" }, base, 256));
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= derived[i] ^ expected[i];
    return diff === 0;
  } catch {
    return false;
  }
}
__name(verifyPassword, "verifyPassword");
async function hashClientKey(request, env) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const bytes = await crypto.subtle.digest("SHA-256", encoder.encode(sessionSecret(env) + ":" + ip));
  return base64url(new Uint8Array(bytes));
}
__name(hashClientKey, "hashClientKey");
function requiredText(value, name, maxLength) {
  if (typeof value !== "string") throw new HttpError(400, `${name} invalide.`);
  const text = value.trim();
  if (!text || text.length > maxLength || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) throw new HttpError(400, `${name} invalide.`);
  return text;
}
__name(requiredText, "requiredText");
function optionalHttpUrl(value, name = "Lien") {
  if (value === void 0 || value === null || value === "") return "";
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\\]/.test(value)) throw new HttpError(400, `${name} invalide.`);
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(400, `${name} invalide.`);
  }
  if (url.protocol !== "https:" || url.username || url.password) throw new HttpError(400, `${name} invalide.`);
  return url.href;
}
__name(optionalHttpUrl, "optionalHttpUrl");
function validId(value) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw new HttpError(400, "Identifiant invalide.");
  return value;
}
__name(validId, "validId");
function cookieId(request, name) {
  const raw = cookieValue(request, name);
  return /^[0-9a-f-]{36}$/i.test(raw) ? raw : "";
}
__name(cookieId, "cookieId");
function newId() {
  return crypto.randomUUID();
}
__name(newId, "newId");

// api/admin/announcements.js
async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    const { results = [] } = await dbFor(env).prepare("SELECT id, title, message, external_url AS externalUrl, active, created_at AS createdAt, updated_at AS updatedAt FROM announcements ORDER BY updated_at DESC").all();
    return json({ announcements: results });
  } catch (error) {
    return errorResponse(error, "Chargement des annonces impossible.");
  }
}
__name(onRequestGet, "onRequestGet");
async function onRequestPost({ request, env }) {
  try {
    await requireAdmin(request, env, true);
    const body = await readJson(request);
    const id = body.id ? validId(body.id) : newId();
    const title = requiredText(body.title, "Titre", 100);
    const message = requiredText(body.message, "Message", 1200);
    const externalUrl = optionalHttpUrl(body.externalUrl);
    if (typeof body.active !== "boolean") throw new HttpError(400, "\xC9tat de l\u2019annonce invalide.");
    const db = dbFor(env);
    const exists = body.id ? await db.prepare("SELECT id FROM announcements WHERE id = ?").bind(id).first() : null;
    if (body.id && !exists) throw new HttpError(404, "Annonce introuvable.");
    const now = Math.floor(Date.now() / 1e3);
    if (exists) {
      await db.prepare("UPDATE announcements SET title=?, message=?, external_url=?, active=?, updated_at=? WHERE id=?").bind(title, message, externalUrl, Number(body.active), now, id).run();
    } else {
      await db.prepare("INSERT INTO announcements (id, title, message, external_url, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, title, message, externalUrl, Number(body.active), now, now).run();
    }
    return json({ ok: true, id });
  } catch (error) {
    return errorResponse(error, "Enregistrement de l\u2019annonce impossible.");
  }
}
__name(onRequestPost, "onRequestPost");
async function onRequestDelete({ request, env }) {
  try {
    await requireAdmin(request, env, true);
    const { id } = await readJson(request, 4096);
    await dbFor(env).prepare("DELETE FROM announcements WHERE id = ?").bind(validId(id)).run();
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Suppression de l\u2019annonce impossible.");
  }
}
__name(onRequestDelete, "onRequestDelete");

// api/admin/login.js
async function onRequestPost2({ request, env }) {
  try {
    requireSameOrigin(request);
    const body = await readJson(request, 4096);
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (username.length > 120 || password.length > 1024) throw new HttpError(400, "Identifiants invalides.");
    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD_HASH || !env.ADMIN_SESSION_SECRET) throw new HttpError(503, "L\u2019acc\xE8s administrateur n\u2019est pas configur\xE9.");
    const db = dbFor(env);
    const clientHash = await hashClientKey(request, env);
    const now = Math.floor(Date.now() / 1e3);
    await db.prepare("DELETE FROM admin_login_attempts WHERE created_at < ?").bind(now - 900).run();
    const recent = await db.prepare("SELECT COUNT(*) AS total FROM admin_login_attempts WHERE client_hash = ? AND created_at > ?").bind(clientHash, now - 900).first();
    if (Number(recent?.total || 0) >= 6) return json({ error: "Trop de tentatives. R\xE9essayez dans 15 minutes." }, 429);
    const validUser = username === env.ADMIN_USERNAME;
    const validPassword = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
    if (!validUser || !validPassword) {
      await db.prepare("INSERT INTO admin_login_attempts (client_hash, created_at) VALUES (?, ?)").bind(clientHash, now).run();
      return json({ error: "Identifiants incorrects." }, 401);
    }
    await db.prepare("DELETE FROM admin_login_attempts WHERE client_hash = ?").bind(clientHash).run();
    const token = await issueSession(env, env.ADMIN_USERNAME);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(request, token) });
  } catch (error) {
    return errorResponse(error, "Connexion impossible.");
  }
}
__name(onRequestPost2, "onRequestPost");

// api/admin/logout.js
async function onRequestPost3({ request, env }) {
  try {
    requireSameOrigin(request);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(request, "", 0) });
  } catch (error) {
    return errorResponse(error, "D\xE9connexion impossible.");
  }
}
__name(onRequestPost3, "onRequestPost");

// api/admin/products.js
var selectProducts = "SELECT id, placement, name, category, description, price, old_price AS oldPrice, currency, external_url AS externalUrl, featured, active, updated_at AS updatedAt FROM products ORDER BY placement, featured DESC, name COLLATE NOCASE";
function productFrom(body) {
  const placement = body.placement;
  if (placement !== "shop" && placement !== "training") throw new HttpError(400, "Emplacement invalide.");
  if (body.currency !== "USD" && body.currency !== "FCFA") throw new HttpError(400, "Devise invalide.");
  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0 || price > 1e8 || Math.round(price * 100) !== price * 100) throw new HttpError(400, "Prix invalide.");
  const oldPrice = body.oldPrice === "" || body.oldPrice === null || body.oldPrice === void 0 ? null : Number(body.oldPrice);
  if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice < price || oldPrice > 1e8 || Math.round(oldPrice * 100) !== oldPrice * 100)) throw new HttpError(400, "Ancien prix invalide.");
  if (typeof body.active !== "boolean" || typeof body.featured !== "boolean") throw new HttpError(400, "\xC9tat du produit invalide.");
  return {
    id: body.id ? validId(body.id) : newId(),
    placement,
    name: requiredText(body.name, "Nom", 100),
    category: requiredText(body.category, "Cat\xE9gorie", 48),
    description: requiredText(body.description, "Description", 800),
    price,
    oldPrice,
    currency: body.currency,
    externalUrl: optionalHttpUrl(body.externalUrl),
    featured: body.featured,
    active: body.active
  };
}
__name(productFrom, "productFrom");
async function onRequestGet2({ request, env }) {
  try {
    await requireAdmin(request, env);
    const { results = [] } = await dbFor(env).prepare(selectProducts).all();
    return json({ products: results });
  } catch (error) {
    return errorResponse(error, "Chargement des produits impossible.");
  }
}
__name(onRequestGet2, "onRequestGet");
async function onRequestPost4({ request, env }) {
  try {
    await requireAdmin(request, env, true);
    const body = await readJson(request);
    const product = productFrom(body);
    const db = dbFor(env);
    const now = Math.floor(Date.now() / 1e3);
    const exists = body.id ? await db.prepare("SELECT id FROM products WHERE id = ?").bind(product.id).first() : null;
    if (body.id && !exists) throw new HttpError(404, "Produit introuvable.");
    if (product.featured) await db.prepare("UPDATE products SET featured = 0 WHERE placement = ? AND id != ?").bind(product.placement, product.id).run();
    const sql = exists ? "UPDATE products SET placement=?, name=?, category=?, description=?, price=?, old_price=?, currency=?, external_url=?, featured=?, active=?, updated_at=? WHERE id=?" : "INSERT INTO products (placement, name, category, description, price, old_price, currency, external_url, featured, active, updated_at, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    await db.prepare(sql).bind(product.placement, product.name, product.category, product.description, product.price, product.oldPrice, product.currency, product.externalUrl, Number(product.featured), Number(product.active), now, product.id).run();
    return json({ ok: true, id: product.id });
  } catch (error) {
    return errorResponse(error, "Enregistrement du produit impossible.");
  }
}
__name(onRequestPost4, "onRequestPost");
async function onRequestDelete2({ request, env }) {
  try {
    await requireAdmin(request, env, true);
    const { id } = await readJson(request, 4096);
    await dbFor(env).prepare("DELETE FROM products WHERE id = ?").bind(validId(id)).run();
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error, "Suppression du produit impossible.");
  }
}
__name(onRequestDelete2, "onRequestDelete");

// api/admin/settings.js
async function onRequestGet3({ request, env }) {
  try {
    await requireAdmin(request, env);
    const row = await dbFor(env).prepare("SELECT value FROM site_settings WHERE key = 'background_url'").first();
    return json({ backgroundUrl: row?.value || "/assets/lezachh-cyber-portrait.jpg" });
  } catch (error) {
    return errorResponse(error, "Chargement des r\xE9glages impossible.");
  }
}
__name(onRequestGet3, "onRequestGet");
async function onRequestPost5({ request, env }) {
  try {
    await requireAdmin(request, env, true);
    const body = await readJson(request, 4096);
    const backgroundUrl = optionalHttpUrl(body.backgroundUrl, "Image de fond");
    if (!backgroundUrl) return json({ error: "Indiquez un chemin local ou une URL HTTPS." }, 400);
    const now = Math.floor(Date.now() / 1e3);
    await dbFor(env).prepare("INSERT INTO site_settings (key, value, updated_at) VALUES ('background_url', ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").bind(backgroundUrl, now).run();
    return json({ ok: true, backgroundUrl });
  } catch (error) {
    return errorResponse(error, "Enregistrement de l\u2019image impossible.");
  }
}
__name(onRequestPost5, "onRequestPost");

// api/admin/stats.js
var dayOffset = /* @__PURE__ */ __name((n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10), "dayOffset");
async function onRequestGet4({ request, env }) {
  try {
    await requireAdmin(request, env);
    const db = dbFor(env);
    const d1 = dayOffset(0), d7 = dayOffset(6), d30 = dayOffset(29);
    const count = /* @__PURE__ */ __name(async (sql, ...args) => Number((await db.prepare(sql).bind(...args).first())?.n || 0), "count");
    const [today, week, month, viewsToday, viewsWeek, viewsMonth, total, series, uniques, pages, referrers] = await Promise.all([
      count("SELECT COUNT(*) AS n FROM visit_days WHERE day = ?", d1),
      count("SELECT COUNT(DISTINCT visitor_id) AS n FROM visit_days WHERE day >= ?", d7),
      count("SELECT COUNT(DISTINCT visitor_id) AS n FROM visit_days WHERE day >= ?", d30),
      count("SELECT COALESCE(SUM(views), 0) AS n FROM daily_views WHERE day = ?", d1),
      count("SELECT COALESCE(SUM(views), 0) AS n FROM daily_views WHERE day >= ?", d7),
      count("SELECT COALESCE(SUM(views), 0) AS n FROM daily_views WHERE day >= ?", d30),
      count("SELECT COUNT(*) AS n FROM visitors"),
      db.prepare("SELECT day, SUM(views) AS views FROM daily_views WHERE day >= ? GROUP BY day").bind(dayOffset(13)).all(),
      db.prepare("SELECT day, COUNT(*) AS visitors FROM visit_days WHERE day >= ? GROUP BY day").bind(dayOffset(13)).all(),
      db.prepare("SELECT path, SUM(views) AS views FROM daily_views WHERE day >= ? GROUP BY path ORDER BY views DESC LIMIT 5").bind(d30).all(),
      db.prepare("SELECT domain, SUM(visits) AS visits FROM daily_referrers WHERE day >= ? GROUP BY domain ORDER BY visits DESC LIMIT 5").bind(d30).all()
    ]);
    const v = new Map((series.results || []).map((r) => [r.day, Number(r.views)]));
    const u = new Map((uniques.results || []).map((r) => [r.day, Number(r.visitors)]));
    const days = Array.from({ length: 14 }, (_, i) => dayOffset(13 - i)).map((day) => ({ day, views: v.get(day) || 0, visitors: u.get(day) || 0 }));
    return json({ visitors: { today, week, month, total }, views: { today: viewsToday, week: viewsWeek, month: viewsMonth }, days, pages: pages.results || [], referrers: referrers.results || [] });
  } catch (error) {
    return errorResponse(error, "Chargement des statistiques impossible.");
  }
}
__name(onRequestGet4, "onRequestGet");

// api/admin/upload.js
var MAX_BYTES = 12e5;
function detect(b) {
  if (b[0] === 255 && b[1] === 216 && b[2] === 255) return "image/jpeg";
  if (b[0] === 137 && b[1] === 80 && b[2] === 78 && b[3] === 71) return "image/png";
  if (b[0] === 82 && b[1] === 73 && b[2] === 70 && b[3] === 70 && b[8] === 87 && b[9] === 69 && b[10] === 66 && b[11] === 80) return "image/webp";
  return "";
}
__name(detect, "detect");
async function onRequestPost6({ request, env }) {
  try {
    await requireAdmin(request, env, true);
    if (Number(request.headers.get("content-length") || 0) > MAX_BYTES) throw new HttpError(413, "Image trop lourde (1,2 Mo maximum).");
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BYTES) throw new HttpError(413, "Image trop lourde (1,2 Mo maximum).");
    const mime = detect(bytes);
    if (!mime) throw new HttpError(415, "Formats accept\xE9s : JPG, PNG ou WebP.");
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const id = newId(), db = dbFor(env);
    await db.prepare("INSERT INTO media (id, mime, data, created_at) VALUES (?, ?, ?, ?)").bind(id, mime, btoa(binary), Math.floor(Date.now() / 1e3)).run();
    await db.prepare("DELETE FROM media WHERE id NOT IN (SELECT id FROM media ORDER BY created_at DESC LIMIT 8)").run();
    return json({ ok: true, url: "/api/media/" + id });
  } catch (error) {
    return errorResponse(error, "Envoi de l\u2019image impossible.");
  }
}
__name(onRequestPost6, "onRequestPost");

// api/admin/visitors.js
async function onRequestGet5({ request, env }) {
  try {
    await requireAdmin(request, env);
    const { results = [] } = await dbFor(env).prepare("SELECT visitor_id AS visitorId, first_seen AS firstSeen, last_seen AS lastSeen, view_count AS viewCount, last_page AS lastPage, referrer_domain AS referrerDomain FROM visitors ORDER BY last_seen DESC LIMIT 200").all();
    return json({ visitors: results });
  } catch (error) {
    return errorResponse(error, "Chargement des visites impossible.");
  }
}
__name(onRequestGet5, "onRequestGet");

// api/media/[id].js
async function onRequestGet6({ params, env }) {
  try {
    const row = await dbFor(env).prepare("SELECT mime, data FROM media WHERE id = ?").bind(validId(params.id)).first();
    if (!row) throw new HttpError(404, "Image introuvable.");
    const bytes = Uint8Array.from(atob(row.data), (c) => c.charCodeAt(0));
    return new Response(bytes, { headers: { "content-type": row.mime, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff", "cross-origin-resource-policy": "same-origin", "content-security-policy": "default-src 'none'" } });
  } catch (error) {
    return errorResponse(error, "Image indisponible.");
  }
}
__name(onRequestGet6, "onRequestGet");

// api/background-style.js
async function onRequestGet7({ env }) {
  try {
    const row = await dbFor(env).prepare("SELECT value FROM site_settings WHERE key = 'background_url'").first();
    const image = optionalHttpUrl(row?.value || "/assets/lezachh-cyber-portrait.jpg", "Image de fond");
    const escaped = image.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\r\n\f]/g, "");
    return new Response(`body::before { background-image: url("${escaped}") !important; }`, {
      headers: { "content-type": "text/css; charset=utf-8", "cache-control": "public, max-age=60", "x-content-type-options": "nosniff", "cross-origin-resource-policy": "same-origin" }
    });
  } catch {
    return new Response("/* arri\xE8re-plan par d\xE9faut */", { headers: { "content-type": "text/css; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
  }
}
__name(onRequestGet7, "onRequestGet");

// api/health.js
var headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
async function tableReady(db, table) {
  try {
    await db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).first();
    return true;
  } catch {
    return false;
  }
}
__name(tableReady, "tableReady");
async function onRequestGet8({ env }) {
  const checks = {
    database: Boolean(env.DB),
    migrations: false,
    adminUsername: Boolean(env.ADMIN_USERNAME),
    adminPasswordHash: Boolean(env.ADMIN_PASSWORD_HASH),
    sessionSecret: typeof env.ADMIN_SESSION_SECRET === "string" && env.ADMIN_SESSION_SECRET.length >= 32
  };
  if (env.DB) checks.migrations = (await Promise.all(["products", "announcements", "site_settings", "visitors", "admin_login_attempts", "visit_days", "daily_views", "daily_referrers", "media"].map((t) => tableReady(env.DB, t)))).every(Boolean);
  const ok = Object.values(checks).every(Boolean);
  return new Response(JSON.stringify({ status: ok ? "ok" : "setup-required", service: "LeZachh", checks }), { headers });
}
__name(onRequestGet8, "onRequestGet");

// api/site-data.js
async function onRequestGet9({ env }) {
  try {
    const db = dbFor(env);
    const [productRows, announcementRows, settingRow] = await Promise.all([
      db.prepare("SELECT id, placement, name, category, description, price, old_price AS oldPrice, currency, external_url AS externalUrl, featured FROM products WHERE active = 1 ORDER BY placement, featured DESC, name COLLATE NOCASE").all(),
      db.prepare("SELECT id, title, message, external_url AS externalUrl FROM announcements WHERE active = 1 ORDER BY updated_at DESC LIMIT 20").all(),
      db.prepare("SELECT value FROM site_settings WHERE key = 'background_url'").first()
    ]);
    return json({ products: productRows.results || [], announcements: announcementRows.results || [], backgroundUrl: settingRow?.value || "/assets/lezachh-cyber-portrait.jpg" }, 200, { "cache-control": "public, max-age=60, stale-while-revalidate=300" });
  } catch (error) {
    return errorResponse(error, "Contenu temporairement indisponible.");
  }
}
__name(onRequestGet9, "onRequestGet");

// api/visit.js
function visitorCookie(request, id) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `lezachh_visitor=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=15552000${secure}`;
}
__name(visitorCookie, "visitorCookie");
function cleanPage(value, request) {
  if (typeof value !== "string" || value.length > 512) throw new HttpError(400, "Page invalide.");
  let url;
  try {
    url = new URL(value, request.url);
  } catch {
    throw new HttpError(400, "Page invalide.");
  }
  if (url.origin !== new URL(request.url).origin) throw new HttpError(400, "Page invalide.");
  return (url.pathname || "/").slice(0, 180);
}
__name(cleanPage, "cleanPage");
function referrerDomain(request) {
  try {
    const referrer = new URL(request.headers.get("referer") || "");
    return referrer.origin === new URL(request.url).origin ? "" : referrer.hostname.slice(0, 120);
  } catch {
    return "";
  }
}
__name(referrerDomain, "referrerDomain");
async function onRequestPost7({ request, env }) {
  try {
    requireSameOrigin(request);
    const body = await readJson(request, 2048);
    const page = cleanPage(body.path, request);
    const id = cookieId(request, "lezachh_visitor") || newId();
    const now = Math.floor(Date.now() / 1e3);
    const referrer = referrerDomain(request);
    const db = dbFor(env);
    const isNew = !cookieId(request, "lezachh_visitor");
    if (isNew) {
      const total = await db.prepare("SELECT COUNT(*) AS n FROM visitors").first();
      if (Number(total?.n || 0) >= 1e5) return json({ ok: true });
    }
    if (Math.random() < 0.02) {
      await db.prepare("DELETE FROM visitors WHERE last_seen < ?").bind(now - 31536e3).run();
      const cutoff = new Date((now - 90 * 86400) * 1e3).toISOString().slice(0, 10);
      for (const table of ["visit_days", "daily_views", "daily_referrers"]) await db.prepare(`DELETE FROM ${table} WHERE day < ?`).bind(cutoff).run();
    }
    const day = new Date(now * 1e3).toISOString().slice(0, 10);
    await db.prepare("INSERT OR IGNORE INTO visit_days (day, visitor_id) VALUES (?, ?)").bind(day, id).run();
    await db.prepare("INSERT INTO daily_views (day, path, views) VALUES (?, ?, 1) ON CONFLICT(day, path) DO UPDATE SET views = views + 1").bind(day, page).run();
    if (referrer) await db.prepare("INSERT INTO daily_referrers (day, domain, visits) VALUES (?, ?, 1) ON CONFLICT(day, domain) DO UPDATE SET visits = visits + 1").bind(day, referrer).run();
    await db.prepare("INSERT INTO visitors (visitor_id, first_seen, last_seen, view_count, last_page, referrer_domain) VALUES (?, ?, ?, 1, ?, ?) ON CONFLICT(visitor_id) DO UPDATE SET last_seen=excluded.last_seen, view_count=visitors.view_count+1, last_page=excluded.last_page, referrer_domain=CASE WHEN excluded.referrer_domain != '' THEN excluded.referrer_domain ELSE visitors.referrer_domain END").bind(id, now, now, page, referrer).run();
    return json({ ok: true }, 200, { "set-cookie": visitorCookie(request, id) });
  } catch (error) {
    return errorResponse(error, "La visite n\u2019a pas pu \xEAtre enregistr\xE9e.");
  }
}
__name(onRequestPost7, "onRequestPost");
async function onRequestDelete3({ request, env }) {
  try {
    requireSameOrigin(request);
    const id = cookieId(request, "lezachh_visitor");
    if (id) await dbFor(env).prepare("DELETE FROM visitors WHERE visitor_id = ?").bind(id).run();
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    return json({ ok: true }, 200, { "set-cookie": `lezachh_visitor=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}` });
  } catch (error) {
    return errorResponse(error, "Le retrait des statistiques a \xE9chou\xE9.");
  }
}
__name(onRequestDelete3, "onRequestDelete");

// ../.wrangler/tmp/pages-qlzolw/functionsRoutes-0.44203245168394334.mjs
var routes = [
  {
    routePath: "/api/admin/announcements",
    mountPath: "/api/admin",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete]
  },
  {
    routePath: "/api/admin/announcements",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet]
  },
  {
    routePath: "/api/admin/announcements",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost]
  },
  {
    routePath: "/api/admin/login",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost2]
  },
  {
    routePath: "/api/admin/logout",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost3]
  },
  {
    routePath: "/api/admin/products",
    mountPath: "/api/admin",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete2]
  },
  {
    routePath: "/api/admin/products",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet2]
  },
  {
    routePath: "/api/admin/products",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost4]
  },
  {
    routePath: "/api/admin/settings",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet3]
  },
  {
    routePath: "/api/admin/settings",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost5]
  },
  {
    routePath: "/api/admin/stats",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet4]
  },
  {
    routePath: "/api/admin/upload",
    mountPath: "/api/admin",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost6]
  },
  {
    routePath: "/api/admin/visitors",
    mountPath: "/api/admin",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet5]
  },
  {
    routePath: "/api/media/:id",
    mountPath: "/api/media",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet6]
  },
  {
    routePath: "/api/background-style",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet7]
  },
  {
    routePath: "/api/health",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet8]
  },
  {
    routePath: "/api/site-data",
    mountPath: "/api",
    method: "GET",
    middlewares: [],
    modules: [onRequestGet9]
  },
  {
    routePath: "/api/visit",
    mountPath: "/api",
    method: "DELETE",
    middlewares: [],
    modules: [onRequestDelete3]
  },
  {
    routePath: "/api/visit",
    mountPath: "/api",
    method: "POST",
    middlewares: [],
    modules: [onRequestPost7]
  }
];

// ../../../../tmp/wr/node_modules/path-to-regexp/dist.es2015/index.js
function lexer(str) {
  var tokens = [];
  var i = 0;
  while (i < str.length) {
    var char = str[i];
    if (char === "*" || char === "+" || char === "?") {
      tokens.push({ type: "MODIFIER", index: i, value: str[i++] });
      continue;
    }
    if (char === "\\") {
      tokens.push({ type: "ESCAPED_CHAR", index: i++, value: str[i++] });
      continue;
    }
    if (char === "{") {
      tokens.push({ type: "OPEN", index: i, value: str[i++] });
      continue;
    }
    if (char === "}") {
      tokens.push({ type: "CLOSE", index: i, value: str[i++] });
      continue;
    }
    if (char === ":") {
      var name = "";
      var j = i + 1;
      while (j < str.length) {
        var code = str.charCodeAt(j);
        if (
          // `0-9`
          code >= 48 && code <= 57 || // `A-Z`
          code >= 65 && code <= 90 || // `a-z`
          code >= 97 && code <= 122 || // `_`
          code === 95
        ) {
          name += str[j++];
          continue;
        }
        break;
      }
      if (!name)
        throw new TypeError("Missing parameter name at ".concat(i));
      tokens.push({ type: "NAME", index: i, value: name });
      i = j;
      continue;
    }
    if (char === "(") {
      var count = 1;
      var pattern = "";
      var j = i + 1;
      if (str[j] === "?") {
        throw new TypeError('Pattern cannot start with "?" at '.concat(j));
      }
      while (j < str.length) {
        if (str[j] === "\\") {
          pattern += str[j++] + str[j++];
          continue;
        }
        if (str[j] === ")") {
          count--;
          if (count === 0) {
            j++;
            break;
          }
        } else if (str[j] === "(") {
          count++;
          if (str[j + 1] !== "?") {
            throw new TypeError("Capturing groups are not allowed at ".concat(j));
          }
        }
        pattern += str[j++];
      }
      if (count)
        throw new TypeError("Unbalanced pattern at ".concat(i));
      if (!pattern)
        throw new TypeError("Missing pattern at ".concat(i));
      tokens.push({ type: "PATTERN", index: i, value: pattern });
      i = j;
      continue;
    }
    tokens.push({ type: "CHAR", index: i, value: str[i++] });
  }
  tokens.push({ type: "END", index: i, value: "" });
  return tokens;
}
__name(lexer, "lexer");
function parse(str, options) {
  if (options === void 0) {
    options = {};
  }
  var tokens = lexer(str);
  var _a = options.prefixes, prefixes = _a === void 0 ? "./" : _a, _b = options.delimiter, delimiter = _b === void 0 ? "/#?" : _b;
  var result = [];
  var key = 0;
  var i = 0;
  var path = "";
  var tryConsume = /* @__PURE__ */ __name(function(type) {
    if (i < tokens.length && tokens[i].type === type)
      return tokens[i++].value;
  }, "tryConsume");
  var mustConsume = /* @__PURE__ */ __name(function(type) {
    var value2 = tryConsume(type);
    if (value2 !== void 0)
      return value2;
    var _a2 = tokens[i], nextType = _a2.type, index = _a2.index;
    throw new TypeError("Unexpected ".concat(nextType, " at ").concat(index, ", expected ").concat(type));
  }, "mustConsume");
  var consumeText = /* @__PURE__ */ __name(function() {
    var result2 = "";
    var value2;
    while (value2 = tryConsume("CHAR") || tryConsume("ESCAPED_CHAR")) {
      result2 += value2;
    }
    return result2;
  }, "consumeText");
  var isSafe = /* @__PURE__ */ __name(function(value2) {
    for (var _i = 0, delimiter_1 = delimiter; _i < delimiter_1.length; _i++) {
      var char2 = delimiter_1[_i];
      if (value2.indexOf(char2) > -1)
        return true;
    }
    return false;
  }, "isSafe");
  var safePattern = /* @__PURE__ */ __name(function(prefix2) {
    var prev = result[result.length - 1];
    var prevText = prefix2 || (prev && typeof prev === "string" ? prev : "");
    if (prev && !prevText) {
      throw new TypeError('Must have text between two parameters, missing text after "'.concat(prev.name, '"'));
    }
    if (!prevText || isSafe(prevText))
      return "[^".concat(escapeString(delimiter), "]+?");
    return "(?:(?!".concat(escapeString(prevText), ")[^").concat(escapeString(delimiter), "])+?");
  }, "safePattern");
  while (i < tokens.length) {
    var char = tryConsume("CHAR");
    var name = tryConsume("NAME");
    var pattern = tryConsume("PATTERN");
    if (name || pattern) {
      var prefix = char || "";
      if (prefixes.indexOf(prefix) === -1) {
        path += prefix;
        prefix = "";
      }
      if (path) {
        result.push(path);
        path = "";
      }
      result.push({
        name: name || key++,
        prefix,
        suffix: "",
        pattern: pattern || safePattern(prefix),
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    var value = char || tryConsume("ESCAPED_CHAR");
    if (value) {
      path += value;
      continue;
    }
    if (path) {
      result.push(path);
      path = "";
    }
    var open = tryConsume("OPEN");
    if (open) {
      var prefix = consumeText();
      var name_1 = tryConsume("NAME") || "";
      var pattern_1 = tryConsume("PATTERN") || "";
      var suffix = consumeText();
      mustConsume("CLOSE");
      result.push({
        name: name_1 || (pattern_1 ? key++ : ""),
        pattern: name_1 && !pattern_1 ? safePattern(prefix) : pattern_1,
        prefix,
        suffix,
        modifier: tryConsume("MODIFIER") || ""
      });
      continue;
    }
    mustConsume("END");
  }
  return result;
}
__name(parse, "parse");
function match(str, options) {
  var keys = [];
  var re = pathToRegexp(str, keys, options);
  return regexpToFunction(re, keys, options);
}
__name(match, "match");
function regexpToFunction(re, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.decode, decode = _a === void 0 ? function(x) {
    return x;
  } : _a;
  return function(pathname) {
    var m = re.exec(pathname);
    if (!m)
      return false;
    var path = m[0], index = m.index;
    var params = /* @__PURE__ */ Object.create(null);
    var _loop_1 = /* @__PURE__ */ __name(function(i2) {
      if (m[i2] === void 0)
        return "continue";
      var key = keys[i2 - 1];
      if (key.modifier === "*" || key.modifier === "+") {
        params[key.name] = m[i2].split(key.prefix + key.suffix).map(function(value) {
          return decode(value, key);
        });
      } else {
        params[key.name] = decode(m[i2], key);
      }
    }, "_loop_1");
    for (var i = 1; i < m.length; i++) {
      _loop_1(i);
    }
    return { path, index, params };
  };
}
__name(regexpToFunction, "regexpToFunction");
function escapeString(str) {
  return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, "\\$1");
}
__name(escapeString, "escapeString");
function flags(options) {
  return options && options.sensitive ? "" : "i";
}
__name(flags, "flags");
function regexpToRegexp(path, keys) {
  if (!keys)
    return path;
  var groupsRegex = /\((?:\?<(.*?)>)?(?!\?)/g;
  var index = 0;
  var execResult = groupsRegex.exec(path.source);
  while (execResult) {
    keys.push({
      // Use parenthesized substring match if available, index otherwise
      name: execResult[1] || index++,
      prefix: "",
      suffix: "",
      modifier: "",
      pattern: ""
    });
    execResult = groupsRegex.exec(path.source);
  }
  return path;
}
__name(regexpToRegexp, "regexpToRegexp");
function arrayToRegexp(paths, keys, options) {
  var parts = paths.map(function(path) {
    return pathToRegexp(path, keys, options).source;
  });
  return new RegExp("(?:".concat(parts.join("|"), ")"), flags(options));
}
__name(arrayToRegexp, "arrayToRegexp");
function stringToRegexp(path, keys, options) {
  return tokensToRegexp(parse(path, options), keys, options);
}
__name(stringToRegexp, "stringToRegexp");
function tokensToRegexp(tokens, keys, options) {
  if (options === void 0) {
    options = {};
  }
  var _a = options.strict, strict = _a === void 0 ? false : _a, _b = options.start, start = _b === void 0 ? true : _b, _c = options.end, end = _c === void 0 ? true : _c, _d = options.encode, encode = _d === void 0 ? function(x) {
    return x;
  } : _d, _e = options.delimiter, delimiter = _e === void 0 ? "/#?" : _e, _f = options.endsWith, endsWith = _f === void 0 ? "" : _f;
  var endsWithRe = "[".concat(escapeString(endsWith), "]|$");
  var delimiterRe = "[".concat(escapeString(delimiter), "]");
  var route = start ? "^" : "";
  for (var _i = 0, tokens_1 = tokens; _i < tokens_1.length; _i++) {
    var token = tokens_1[_i];
    if (typeof token === "string") {
      route += escapeString(encode(token));
    } else {
      var prefix = escapeString(encode(token.prefix));
      var suffix = escapeString(encode(token.suffix));
      if (token.pattern) {
        if (keys)
          keys.push(token);
        if (prefix || suffix) {
          if (token.modifier === "+" || token.modifier === "*") {
            var mod = token.modifier === "*" ? "?" : "";
            route += "(?:".concat(prefix, "((?:").concat(token.pattern, ")(?:").concat(suffix).concat(prefix, "(?:").concat(token.pattern, "))*)").concat(suffix, ")").concat(mod);
          } else {
            route += "(?:".concat(prefix, "(").concat(token.pattern, ")").concat(suffix, ")").concat(token.modifier);
          }
        } else {
          if (token.modifier === "+" || token.modifier === "*") {
            throw new TypeError('Can not repeat "'.concat(token.name, '" without a prefix and suffix'));
          }
          route += "(".concat(token.pattern, ")").concat(token.modifier);
        }
      } else {
        route += "(?:".concat(prefix).concat(suffix, ")").concat(token.modifier);
      }
    }
  }
  if (end) {
    if (!strict)
      route += "".concat(delimiterRe, "?");
    route += !options.endsWith ? "$" : "(?=".concat(endsWithRe, ")");
  } else {
    var endToken = tokens[tokens.length - 1];
    var isEndDelimited = typeof endToken === "string" ? delimiterRe.indexOf(endToken[endToken.length - 1]) > -1 : endToken === void 0;
    if (!strict) {
      route += "(?:".concat(delimiterRe, "(?=").concat(endsWithRe, "))?");
    }
    if (!isEndDelimited) {
      route += "(?=".concat(delimiterRe, "|").concat(endsWithRe, ")");
    }
  }
  return new RegExp(route, flags(options));
}
__name(tokensToRegexp, "tokensToRegexp");
function pathToRegexp(path, keys, options) {
  if (path instanceof RegExp)
    return regexpToRegexp(path, keys);
  if (Array.isArray(path))
    return arrayToRegexp(path, keys, options);
  return stringToRegexp(path, keys, options);
}
__name(pathToRegexp, "pathToRegexp");

// ../../../../tmp/wr/node_modules/wrangler/templates/pages-template-worker.ts
var escapeRegex = /[.+?^${}()|[\]\\]/g;
function getOriginalPathPrefix(requestPath, normalizedPrefix) {
  let end = 0;
  for (let index = 0; index < normalizedPrefix.length; index++) {
    end++;
    if (normalizedPrefix[index] === "/") {
      while (requestPath[end] === "/") {
        end++;
      }
    }
  }
  return requestPath.slice(0, end);
}
__name(getOriginalPathPrefix, "getOriginalPathPrefix");
function* executeRequest(request) {
  const requestPath = new URL(request.url).pathname;
  const normalizedRequestPath = requestPath.replace(/\/+/g, "/");
  for (const route of [...routes].reverse()) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath) || routeMatcher(normalizedRequestPath);
    const originalMountMatch = mountMatcher(requestPath);
    const mountMatchResult = originalMountMatch || mountMatcher(normalizedRequestPath);
    if (matchResult && mountMatchResult) {
      const path = originalMountMatch ? originalMountMatch.path : getOriginalPathPrefix(requestPath, mountMatchResult.path);
      for (const handler of route.middlewares.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path
        };
      }
    }
  }
  for (const route of routes) {
    if (route.method && route.method !== request.method) {
      continue;
    }
    const routeMatcher = match(route.routePath.replace(escapeRegex, "\\$&"), {
      end: true
    });
    const mountMatcher = match(route.mountPath.replace(escapeRegex, "\\$&"), {
      end: false
    });
    const matchResult = routeMatcher(requestPath);
    const mountMatchResult = mountMatcher(requestPath);
    if (matchResult && mountMatchResult && route.modules.length) {
      for (const handler of route.modules.flat()) {
        yield {
          handler,
          params: matchResult.params,
          path: matchResult.path
        };
      }
      break;
    }
  }
}
__name(executeRequest, "executeRequest");
var pages_template_worker_default = {
  async fetch(originalRequest, env, workerContext) {
    let request = originalRequest;
    const handlerIterator = executeRequest(request);
    let data = {};
    let isFailOpen = false;
    const next = /* @__PURE__ */ __name(async (input, init) => {
      if (input !== void 0) {
        let url = input;
        if (typeof input === "string") {
          url = new URL(input, request.url).toString();
        }
        request = new Request(url, init);
      }
      const result = handlerIterator.next();
      if (result.done === false) {
        const { handler, params, path } = result.value;
        const context = {
          request: new Request(request.clone()),
          functionPath: path,
          next,
          params,
          get data() {
            return data;
          },
          set data(value) {
            if (typeof value !== "object" || value === null) {
              throw new Error("context.data must be an object");
            }
            data = value;
          },
          env,
          waitUntil: workerContext.waitUntil.bind(workerContext),
          passThroughOnException: /* @__PURE__ */ __name(() => {
            isFailOpen = true;
          }, "passThroughOnException")
        };
        const response = await handler(context);
        if (!(response instanceof Response)) {
          throw new Error("Your Pages function should return a Response");
        }
        return cloneResponse(response);
      } else if ("ASSETS") {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      } else {
        const response = await fetch(request);
        return cloneResponse(response);
      }
    }, "next");
    try {
      return await next();
    } catch (error) {
      if (isFailOpen) {
        const response = await env["ASSETS"].fetch(request);
        return cloneResponse(response);
      }
      throw error;
    }
  }
};
var cloneResponse = /* @__PURE__ */ __name((response) => (
  // https://fetch.spec.whatwg.org/#null-body-status
  new Response(
    [101, 204, 205, 304].includes(response.status) ? null : response.body,
    response
  )
), "cloneResponse");
export {
  pages_template_worker_default as default
};
