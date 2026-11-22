import { errorResponse, json, requireSameOrigin, sessionCookie } from "../../_lib/security.js";

export async function onRequestPost({ request, env }) {
  try {
    requireSameOrigin(request);
    return json({ ok: true }, 200, { "set-cookie": sessionCookie(request, "", 0) });
  } catch (error) { return errorResponse(error, "Déconnexion impossible."); }
}
