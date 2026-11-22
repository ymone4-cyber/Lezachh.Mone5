import { dbFor, errorResponse, HttpError, json, newId, requireAdmin } from "../../_lib/security.js";

const MAX_BYTES = 1200000;
function detect(b) {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "image/webp";
  return "";
}
export async function onRequestPost({ request, env }) {
  try {
    await requireAdmin(request, env, true);
    if (Number(request.headers.get("content-length") || 0) > MAX_BYTES) throw new HttpError(413, "Image trop lourde (1,2 Mo maximum).");
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (!bytes.length || bytes.length > MAX_BYTES) throw new HttpError(413, "Image trop lourde (1,2 Mo maximum).");
    const mime = detect(bytes);
    if (!mime) throw new HttpError(415, "Formats acceptés : JPG, PNG ou WebP.");
    let binary = "";
    for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    const id = newId(), db = dbFor(env);
    await db.prepare("INSERT INTO media (id, mime, data, created_at) VALUES (?, ?, ?, ?)").bind(id, mime, btoa(binary), Math.floor(Date.now() / 1000)).run();
    await db.prepare("DELETE FROM media WHERE id NOT IN (SELECT id FROM media ORDER BY created_at DESC LIMIT 8)").run();
    return json({ ok: true, url: "/api/media/" + id });
  } catch (error) { return errorResponse(error, "Envoi de l’image impossible."); }
}
