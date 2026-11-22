import { dbFor, errorResponse, hashClientKey, HttpError, issueSession, json, readJson, requireSameOrigin, sessionCookie, verifyPassword } from "../../_lib/security.js";

export async function onRequestPost({ request, env }) {
  try {
    requireSameOrigin(request);
    const body = await readJson(request, 4096);
    const username = typeof body.username === "string" ? body.username : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (username.length > 120 || password.length > 1024) throw new HttpError(400, "Identifiants invalides.");
    if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD_HASH || !env.ADMIN_SESSION_SECRET) throw new HttpError(503, "L’accès administrateur n’est pas configuré.");
    const db = dbFor(env);
    const clientHash = await hashClientKey(request, env);
    const now = Math.floor(Date.now() / 1000);
    await db.prepare("DELETE FROM admin_login_attempts WHERE created_at < ?").bind(now - 900).run();
    const recent = await db.prepare("SELECT COUNT(*) AS total FROM admin_login_attempts WHERE client_hash = ? AND created_at > ?").bind(clientHash, now - 900).first();
    if (Number(recent?.total || 0) >= 6) return json({ error: "Trop de tentatives. Réessayez dans 15 minutes." }, 429);
    const validUser = username === env.ADMIN_USERNAME;
    const validPassword = await verifyPassword(password, env.ADMIN_PASSWORD_HASH);
    if (!validUser || !validPassword) {
      await db.prepare("INSERT INTO admin_login_attempts (client_hash, created_at) VALUES (?, ?)").bind(clientHash, now).run();
      return json({ error: "Identifiants incorrects." }, 401);
    }
    await db.prepare("DELETE FROM admin_login_attempts WHERE client_hash = ?").bind(clientHash).run();
    const token = await issueSession(env, env.ADMIN_USERNAME);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(request, token) });
  } catch (error) { return errorResponse(error, "Connexion impossible."); }
}
