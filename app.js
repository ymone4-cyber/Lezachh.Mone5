    (() => {
      "use strict";
      const menuToggle = document.querySelector("#menuToggle");
      const mainNav = document.querySelector("#mainNav");
      const filterContainer = document.querySelector("#contentFilters");
      const cards = Array.from(document.querySelectorAll(".content-card"));
      const count = document.querySelector("#contentCount");
      const toTop = document.querySelector("#toTop");

      menuToggle.addEventListener("click", () => {
        const open = menuToggle.getAttribute("aria-expanded") !== "true";
        menuToggle.setAttribute("aria-expanded", String(open));
        menuToggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
        mainNav.classList.toggle("is-open", open);
      });

      mainNav.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
        menuToggle.setAttribute("aria-expanded", "false");
        menuToggle.setAttribute("aria-label", "Ouvrir le menu");
        mainNav.classList.remove("is-open");
      }));

      filterContainer.addEventListener("click", event => {
        const button = event.target.closest("[data-filter]");
        if (!button) return;
        const filter = button.dataset.filter;
        filterContainer.querySelectorAll("[data-filter]").forEach(item => {
          item.setAttribute("aria-pressed", String(item === button));
        });
        let visible = 0;
        cards.forEach(card => {
          const show = filter === "all" || card.dataset.category === filter;
          card.hidden = !show;
          if (show) visible += 1;
        });
        count.textContent = String(visible);
      });

      document.querySelector("#year").textContent = String(new Date().getFullYear());
      const updateTopButton = () => toTop.classList.toggle("is-visible", window.scrollY > 520);
      window.addEventListener("scroll", updateTopButton, { passive: true });
      updateTopButton();

      /* ===== v4 : tableau de bord, dock, recherche ===== */
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const NS = "http://www.w3.org/2000/svg";
      const ICONS = {
        folder: '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
        trend: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
        users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
        dollar: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
      };

      // Données du tableau de bord : à modifier ici si les prix changent.
      let guides = [
        { name: "Le guide du djaiii", short: "Djaiii", old: 34.28, now: 20.5 },
        { name: "Ne te fais plus pirater ni arnaquer", short: "Anti-arnaque", old: 10.17, now: 6.19 },
        { name: "Piratage & Sécurité Wi-Fi", short: "Wi-Fi", old: 27.39, now: 10.17 },
        { name: "Dark Web & Anonymat", short: "Dark Web", old: 20.5, now: 10.17 }
      ];
      const pct = g => Math.round((1 - g.now / g.old) * 100);
      const usd = n => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) + " $US";
      const best = guides.slice().sort((a, b) => pct(b) - pct(a))[0];
      const averageDiscount = Math.round(guides.reduce((sum, guide) => sum + pct(guide), 0) / Math.max(1, guides.length));
      const totalSavings = Number(guides.reduce((sum, guide) => sum + guide.old - guide.now, 0).toFixed(2));
      let stats = [
        { title: "Offres en boutique", value: guides.length + 3, suffix: "offres", icon: "folder", change: "PDF & matériel" },
        { title: "Réduction moyenne", value: averageDiscount, suffix: "%", icon: "trend", change: "Guides en promotion" },
        { title: "Économie cumulée", value: totalSavings, suffix: "$US", icon: "dollar", change: "Si tu prends tous les guides" },
        { title: "Tarif de la formation", value: 50000, suffix: "FCFA", icon: "users", change: "À confirmer" }
      ];

      const mk = (tag, attrs, parent) => {
        const n = document.createElementNS(NS, tag);
        for (const k in attrs) n.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(n);
        return n;
      };

      function countUp(node, target) {
        const precision = Number.isInteger(target) ? 0 : 2;
        const format = value => value.toLocaleString("fr-FR", { minimumFractionDigits: precision, maximumFractionDigits: precision });
        if (reduceMotion) { node.textContent = format(target); return; }
        const t0 = performance.now(), dur = 1300;
        const step = t => {
          const k = Math.min(1, (t - t0) / dur);
          node.textContent = format(target * (1 - Math.pow(1 - k, 3)));
          if (k < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }

      function renderStats() {
        const grid = document.querySelector("#statGrid");
        if (!grid) return;
        const nums = [];
        stats.forEach(st => {
          const card = document.createElement("article");
          card.className = "stat-card";
          const top = document.createElement("div");
          top.className = "stat-top";
          const ico = document.createElement("span");
          ico.className = "stat-ico";
          ico.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[st.icon] + "</svg>";
          const badge = document.createElement("span");
          badge.className = "stat-badge";
          badge.textContent = st.change;
          top.append(ico, badge);
          const val = document.createElement("div");
          val.className = "stat-value";
          const num = document.createElement("span");
          num.textContent = st.value.toLocaleString("fr-FR");
          val.append(num);
          if (st.suffix) { const sm = document.createElement("small"); sm.textContent = st.suffix; val.append(sm); }
          const title = document.createElement("div");
          title.className = "stat-title";
          title.textContent = st.title;
          card.append(top, val, title);
          grid.append(card);
          nums.push([num, st.value]);
        });
        if (!("IntersectionObserver" in window) || reduceMotion) return;
        nums.forEach(([n]) => { n.textContent = "0"; });
        const io = new IntersectionObserver(entries => {
          if (!entries[0].isIntersecting) return;
          io.disconnect();
          nums.forEach(([n, v]) => countUp(n, v));
        }, { threshold: .35 });
        io.observe(grid);
      }

      function renderBars() {
        const list = document.querySelector("#discountBars");
        if (!list) return;
        const fills = [];
        guides.slice().sort((a, b) => pct(b) - pct(a)).forEach(g => {
          const li = document.createElement("li");
          const top = document.createElement("div");
          top.className = "bar-top";
          const name = document.createElement("span");
          name.textContent = g.name;
          const val = document.createElement("strong");
          val.textContent = "−" + pct(g) + "%";
          top.append(name, val);
          const track = document.createElement("div");
          track.className = "bar-track";
          const fill = document.createElement("div");
          fill.className = "bar-fill";
          track.append(fill);
          li.append(top, track);
          list.append(li);
          fills.push([fill, pct(g)]);
        });
        const go = () => fills.forEach(([f, v]) => { f.style.width = v + "%"; });
        if (!("IntersectionObserver" in window) || reduceMotion) { go(); return; }
        const io = new IntersectionObserver(entries => {
          if (entries[0].isIntersecting) { io.disconnect(); go(); }
        }, { threshold: .3 });
        io.observe(list);
      }

      let chartWidth = 0;
      function buildChart() {
        const host = document.querySelector("#priceChart");
        if (!host) return;
        if (!guides.length) { host.replaceChildren(); chartWidth = 0; return; }
        const W = Math.max(280, Math.round(host.clientWidth));
        if (W === chartWidth) return;
        chartWidth = W;
        host.querySelectorAll("svg, .chart-tip").forEach(n => n.remove());
        const H = W < 480 ? 250 : 300, L = 44, R = 16, T = 16, B = 38;
        const max = Math.ceil(Math.max(...guides.map(g => g.old)) / 10) * 10;
        const iw = W - L - R, ih = H - T - B, step = iw / guides.length;
        const x = i => L + step * (i + .5), y = v => T + ih - (v / max) * ih;
        const svg = mk("svg", { viewBox: "0 0 " + W + " " + H, class: "chart-svg", role: "group", "aria-label": "Courbes des prix habituels et actuels des guides" }, host);
        const defs = mk("defs", {}, svg);
        const grad = mk("linearGradient", { id: "areaGrad", x1: "0", y1: "0", x2: "0", y2: "1" }, defs);
        mk("stop", { offset: "0", "stop-color": "#ff6a35", "stop-opacity": ".32" }, grad);
        mk("stop", { offset: "1", "stop-color": "#ff6a35", "stop-opacity": "0" }, grad);
        for (let t = 0; t <= 4; t++) {
          const v = max / 4 * t;
          mk("line", { class: "grid", x1: L, x2: W - R, y1: y(v), y2: y(v) }, svg);
          const lab = mk("text", { x: L - 8, y: y(v) + 4, "text-anchor": "end" }, svg);
          lab.textContent = "$" + Math.round(v);
        }
        guides.forEach((g, i) => {
          const lab = mk("text", { x: x(i), y: H - 12, "text-anchor": "middle" }, svg);
          lab.textContent = g.short;
        });
        const path = key => guides.map((g, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(g[key]).toFixed(1)).join(" ");
        mk("path", { class: "area", d: path("now") + " L" + x(guides.length - 1).toFixed(1) + " " + y(0) + " L" + x(0).toFixed(1) + " " + y(0) + " Z", fill: "url(#areaGrad)" }, svg);
        mk("path", { class: "line-old", d: path("old") }, svg);
        mk("path", { class: "line", d: path("now"), pathLength: "1" }, svg);
        const guideLine = mk("line", { class: "guide", y1: T, y2: T + ih }, svg);
        const dots = guides.map((g, i) => {
          mk("circle", { class: "dot-old", cx: x(i), cy: y(g.old), r: 3.5 }, svg);
          return mk("circle", { class: "dot", cx: x(i), cy: y(g.now), r: 5 }, svg);
        });
        const tip = document.createElement("div");
        tip.className = "chart-tip";
        host.append(tip);
        const show = i => {
          const g = guides[i];
          tip.replaceChildren();
          const b = document.createElement("b");
          b.textContent = g.name;
          tip.append(b);
          [["Prix habituel", usd(g.old), ""], ["Prix actuel", usd(g.now), "now"], ["Réduction", "−" + pct(g) + "%", ""]].forEach(([k, v, c]) => {
            const row = document.createElement("span");
            if (c) row.className = c;
            const kk = document.createTextNode(k);
            const em = document.createElement("em");
            em.textContent = v;
            row.append(kk, em);
            tip.append(row);
          });
          const half = 80;
          tip.style.left = Math.min(W - half, Math.max(half, x(i))) + "px";
          tip.style.top = y(g.now) + "px";
          tip.classList.add("is-on");
          guideLine.setAttribute("x1", x(i)); guideLine.setAttribute("x2", x(i));
          guideLine.style.opacity = "1";
          dots.forEach((d, k) => d.setAttribute("r", k === i ? 7 : 5));
        };
        const hide = () => {
          tip.classList.remove("is-on");
          guideLine.style.opacity = "0";
          dots.forEach(d => d.setAttribute("r", 5));
        };
        guides.forEach((g, i) => {
          const hit = mk("rect", { class: "hit", x: L + step * i, y: T, width: step, height: ih, tabindex: "0", role: "img", "aria-label": g.name + " : " + usd(g.now) + " au lieu de " + usd(g.old) + ", réduction de " + pct(g) + " %" }, svg);
          hit.addEventListener("pointerenter", () => show(i));
          hit.addEventListener("pointerdown", () => show(i));
          hit.addEventListener("focus", () => show(i));
          hit.addEventListener("pointerleave", hide);
          hit.addEventListener("blur", hide);
        });
      }

      function observeChart() {
        const host = document.querySelector("#priceChart");
        if (!host) return;
        if (!("IntersectionObserver" in window) || reduceMotion) { host.classList.add("is-in"); return; }
        const io = new IntersectionObserver(entries => {
          if (entries[0].isIntersecting) { host.classList.add("is-in"); io.disconnect(); }
        }, { threshold: .3 });
        io.observe(host);
      }

      window.leZachhUpdateGuides = (next, trainingProduct, shopCount) => {
        guides = Array.isArray(next) ? next : [];
        const best = guides.length ? guides.slice().sort((a, b) => pct(b) - pct(a))[0] : null;
        const averageDiscount = guides.length ? Math.round(guides.reduce((sum, guide) => sum + pct(guide), 0) / guides.length) : 0;
        const totalSavings = Number(guides.reduce((sum, guide) => sum + guide.old - guide.now, 0).toFixed(2));
        stats = [
          { title: "Offres en boutique", value: Number.isFinite(shopCount) ? shopCount : guides.length, suffix: "offres", icon: "folder", change: "PDF & matériel" },
          { title: "Réduction moyenne", value: averageDiscount, suffix: "%", icon: "trend", change: best ? "Guides en promotion" : "Aucune promotion" },
          { title: "Économie cumulée", value: totalSavings, suffix: "$US", icon: "dollar", change: "Si tu prends tous les guides" },
          { title: "Tarif de la formation", value: trainingProduct ? Number(trainingProduct.price) : 0, suffix: trainingProduct ? trainingProduct.currency : "FCFA", icon: "dollar", change: trainingProduct ? "À confirmer" : "À venir" }
        ];
        document.querySelector("#statGrid")?.replaceChildren();
        document.querySelector("#discountBars")?.replaceChildren();
        chartWidth = 0;
        renderStats(); renderBars(); buildChart();
      };

      renderStats();
      renderBars();
      buildChart();
      observeChart();
      let resizeTimer;
      window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(buildChart, 150); });

      /* ----- Dock : indicateur lumineux + section active ----- */
      const dockInd = document.querySelector(".dock-ind");
      const dockItems = Array.from(document.querySelectorAll(".dock-item"));
      const spyMap = [["accueil", 0], ["apropos", 0], ["contenus", 0], ["boutique", 1], ["chiffres", 1], ["formation", 3], ["contact", 4], ["faq", 4]];
      let searchOpen = false;
      function setDock(index) {
        dockInd.style.setProperty("--i", String(index));
        dockItems.forEach((item, k) => item.setAttribute("aria-current", String(k === index)));
      }
      function updateDock() {
        if (searchOpen) return;
        let idx = 0;
        const line = window.innerHeight * .45;
        for (const [id, i] of spyMap) {
          const node = document.getElementById(id);
          if (node && node.getBoundingClientRect().top <= line) idx = i;
        }
        setDock(idx);
      }
      window.addEventListener("scroll", updateDock, { passive: true });
      window.addEventListener("resize", updateDock);
      updateDock();

      /* ----- Recherche ----- */
      const overlay = document.querySelector("#searchOverlay");
      const input = document.querySelector("#searchInput");
      const resultsEl = document.querySelector("#searchResults");
      const clearBtn = document.querySelector("#searchClear");
      const norm = str => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[-'’]/g, "");
      const txt = (root, sel) => { const n = root.querySelector(sel); return n ? n.textContent.trim() : ""; };
      let index = [], current = [], sel = 0, lastFocus = null;

      function buildIndex() {
        index = [];
        [
          ["Accueil", "Comprendre le numérique, apprendre à le protéger : cyber, hacking éthique, tech", "#accueil"],
          ["À propos", "Qui est LeZachh : la cybersécurité à hauteur humaine", "#apropos"],
          ["Les contenus", "Actualité cyber, conseils, démonstrations et sensibilisation", "#contenus"],
          ["Boutique", "Les guides PDF de LeZachh : Wi-Fi, dark web, anti-arnaque, djaiii", "#boutique"],
          ["Tableau de bord", "Chiffres clés, prix des guides et réductions", "#chiffres"],
          ["Formation", "Formation cybersécurité et hacking éthique, " + txt(document, "#trainingProductPrice") + ", 10 places", "#formation"],
          ["Contact", "Écrire à LeZachh via Linktree, @le_zachh01", "#contact"],
          ["Questions fréquentes", "FAQ : hacking éthique, formation, achat d’un guide", "#faq"]
        ].forEach(([title, text, q]) => index.push({ group: "Page", title, text, target: document.querySelector(q), page: true }));
        document.querySelectorAll(".content-card").forEach(c => index.push({ group: "Contenu", title: txt(c, "h3"), text: txt(c, "p") + " " + txt(c, ".card-tag"), target: c }));
        const feat = document.querySelector(".shop-featured");
        if (feat) index.push({ group: "Boutique", title: txt(feat, "h3"), text: txt(feat, "p") + " " + txt(feat, ".shop-price strong"), target: feat });
        document.querySelectorAll(".shop-card").forEach(c => index.push({ group: "Boutique", title: txt(c, "h3"), text: txt(c, "p") + " " + txt(c, ".shop-price strong"), target: c }));
        document.querySelectorAll(".announcement-card").forEach(c => index.push({ group: "Annonce", title: txt(c, "h3"), text: txt(c, "p"), target: c }));
        document.querySelectorAll(".faq-item").forEach(d => index.push({ group: "FAQ", title: txt(d, "summary"), text: txt(d, ".faq-answer"), target: d }));
      }
      window.leZachhRefreshSearch = buildIndex;

      function runSearch(q) {
        const tokens = norm(q).split(/\s+/).filter(Boolean);
        if (!tokens.length) {
          current = index.filter(i => i.page);
        } else {
          current = index.map(i => {
            const t = norm(i.title), h = norm(i.title + " " + i.text);
            if (!tokens.every(k => h.includes(k))) return null;
            let score = i.page ? 1 : 0;
            tokens.forEach(k => { score += t.includes(k) ? 3 : 1; });
            return [i, score];
          }).filter(Boolean).sort((a, b) => b[1] - a[1]).map(o => o[0]).slice(0, 12);
        }
        sel = 0;
        renderResults(q);
      }

      function renderResults(q) {
        resultsEl.replaceChildren();
        if (!current.length) {
          const li = document.createElement("li");
          li.className = "sr-empty";
          li.textContent = "Aucun résultat pour « " + q.trim() + " ». Essayez « Wi-Fi », « phishing » ou « formation ».";
          resultsEl.append(li);
          input.removeAttribute("aria-activedescendant");
          return;
        }
        if (!q.trim()) {
          const lab = document.createElement("li");
          lab.className = "search-label";
          lab.setAttribute("role", "presentation");
          lab.textContent = "ALLER À";
          resultsEl.append(lab);
        }
        current.forEach((item, k) => {
          const li = document.createElement("li");
          li.className = "sr-item";
          li.id = "sr-" + k;
          li.setAttribute("role", "option");
          li.setAttribute("aria-selected", String(k === sel));
          const g = document.createElement("span");
          g.className = "sr-group";
          g.textContent = item.group;
          const t = document.createElement("span");
          t.className = "sr-title";
          t.textContent = item.title;
          const d = document.createElement("span");
          d.className = "sr-text";
          d.textContent = item.text;
          li.append(g, t, d);
          li.addEventListener("pointermove", () => { if (sel !== k) { sel = k; paintSel(false); } });
          li.addEventListener("click", () => choose(k));
          resultsEl.append(li);
        });
        input.setAttribute("aria-activedescendant", "sr-" + sel);
      }

      function paintSel(scroll) {
        resultsEl.querySelectorAll(".sr-item").forEach((li, k) => {
          li.setAttribute("aria-selected", String(k === sel));
          if (k === sel && scroll) li.scrollIntoView({ block: "nearest" });
        });
        input.setAttribute("aria-activedescendant", "sr-" + sel);
      }

      function openSearch() {
        if (searchOpen) return;
        searchOpen = true;
        lastFocus = document.activeElement;
        if (!index.length) buildIndex();
        overlay.hidden = false;
        document.documentElement.classList.add("no-scroll");
        setDock(2);
        input.value = "";
        runSearch("");
        input.focus();
      }
      function closeSearch() {
        if (!searchOpen) return;
        searchOpen = false;
        overlay.hidden = true;
        document.documentElement.classList.remove("no-scroll");
        updateDock();
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }
      function choose(k) {
        const item = current[k];
        if (!item || !item.target) return;
        closeSearch();
        const node = item.target;
        if (node.hidden) {
          const all = document.querySelector('[data-filter="all"]');
          if (all) all.click();
        }
        if (node.tagName === "DETAILS") node.open = true;
        setTimeout(() => {
          node.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: item.page ? "start" : "center" });
          if (!item.page) {
            node.classList.remove("flash");
            void node.offsetWidth;
            node.classList.add("flash");
            setTimeout(() => node.classList.remove("flash"), 1800);
          }
        }, 60);
      }

      input.addEventListener("input", () => runSearch(input.value));
      clearBtn.addEventListener("click", () => { if (input.value) { input.value = ""; runSearch(""); input.focus(); } else closeSearch(); });
      overlay.addEventListener("pointerdown", e => { if (e.target === overlay) closeSearch(); });
      overlay.addEventListener("keydown", e => {
        if (e.key === "Escape") { e.preventDefault(); closeSearch(); }
        else if (e.key === "ArrowDown") { e.preventDefault(); if (current.length) { sel = (sel + 1) % current.length; paintSel(true); } }
        else if (e.key === "ArrowUp") { e.preventDefault(); if (current.length) { sel = (sel - 1 + current.length) % current.length; paintSel(true); } }
        else if (e.key === "Enter") { e.preventDefault(); choose(sel); }
        else if (e.key === "Tab") { e.preventDefault(); (document.activeElement === input ? clearBtn : input).focus(); }
      });
      document.addEventListener("keydown", e => {
        const typing = /^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || "");
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); searchOpen ? closeSearch() : openSearch(); }
        else if (e.key === "/" && !typing && !searchOpen) { e.preventDefault(); openSearch(); }
      });
      document.querySelector("#searchOpen").addEventListener("click", openSearch);
      document.querySelector("#dockSearch").addEventListener("click", openSearch);
    })();
