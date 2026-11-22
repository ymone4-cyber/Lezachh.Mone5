import { dbFor, errorResponse, json, requireAdmin } from "../../_lib/security.js";

const dayOffset = n => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

export async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    const db = dbFor(env);
    const d1 = dayOffset(0), d7 = dayOffset(6), d30 = dayOffset(29);
    const count = async (sql, ...args) => Number((await db.prepare(sql).bind(...args).first())?.n || 0);
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
    const v = new Map((series.results || []).map(r => [r.day, Number(r.views)]));
    const u = new Map((uniques.results || []).map(r => [r.day, Number(r.visitors)]));
    const days = Array.from({ length: 14 }, (_, i) => dayOffset(13 - i)).map(day => ({ day, views: v.get(day) || 0, visitors: u.get(day) || 0 }));
    return json({ visitors: { today, week, month, total }, views: { today: viewsToday, week: viewsWeek, month: viewsMonth }, days, pages: pages.results || [], referrers: referrers.results || [] });
  } catch (error) { return errorResponse(error, "Chargement des statistiques impossible."); }
}
