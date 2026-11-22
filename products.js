import { dbFor, errorResponse, HttpError, json, newId, optionalHttpUrl, readJson, requireAdmin, requiredText, validId } from "../../_lib/security.js";

const selectProducts = "SELECT id, placement, name, category, description, price, old_price AS oldPrice, currency, external_url AS externalUrl, featured, active, updated_at AS updatedAt FROM products ORDER BY placement, featured DESC, name COLLATE NOCASE";

function productFrom(body) {
  const placement = body.placement;
  if (placement !== "shop" && placement !== "training") throw new HttpError(400, "Emplacement invalide.");
  if (!["USD", "FCFA", "COP", "AUD"].includes(body.currency)) throw new HttpError(400, "Devise invalide.");
  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0 || price > 100000000 || Math.round(price * 100) !== price * 100) throw new HttpError(400, "Prix invalide.");
  const oldPrice = body.oldPrice === "" || body.oldPrice === null || body.oldPrice === undefined ? null : Number(body.oldPrice);
  if (oldPrice !== null && (!Number.isFinite(oldPrice) || oldPrice < price || oldPrice > 100000000 || Math.round(oldPrice * 100) !== oldPrice * 100)) throw new HttpError(400, "Ancien prix invalide.");
  if (typeof body.active !== "boolean" || typeof body.featured !== "boolean") throw new HttpError(400, "État du produit invalide.");
  return {
    id: body.id ? validId(body.id) : newId(), placement,
    name: requiredText(body.name, "Nom", 100),
    category: requiredText(body.category, "Catégorie", 48),
    description: requiredText(body.description, "Description", 800),
    price, oldPrice, currency: body.currency,
    externalUrl: optionalHttpUrl(body.externalUrl), featured: body.featured, active: body.active
  };
}

export async function onRequestGet({ request, env }) {
  try {
    await requireAdmin(request, env);
    const { results = [] } = await dbFor(env).prepare(selectProducts).all();
    return json({ products: results });
  } catch (error) { return errorResponse(error, "Chargement des produits impossible."); }
}

export async function onRequestPost({ request, env }) {
  try {
    await requireAdmin(request, env, true);
    const body = await readJson(request);
    const product = productFrom(body);
    const db = dbFor(env);
    const now = Math.floor(Date.now() / 1000);
    const exists = body.id ? await db.prepare("SELECT id FROM products WHERE id = ?").bind(product.id).first() : null;
    if (body.id && !exists) throw new HttpError(404, "Produit introuvable.");
    if (product.featured) await db.prepare("UPDATE products SET featured = 0 WHERE placement = ? AND id != ?").bind(product.placement, product.id).run();
    const sql = exists
      ? "UPDATE products SET placement=?, name=?, category=?, description=?, price=?, old_price=?, currency=?, external_url=?, featured=?, active=?, updated_at=? WHERE id=?"
      : "INSERT INTO products (placement, name, category, description, price, old_price, currency, external_url, featured, active, updated_at, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    await db.prepare(sql).bind(product.placement, product.name, product.category, product.description, product.price, product.oldPrice, product.currency, product.externalUrl, Number(product.featured), Number(product.active), now, product.id).run();
    return json({ ok: true, id: product.id });
  } catch (error) { return errorResponse(error, "Enregistrement du produit impossible."); }
}

export async function onRequestDelete({ request, env }) {
  try {
    await requireAdmin(request, env, true);
    const { id } = await readJson(request, 4096);
    await dbFor(env).prepare("DELETE FROM products WHERE id = ?").bind(validId(id)).run();
    return json({ ok: true });
  } catch (error) { return errorResponse(error, "Suppression du produit impossible."); }
}
