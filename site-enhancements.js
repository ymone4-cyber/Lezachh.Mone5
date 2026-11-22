(() => {
  "use strict";
  const $ = selector => document.querySelector(selector);
  const fallbackContact = "https://linktr.ee/LeZachh01";
  const productImages = {
    "flipper-zero": { src: "/assets/flipper-zero.png", alt: "Flipper Zero présenté dans sa boîte" },
    "mackflay-wifi-subghz-v2": { src: "/assets/flipper-wifi-subghz-closeup.jpg", alt: "Carte Wi-Fi et Sub-GHz avec antennes pour Flipper Zero" },
    "wifi-multiboard-esp32-nrf24": { src: "/assets/esp32-multiboard-v2.png", alt: "Carte ESP32 Multi Board pour Flipper Zero" }
  };

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function safeLink(value) {
    if (typeof value !== "string" || !value || value.length > 2048 || /[\u0000-\u0020\\]/.test(value)) return "";
    if (value.startsWith("/") && !value.startsWith("//")) return value;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
    } catch { return ""; }
  }
  function price(value, currency) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "Prix à confirmer";
    if (currency === "FCFA") return amount.toLocaleString("fr-FR", { maximumFractionDigits: 0 }) + " FCFA";
    const labels = { USD: "$US", AUD: "$AU", COP: "COP" };
    const decimals = currency === "COP" ? 0 : amount % 1 ? 2 : 0;
    return amount.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + " " + (labels[currency] || currency);
  }
  function appendProductImage(host, item, featured = false) {
    const image = productImages[item.id];
    if (!image) return;
    const photo = element("img", "shop-product-image");
    photo.src = image.src; photo.alt = image.alt; photo.loading = "lazy"; photo.decoding = "async";
    if (featured) photo.classList.add("shop-product-image-featured");
    host.append(photo);
  }
  function attachLink(link, item, label) {
    const destination = safeLink(item.externalUrl) || fallbackContact;
    link.href = destination;
    if (/^https:\/\//.test(destination)) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
    link.append(document.createTextNode(label + " "));
    const arrow = element("span", "", "↗"); arrow.setAttribute("aria-hidden", "true"); link.append(arrow);
  }
  function priceBlock(item, featured = false) {
    const block = element("div", "shop-price");
    const current = element("strong", "", price(item.price, item.currency)); block.append(current);
    const old = Number(item.oldPrice);
    if (Number.isFinite(old) && old > Number(item.price)) block.append(element("s", "", price(old, item.currency)));
    if (featured) block.classList.add("shop-price-featured");
    return block;
  }
  function renderFeatured(host, item) {
    host.replaceChildren();
    if (!item) { host.hidden = true; return; }
    host.hidden = false;
    const copy = element("div"), badge = element("span", "badge", item.category || "OFFRE À LA UNE"), title = element("h3", "", item.name), desc = element("p", "", item.description);
    title.id = "featTitle";
    appendProductImage(copy, item, true);
    copy.append(badge, title, desc);
    const buy = element("div", "shop-buy");
    buy.append(priceBlock(item, true));
    const button = element("a", "button button-primary"); attachLink(button, item, "Découvrir l’offre");
    buy.append(button);
    host.setAttribute("aria-labelledby", "featTitle"); host.append(copy, buy);
  }
  function renderShopCard(item, index) {
    const card = element("article", "shop-card"), top = element("div", "card-top"), category = element("span", "", item.category || "CYBERSÉCURITÉ"), number = element("span", "card-index", String(index + 1).padStart(2, "0"));
    appendProductImage(card, item);
    top.append(category, number);
    card.append(top, element("h3", "", item.name), element("p", "", item.description), priceBlock(item));
    const button = element("a", "button button-outline"); attachLink(button, item, "Voir l’offre"); card.append(button);
    return card;
  }
  function renderProducts(products) {
    const items = Array.isArray(products) ? products : [];
    const shop = items.filter(item => item.placement === "shop"), training = items.find(item => item.placement === "training");
    const featured = shop.find(item => Boolean(item.featured)) || shop[0] || null;
    renderFeatured($("#featuredProduct"), featured);
    const grid = $("#productGrid"); grid.replaceChildren();
    shop.filter(item => item.id !== featured?.id).forEach((item, index) => grid.append(renderShopCard(item, index + 1)));
    if (!featured && !shop.length) grid.append(element("p", "shop-note", "Aucun produit n’est disponible pour le moment."));
    const trainingCard = $(".training-card");
    if (trainingCard) {
      trainingCard.hidden = !training;
      if (training) {
        $("#trainingProductName").textContent = training.name;
        $("#trainingProductDescription").textContent = training.description;
        $("#trainingProductPrice").textContent = price(training.price, training.currency);
        const link = $("#trainingProductLink"); link.replaceChildren(); attachLink(link, training, "Poser une question");
      }
    }
    const guides = shop.filter(item => item.currency === "USD" && Number(item.oldPrice) > Number(item.price)).map(item => ({
      name: item.name, short: String(item.category || item.name).replace(/[<>]/g, "").slice(0, 16), old: Number(item.oldPrice), now: Number(item.price)
    }));
    if (typeof window.leZachhUpdateGuides === "function") window.leZachhUpdateGuides(guides, training, shop.length);
  }
  function renderAnnouncements(items) {
    const host = $("#announcements"); host.replaceChildren();
    const list = Array.isArray(items) ? items : [];
    host.hidden = list.length === 0;
    if (!list.length) return;
    const heading = element("h2", "eyebrow", "ANNONCES RÉCENTES");
    heading.id = "announcementSectionTitle"; host.setAttribute("aria-labelledby", heading.id); host.append(heading);
    list.forEach(item => {
      const card = element("article", "announcement-card"), mark = element("span", "announcement-mark", "!"), body = element("div"); mark.setAttribute("aria-hidden", "true");
      body.append(element("h3", "", item.title), element("p", "", item.message)); card.append(mark, body);
      const destination = safeLink(item.externalUrl);
      if (destination) {
        const link = element("a", "button button-outline", "En savoir plus ↗"); link.href = destination;
        if (destination.startsWith("https://")) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
        card.append(link);
      }
      host.append(card);
    });
  }
  function loadBackgroundStylesheet() {
    if (document.querySelector("#adminBackgroundStylesheet")) return;
    const link = document.createElement("link");
    link.id = "adminBackgroundStylesheet"; link.rel = "stylesheet"; link.href = "/api/background-style";
    document.head.append(link);
  }
  async function loadContent() {
    try {
      const response = await fetch("/api/site-data", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      renderProducts(data.products);
      renderAnnouncements(data.announcements);
      loadBackgroundStylesheet();
      if (typeof window.leZachhRefreshSearch === "function") window.leZachhRefreshSearch();
    } catch { /* Le contenu de secours reste visible si l’API est temporairement indisponible. */ }
  }

  const consentKey = "lezachh-audience-consent-v1";
  const banner = $("#privacyBanner");
  let volatileConsent = "";
  function readConsent() { try { return localStorage.getItem(consentKey) || volatileConsent; } catch { return volatileConsent; } }
  function setConsent(value) { volatileConsent = value; try { localStorage.setItem(consentKey, value); } catch {} }
  async function recordVisit() {
    try {
      await fetch("/api/visit", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: JSON.stringify({ path: location.pathname }) });
    } catch { /* Statistiques non bloquantes. */ }
  }
  async function revokeVisit() {
    try { await fetch("/api/visit", { method: "DELETE", credentials: "same-origin" }); } catch { /* Le refus reste enregistré dans le navigateur. */ }
  }
  function updateConsentUI() {
    banner.hidden = Boolean(readConsent());
  }
  $("#privacyAccept").addEventListener("click", () => { setConsent("accepted"); updateConsentUI(); recordVisit(); });
  $("#privacyDecline").addEventListener("click", () => { setConsent("declined"); updateConsentUI(); revokeVisit(); });
  $("#privacyManage").addEventListener("click", () => { volatileConsent = ""; try { localStorage.removeItem(consentKey); } catch {} updateConsentUI(); });
  if (readConsent() === "accepted") recordVisit(); else updateConsentUI();
  loadContent();
})();
