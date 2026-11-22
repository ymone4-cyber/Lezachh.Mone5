import { onRequestGet as getHealth } from "./functions/api/health.js";
import { onRequestGet as getSiteData } from "./functions/api/site-data.js";
import { onRequestGet as getBackgroundStyle } from "./functions/api/background-style.js";
import { onRequestPost as postVisit, onRequestDelete as deleteVisit } from "./functions/api/visit.js";
import { onRequestGet as getMedia } from "./functions/api/media/[id].js";
import { onRequestPost as postLogin } from "./functions/api/admin/login.js";
import { onRequestPost as postLogout } from "./functions/api/admin/logout.js";
import { onRequestGet as getProducts, onRequestPost as postProduct, onRequestDelete as deleteProduct } from "./functions/api/admin/products.js";
import { onRequestGet as getAnnouncements, onRequestPost as postAnnouncement, onRequestDelete as deleteAnnouncement } from "./functions/api/admin/announcements.js";
import { onRequestGet as getVisitors } from "./functions/api/admin/visitors.js";
import { onRequestGet as getStats } from "./functions/api/admin/stats.js";
import { onRequestGet as getSettings, onRequestPost as postSettings } from "./functions/api/admin/settings.js";
import { onRequestPost as postUpload } from "./functions/api/admin/upload.js";

const routes = new Map([
  ["GET /api/health", getHealth],
  ["GET /api/site-data", getSiteData],
  ["GET /api/background-style", getBackgroundStyle],
  ["POST /api/visit", postVisit],
  ["DELETE /api/visit", deleteVisit],
  ["POST /api/admin/login", postLogin],
  ["POST /api/admin/logout", postLogout],
  ["GET /api/admin/products", getProducts],
  ["POST /api/admin/products", postProduct],
  ["DELETE /api/admin/products", deleteProduct],
  ["GET /api/admin/announcements", getAnnouncements],
  ["POST /api/admin/announcements", postAnnouncement],
  ["DELETE /api/admin/announcements", deleteAnnouncement],
  ["GET /api/admin/visitors", getVisitors],
  ["GET /api/admin/stats", getStats],
  ["GET /api/admin/settings", getSettings],
  ["POST /api/admin/settings", postSettings],
  ["POST /api/admin/upload", postUpload]
]);

function methodNotAllowed(allowed) {
  return new Response(JSON.stringify({ error: "Méthode non autorisée." }), {
    status: 405,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", allow: allowed.join(", "), "x-content-type-options": "nosniff" }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
    if (path.startsWith("/api/")) {
      const handler = routes.get(`${request.method} ${path}`);
      if (handler) return handler({ request, env, params: {} });
      const mediaMatch = path.match(/^\/api\/media\/([A-Za-z0-9_-]{1,80})$/);
      if (mediaMatch) {
        if (request.method !== "GET") return methodNotAllowed(["GET"]);
        return getMedia({ request, env, params: { id: mediaMatch[1] } });
      }
      const allowed = [...routes.keys()].filter(route => route.endsWith(` ${path}`)).map(route => route.split(" ", 1)[0]);
      if (mediaMatch) allowed.push("GET");
      if (allowed.length) return methodNotAllowed([...new Set(allowed)]);
      return new Response(JSON.stringify({ error: "Route API introuvable." }), {
        status: 404,
        headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" }
      });
    }
    if (!env.ASSETS) return new Response("Service indisponible.", { status: 503, headers: { "cache-control": "no-store" } });
    return env.ASSETS.fetch(request);
  }
};
