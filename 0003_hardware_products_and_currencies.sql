-- Keep the seller's original currency so prices are not confused with
-- exchange-rate estimates. Existing product records are copied unchanged.
ALTER TABLE products RENAME TO products_before_currency_expansion;

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  placement TEXT NOT NULL CHECK (placement IN ('shop', 'training')),
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'CYBERSÉCURITÉ',
  description TEXT NOT NULL,
  price REAL NOT NULL CHECK (price >= 0),
  old_price REAL,
  currency TEXT NOT NULL CHECK (currency IN ('USD', 'FCFA', 'COP', 'AUD')),
  external_url TEXT NOT NULL DEFAULT '',
  featured INTEGER NOT NULL DEFAULT 0 CHECK (featured IN (0, 1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  updated_at INTEGER NOT NULL
);

INSERT INTO products
  (id, placement, name, category, description, price, old_price, currency, external_url, featured, active, updated_at)
SELECT id, placement, name, category, description, price, old_price, currency, external_url, featured, active, updated_at
FROM products_before_currency_expansion;

DROP TABLE products_before_currency_expansion;

INSERT OR IGNORE INTO products
  (id, placement, name, category, description, price, old_price, currency, external_url, featured, active, updated_at)
VALUES
  ('flipper-zero', 'shop', 'Flipper Zero', 'MULTI-OUTIL DE SÉCURITÉ', 'Appareil portable multifonction. Prix fabricant relevé à 169 $US le 21 novembre 2026 ; carte microSD vendue séparément. Vérifie la disponibilité et les conditions de livraison sur la boutique officielle.', 169, NULL, 'USD', 'https://flipper.net/products/flipper-zero', 0, 1, unixepoch()),
  ('mackflay-wifi-subghz-v2', 'shop', 'Carte Wi-Fi & Sub-GHz Mackflay v2', 'ACCESSOIRE FLIPPER ZERO', 'Carte d’extension avec antennes, vendue séparément du Flipper Zero. Prix affiché par le revendeur : 300 000 COP (prix barré 340 000 COP) au 21 novembre 2026 ; transport et éventuels frais d’importation en plus. Vérifie la variante et le contenu du colis avant achat.', 300000, 340000, 'COP', 'https://tiendahacking.com/products/wifi-sub-ghz-dev-board-by-mackflay-v-2-0-con-accesorios', 0, 1, unixepoch()),
  ('wifi-multiboard-esp32-nrf24', 'shop', 'Carte Multi Board Wi-Fi ESP32 + NRF24', 'ACCESSOIRE FLIPPER ZERO', 'Référence comparable à la carte montrée. Le revendeur affiche 80 $AU ; la variante consultée était indiquée épuisée le 21 novembre 2026. Vérifie la version, les options (carte seule ou boîtier) et la disponibilité avant achat. Flipper Zero non inclus.', 80, NULL, 'AUD', 'https://honeyhoneylab.com/products/flipper-zero-2in1-wifi-multi-board-esp32-nrf24', 0, 1, unixepoch());
