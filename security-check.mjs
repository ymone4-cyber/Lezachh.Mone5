import assert from "node:assert/strict";
import { createHash, pbkdf2Sync, randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { onRequestPost as login } from "../functions/api/admin/login.js";
import { onRequestGet as getVisitors } from "../functions/api/admin/visitors.js";
import { onRequestPost as saveProduct } from "../functions/api/admin/products.js";
import { onRequestPost as saveVisit } from "../functions/api/visit.js";
import { onRequestDelete as revokeVisit } from "../functions/api/visit.js";
import { onRequestPost as saveSettings } from "../functions/api/admin/settings.js";
import { onRequestPost as saveAnnouncement } from "../functions/api/admin/announcements.js";
import { onRequestGet as getHealth } from "../functions/api/health.js";
import worker from "../worker.js";

const origin = "https://lezachh.test";
const password = "UnitTest-strong-passphrase-42!";
const salt = randomBytes(16);
const rounds = 150000;
const passwordHash = `pbkdf2-sha256$${rounds}$${salt.toString("base64url")}$${pbkdf2Sync(password, salt, rounds, 32, "sha256").toString("base64url")}`;

class FakeDB {
  attempts = 0;
  products = new Set();
  binds = [];
  sql = [];
  missingTables = new Set();
  lastVisit = null;
  deletedVisitor = null;
  prepare(statement) {
    const db = this;
    let values = [];
    db.sql.push(statement);
    return {
      bind(...args) { values = args; return this; },
      async run() {
        db.binds.push(values);
        if (statement.includes("INSERT INTO admin_login_attempts")) db.attempts += 1;
        if (statement.includes("DELETE FROM admin_login_attempts WHERE client_hash")) db.attempts = 0;
        if (statement.includes("INSERT INTO products")) db.products.add(values.at(-1));
        if (statement.includes("INSERT INTO visitors")) db.lastVisit = values;
        if (statement.includes("DELETE FROM visitors")) db.deletedVisitor = values[0];
        return { success: true };
      },
      async first() {
        const tableMatch = statement.match(/^SELECT 1 FROM ([a-z_]+) LIMIT 1$/i);
        if (tableMatch) {
          if (db.missingTables.has(tableMatch[1])) throw new Error(`no such table: ${tableMatch[1]}`);
          return { ready: 1 };
        }
        if (statement.includes("COUNT(*) AS total")) return { total: db.attempts };
        if (statement.includes("SELECT id FROM products WHERE id")) return db.products.has(values[0]) ? { id: values[0] } : null;
        return null;
      },
      async all() {
        if (statement.includes("FROM visitors")) return { results: [] };
        if (statement.includes("FROM products")) return { results: [] };
        return { results: [] };
      }
    };
  }
}

const db = new FakeDB();
const env = { DB: db, ADMIN_USERNAME: "owner", ADMIN_PASSWORD_HASH: passwordHash, ADMIN_SESSION_SECRET: randomBytes(48).toString("base64url") };
const request = (path, body, { method = "POST", cookie = "", requestOrigin = origin, ip = "203.0.113.42", extraHeaders = {} } = {}) => new Request(`${origin}${path}`, {
  method,
  headers: { ...(method !== "GET" ? { "content-type": "application/json" } : {}), ...(requestOrigin ? { origin: requestOrigin } : {}), ...(cookie ? { cookie } : {}), "cf-connecting-ip": ip, ...extraHeaders },
  ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) })
});
const loginRequest = (username, suppliedPassword, options = {}) => request("/api/admin/login", { username, password: suppliedPassword }, options);
const checks = [];
const check = async (name, operation) => { await operation(); checks.push(name); };

