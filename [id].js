import { dbFor, errorResponse, validId, HttpError } from "../../_lib/security.js";

export async function onRequestGet({ params, env }) {
  try {
    const row = await dbFor(env).prepare("SELECT mime, data FROM media WHERE id = ?").bind(validId(params.id)).first();
    if (!row) throw new HttpError(404, "Image introuvable.");
    const bytes = Uint8Array.from(atob(row.data), c => c.charCodeAt(0));
    return new Response(bytes, { headers: { "content-type": row.mime, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff", "cross-origin-resource-policy": "same-origin", "content-security-policy": "default-src 'none'" } });
  } catch (error) { return errorResponse(error, "Image indisponible."); }
}
