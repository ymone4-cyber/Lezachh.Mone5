import { dbFor, errorResponse, HttpError, json, newId, optionalHttpUrl, readJson, requireAdmin, requiredText, validId } from "../../_lib/security.js";

export async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    const { results = [] } = await dbFor(env).prepare("SELECT id, title, message, external_url AS externalUrl, active, created_at AS createdAt, updated_at AS updatedAt FROM announcements ORDER BY updated_at DESC").all();
    return json({ announcements: results });
  } catch (error) { return errorResponse(error, "Chargement des annonces impossible."); }
}

export async function onRequestPost({ request, env }) {
  try {
    await requireAdmin(request, env, true);
    const body = await readJson(request);
    const id = body.id ? validId(body.id) : newId();
    const title = requiredText(body.title, "Titre", 100);
    const message = requiredText(body.message, "Message", 1200);
    const externalUrl = optionalHttpUrl(body.externalUrl);
    if (typeof body.active !== "boolean") throw new HttpError(400, "État de l’annonce invalide.");
    const db = dbFor(env);
    const exists = body.id ? await db.prepare("SELECT id FROM announcements WHERE id = ?").bind(id).first() : null;
    if (body.id && !exists) throw new HttpError(404, "Annonce introuvable.");
    const now = Math.floor(Date.now() / 1000);
    if (exists) {
      await db.prepare("UPDATE announcements SET title=?, message=?, external_url=?, active=?, updated_at=? WHERE id=?").bind(title, message, externalUrl, Number(body.active), now, id).run();
    } else {
      await db.prepare("INSERT INTO announcements (id, title, message, external_url, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, title, message, externalUrl, Number(body.active), now, now).run();
    }
    return json({ ok: true, id });
  } catch (error) { return errorResponse(error, "Enregistrement de l’annonce impossible."); }
}

export async function onRequestDelete({ request, env }) {
  try {
    await requireAdmin(request, env, true);
    const { id } = await readJson(request, 4096);
    await dbFor(env).prepare("DELETE FROM announcements WHERE id = ?").bind(validId(id)).run();
    return json({ ok: true });
  } catch (error) { return errorResponse(error, "Suppression de l’annonce impossible."); }
}
