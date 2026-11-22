import { dbFor, errorResponse, json, requireAdmin } from "../../_lib/security.js";

export async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    const { results = [] } = await dbFor(env).prepare("SELECT visitor_id AS visitorId, first_seen AS firstSeen, last_seen AS lastSeen, view_count AS viewCount, last_page AS lastPage, referrer_domain AS referrerDomain FROM visitors ORDER BY last_seen DESC LIMIT 200").all();
    return json({ visitors: results });
  } catch (error) { return errorResponse(error, "Chargement des visites impossible."); }
}