await check("Worker: APIs are routed before the static asset fallback", async () => {
  let assetRequests = 0;
  const assets = { async fetch(request) { assetRequests += 1; return new Response(`asset:${new URL(request.url).pathname}`); } };
  const healthResponse = await worker.fetch(new Request(`${origin}/api/health`), { ...env, ASSETS: assets });
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).status, "ok");
  const missingApi = await worker.fetch(new Request(`${origin}/api/not-a-route`), { ...env, ASSETS: assets });
  assert.equal(missingApi.status, 404);
  const wrongMethod = await worker.fetch(new Request(`${origin}/api/admin/login`, { method: "GET" }), { ...env, ASSETS: assets });
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.get("allow"), "POST");
  const staticResponse = await worker.fetch(new Request(`${origin}/admin/`), { ...env, ASSETS: assets });
  assert.equal(await staticResponse.text(), "asset:/admin/");
  assert.equal(assetRequests, 1, "API requests must not fall through to static files");
});

await check("Admin: glass security layout keeps real password authentication", async () => {
  const [adminHtml, adminStyle, passwordScript] = await Promise.all([
    readFile(new URL("../public/admin/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/admin/admin-refresh.css", import.meta.url), "utf8"),
    readFile(new URL("./hash-admin-password.mjs", import.meta.url), "utf8")
  ]);
  assert.match(adminHtml, /name="password" type="password"/);
  assert.match(adminHtml, /security-summary/);
  assert.match(adminHtml, /admin-refresh\.css/);
  assert.doesNotMatch(adminHtml, /Check your inbox|code we sent/i, "the page must not claim email OTP without a delivery service");
  assert.match(adminStyle, /backdrop-filter/);
  assert.match(adminStyle, /prefers-reduced-motion/);
  assert.match(passwordScript, /Array\.from\(password\)\.length < 10/);
  assert.match(passwordScript, /pbkdf2Sync/);
});

await check("Health: partial migrations are detected across all required tables", async () => {
  const requiredTables = ["products", "announcements", "site_settings", "visitors", "admin_login_attempts", "visit_days", "daily_views", "daily_referrers", "media"];
  const workerBundle = await readFile(new URL("../public/_worker.js", import.meta.url), "utf8");
  const bundledCheck = workerBundle.match(/checks\.migrations\s*=\s*[\s\S]{0,500}?\.every\(Boolean\)/)?.[0] || "";
  assert.ok(bundledCheck, "the deployed Worker must contain the migration readiness check");
  for (const table of requiredTables) assert.ok(bundledCheck.includes(`"${table}"`), `the deployed Worker must check ${table}`);
  for (const missingTable of requiredTables) {
    const partialDB = new FakeDB();
    partialDB.missingTables.add(missingTable);
    const response = await getHealth({ env: { ...env, DB: partialDB } });
    const status = await response.json();
    assert.equal(status.checks.migrations, false, `missing ${missingTable} must be reported`);
  }
});

const noOrigin = await login({ request: loginRequest("owner", password, { requestOrigin: "" }), env });
assert.equal(noOrigin.status, 403, "login without an origin must be rejected");
checks.push("CSRF: login without Origin rejected");

const crossOrigin = await login({ request: loginRequest("owner", password, { requestOrigin: "https://attacker.test" }), env });
assert.equal(crossOrigin.status, 403, "cross-origin login must be rejected");
checks.push("CSRF: cross-origin login rejected");

const injectionLogin = await login({ request: loginRequest("owner' OR '1'='1", password), env });
assert.equal(injectionLogin.status, 401, "SQL-like username must not bypass credential check");
assert.equal(injectionLogin.headers.has("set-cookie"), false, "invalid credentials must not create a session");
checks.push("Injection: credential bypass payload rejected");

const loginOk = await login({ request: loginRequest("owner", password), env });
assert.equal(loginOk.status, 200);
const cookieHeader = loginOk.headers.get("set-cookie");
assert.match(cookieHeader, /HttpOnly/); assert.match(cookieHeader, /SameSite=Strict/); assert.match(cookieHeader, /Secure/);
const adminCookie = cookieHeader.split(";")[0];
checks.push("Session: signed, Secure, HttpOnly, SameSite=Strict cookie issued");

