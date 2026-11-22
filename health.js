const headers = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" };
const REQUIRED_TABLES = [
  "products",
  "announcements",
  "site_settings",
  "visitors",
  "admin_login_attempts",
  "visit_days",
  "daily_views",
  "daily_referrers",
  "media"
];

async function tableReady(db, table) {
  try { await db.prepare(`SELECT 1 FROM ${table} LIMIT 1`).first(); return true; } catch { return false; }
}

export async function onRequestGet({ env }) {
  const checks = {
    database: Boolean(env.DB),
    migrations: false,
    adminUsername: Boolean(env.ADMIN_USERNAME),
    adminPasswordHash: Boolean(env.ADMIN_PASSWORD_HASH),
    sessionSecret: typeof env.ADMIN_SESSION_SECRET === "string" && env.ADMIN_SESSION_SECRET.length >= 32
  };
  if (env.DB) checks.migrations = (await Promise.all(REQUIRED_TABLES.map(table => tableReady(env.DB, table)))).every(Boolean);
  const ok = Object.values(checks).every(Boolean);
  return new Response(JSON.stringify({ status: ok ? "ok" : "setup-required", service: "LeZachh", checks }), { headers });
}