await check("Auth: visitor list denied without a valid session", async () => {
  const response = await getVisitors({ request: request("/api/admin/visitors", undefined, { method: "GET" }), env });
  assert.equal(response.status, 401);
});
await check("Auth: visitor list accessible with a valid session", async () => {
  const response = await getVisitors({ request: request("/api/admin/visitors", undefined, { method: "GET", cookie: adminCookie, requestOrigin: "" }), env });
  assert.equal(response.status, 200);
});
await check("Session: modified signature rejected", async () => {
  const [key, token] = adminCookie.split("=");
  const [payload, signature] = token.split(".");
  const changed = `${key}=${payload}.${(signature[0] === "A" ? "B" : "A") + signature.slice(1)}`;
  const response = await getVisitors({ request: request("/api/admin/visitors", undefined, { method: "GET", cookie: changed, requestOrigin: "" }), env });
  assert.equal(response.status, 401);
});

const productBase = { placement: "shop", name: "Guide", category: "Test", description: "Description", price: 10, oldPrice: null, currency: "USD", externalUrl: "https://shop.example/item", featured: false, active: true };
await check("CSRF: cross-origin product update rejected", async () => {
  const response = await saveProduct({ request: request("/api/admin/products", productBase, { cookie: adminCookie, requestOrigin: "https://attacker.test" }), env });
  assert.equal(response.status, 403);
});
await check("Products: seller currencies COP and AUD are accepted", async () => {
  for (const currency of ["COP", "AUD"]) {
    const response = await saveProduct({ request: request("/api/admin/products", { ...productBase, currency }, { cookie: adminCookie }), env });
    assert.equal(response.status, 200, `${currency} prices must be accepted`);
  }
  const productsApi = await readFile(new URL("../functions/api/admin/products.js", import.meta.url), "utf8");
  assert.match(productsApi, /\["USD", "FCFA", "COP", "AUD"\]/);
});
await check("Injection: SQL payload in record ID rejected", async () => {
  const response = await saveProduct({ request: request("/api/admin/products", { ...productBase, id: "' OR 1=1 --" }, { cookie: adminCookie }), env });
  assert.equal(response.status, 400);
});
await check("Injection: javascript: link rejected", async () => {
  const response = await saveProduct({ request: request("/api/admin/products", { ...productBase, externalUrl: "javascript:alert(1)" }, { cookie: adminCookie }), env });
  assert.equal(response.status, 400);
  assert.equal(db.sql.some(sql => sql.includes("javascript:alert")), false);
});
await check("Injection: javascript: background URL rejected", async () => {
  const response = await saveSettings({ request: request("/api/admin/settings", { backgroundUrl: "javascript:alert(1)" }, { cookie: adminCookie }), env });
  assert.equal(response.status, 400);
});
await check("Input limit: oversized JSON rejected", async () => {
  const response = await saveProduct({ request: request("/api/admin/products", "{" + " ".repeat(17000) + "}", { cookie: adminCookie }), env });
  assert.equal(response.status, 413);
});
await check("XSS: HTML payload stays a bound string for text rendering", async () => {
  const htmlPayload = "<img src=x onerror=alert(1)>";
  const response = await saveProduct({ request: request("/api/admin/products", { ...productBase, name: htmlPayload }, { cookie: adminCookie }), env });
  assert.equal(response.status, 200);
  const insertion = db.sql.find(sql => sql.includes("INSERT INTO products"));
  assert.ok(insertion && insertion.includes("VALUES (?,"), "product values must be parameterized");
  assert.ok(db.binds.some(values => values.includes(htmlPayload)), "payload remains separate from the SQL string");
  const renderer = await readFile(new URL("../public/site-enhancements.js", import.meta.url), "utf8");
  assert.match(renderer, /textContent/); assert.doesNotMatch(renderer, /innerHTML|outerHTML|eval\(/);
  const adminRenderer = await readFile(new URL("../public/admin/admin.js", import.meta.url), "utf8");
  assert.match(adminRenderer, /textContent/); assert.doesNotMatch(adminRenderer, /innerHTML|outerHTML|eval\(/);
});
await check("XSS: announcement payload is accepted only as data", async () => {
  const title = "<svg onload=alert(1)>";
  const response = await saveAnnouncement({ request: request("/api/admin/announcements", { title, message: "<script>alert(1)</script>", externalUrl: "https://news.example/", active: true }, { cookie: adminCookie }), env });
  assert.equal(response.status, 200);
  const insert = db.sql.find(sql => sql.includes("INSERT INTO announcements"));
  assert.ok(insert && insert.includes("VALUES (?,"));
  assert.ok(db.binds.some(values => values.includes(title)));
});

await check("Tracking: cross-origin request rejected", async () => {
  const response = await saveVisit({ request: request("/api/visit", { path: "/" }, { requestOrigin: "https://attacker.test" }), env });
  assert.equal(response.status, 403);
});
await check("Tracking: external path injection rejected", async () => {
  const response = await saveVisit({ request: request("/api/visit", { path: "https://attacker.test/fake" }), env });
  assert.equal(response.status, 400);
});
await check("Tracking: accepted visit stores a random ID and page, never the IP", async () => {
  const response = await saveVisit({ request: request("/api/visit", { path: "/boutique?private=value" }, { ip: "198.51.100.77", extraHeaders: { referer: "https://social.example/post/secret" } }), env });
  assert.equal(response.status, 200);
  const cookie = response.headers.get("set-cookie"); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/);
  assert.equal(db.lastVisit[3], "/boutique"); assert.equal(db.lastVisit[4], "social.example");
  assert.equal(db.lastVisit.includes("198.51.100.77"), false);
  assert.equal(db.sql.some(sql => /INSERT INTO visitors[^\n]*(ip|address)/i.test(sql)), false);
  const visitorId = cookie.split(";")[0];
  const revoked = await revokeVisit({ request: request("/api/visit", undefined, { method: "DELETE", cookie: visitorId }), env });
  assert.equal(revoked.status, 200); assert.match(revoked.headers.get("set-cookie"), /Max-Age=0/);
  assert.equal(db.deletedVisitor, db.lastVisit[0]);
});

await check("Rate limit: sixth bad login locks further attempts", async () => {
  const attemptsDB = new FakeDB();
  const attemptEnv = { ...env, DB: attemptsDB };
  for (let index = 0; index < 6; index++) {
    const response = await login({ request: loginRequest("owner", "bad-password", { ip: "192.0.2.70" }), env: attemptEnv });
    assert.equal(response.status, 401);
  }
  const blocked = await login({ request: loginRequest("owner", "bad-password", { ip: "192.0.2.70" }), env: attemptEnv });
  assert.equal(blocked.status, 429);
});

const migration = await readFile(new URL("../migrations/0001_init.sql", import.meta.url), "utf8");
assert.match(migration, /CREATE TABLE IF NOT EXISTS visitors/);
assert.doesNotMatch(migration, /\bip_address\b|\bremote_addr\b/i);
const hardwareMigration = await readFile(new URL("../migrations/0003_hardware_products_and_currencies.sql", import.meta.url), "utf8");
assert.match(hardwareMigration, /CHECK \(currency IN \('USD', 'FCFA', 'COP', 'AUD'\)\)/);
assert.match(hardwareMigration, /'flipper-zero'/);
assert.match(hardwareMigration, /'mackflay-wifi-subghz-v2'/);
assert.match(hardwareMigration, /'wifi-multiboard-esp32-nrf24'/);
checks.push("Database: hardware offers and source currencies are included in migration 0003");
const [html, headers] = await Promise.all([readFile(new URL("../public/index.html", import.meta.url), "utf8"), readFile(new URL("../public/_headers", import.meta.url), "utf8")]);
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, "home page element IDs must be unique");
assert.match(html, /https:\/\/whatsapp\.com\/channel\/0029VbCNp3jLSmbY7A5eue2G/);
checks.push("HTML: page IDs are unique and the WhatsApp channel is linked");
assert.doesNotMatch(html, /<script(?![^>]*\bsrc=)[^>]*>/i, "no inline script");
assert.doesNotMatch(html, /<style[\s>]/i, "no inline style block");
assert.doesNotMatch(headers, /unsafe-inline|unsafe-eval|sha256-/, "CSP must not need inline allowances");
checks.push("CSP: no inline script or style, strict CSP");
console.log(`Security checks passed (${checks.length} checks).`);
for (const name of checks) console.log(`✓ ${name}`);
