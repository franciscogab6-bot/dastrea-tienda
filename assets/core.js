/* D'Astrea · núcleo compartido (tienda + administrador) */
(function () {
  const DA = (window.DA = {});
  const BASE = document.documentElement.dataset.base || "";
  DA.base = BASE;

  /* ---------- almacenamiento local seguro ---------- */
  DA.ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };

  /* ---------- iconos ---------- */
  DA.icons = window.DASTREA_ICONS || {};
  DA.icon = (n, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${DA.icons[n] || ""}"/></svg>`;
  DA.paintIcons = (root = document) => root.querySelectorAll("[data-icon]").forEach((el) => { if (!el.firstChild) el.innerHTML = DA.icon(el.dataset.icon, el.dataset.cls || "ic"); });

  /* ---------- utilidades ---------- */
  DA.esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  DA.money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-MX") + " MXN";
  DA.moneyShort = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("es-MX");
  DA.uid = (n = 10) => { const a = "abcdefghijkmnpqrstuvwxyz23456789"; let s = ""; const r = (window.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(n)) : Array.from({ length: n }, () => Math.random() * 256); for (let i = 0; i < n; i++) s += a[r[i] % a.length]; return s; };
  DA.img = (src) => (!src ? "" : /^(https?:|data:|\/)/.test(src) ? src : BASE + src);
  DA.fill = (txt, a) => String(txt || "").replace(/\{(\w+)\}/g, (m, k) => {
    if (k === "envio" || k === "envioGratis") return DA.money(a[k]);
    return a[k] != null && a[k] !== "" ? a[k] : m;
  });
  /* texto simple a HTML: ## títulos, párrafos */
  DA.md = (txt) => { let out = "", para = []; const flush = () => { if (para.length) { out += `<p>${para.join("<br>")}</p>`; para = []; } };
    DA.esc(txt).split("\n").forEach((ln) => { const t = ln.trim(); if (!t) flush(); else if (t.startsWith("## ")) { flush(); out += `<h3>${t.slice(3)}</h3>`; } else para.push(t); }); flush(); return out; };

  /* ---------- modo (en línea con servidor, o demostración) ---------- */
  DA.live = false;
  async function fetchJSON(url, opts = {}, ms = 7000) {
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const t = ctl ? setTimeout(() => ctl.abort(), ms) : null;
    try {
      const r = await fetch(url, Object.assign({ signal: ctl && ctl.signal }, opts));
      const ct = r.headers.get("content-type") || "";
      const body = ct.includes("json") ? await r.json() : null;
      if (!r.ok) { const e = new Error((body && body.error) || "Error " + r.status); e.status = r.status; throw e; }
      return body;
    } finally { if (t) clearTimeout(t); }
  }
  DA.fetchJSON = fetchJSON;
  DA.api = (path, opts) => fetchJSON("/api" + path, opts);

  /* ---------- catálogo ---------- */
  const CACHE = "dastrea_catalog_cache";
  const DEMO_CAT = "dastrea_demo_catalog";
  DA.normalize = function (c) {
    c = JSON.parse(JSON.stringify(c || {}));
    c.ajustes = c.ajustes || {}; c.colecciones = c.colecciones || []; c.prendas = c.prendas || []; c.colores = c.colores || []; c.productos = c.productos || [];
    c.ajustes.legal = c.ajustes.legal || {}; c.ajustes.hero = c.ajustes.hero || {}; c.ajustes.temporada = c.ajustes.temporada || { activa: "ninguna" };
    const map = (arr) => Object.fromEntries(arr.map((x) => [x.id, x]));
    c._p = map(c.productos); c._c = map(c.colecciones); c._g = map(c.prendas); c._k = map(c.colores);
    c.colecciones.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    c.productos.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
    return c;
  };
  DA.strip = (c) => { const o = {}; for (const k in c) if (k[0] !== "_") o[k] = c[k]; return o; };

  /* carga rápida: caché/semilla primero, servidor después */
  DA.loadCatalog = async function (onUpdate) {
    const seed = window.DASTREA_SEED;
    const first = DA.ls.get(CACHE, null) || seed;
    let cat = DA.normalize(first);
    if (!location.protocol.startsWith("http")) {
      const demo = DA.ls.get(DEMO_CAT, null); if (demo) cat = DA.normalize(demo);
      return cat;
    }
    try {
      const r = await DA.api("/catalog?v=" + Date.now().toString(36).slice(0, 5), { cache: "no-store" });
      DA.live = true;
      const fresh = DA.normalize(r && r.catalog ? r.catalog : seed);
      DA.ls.set(CACHE, DA.strip(fresh));
      if (onUpdate && JSON.stringify(DA.strip(fresh)) !== JSON.stringify(DA.strip(cat))) onUpdate(fresh);
      return fresh;
    } catch (e) {
      DA.live = false;
      const demo = DA.ls.get(DEMO_CAT, null);
      if (demo) { cat = DA.normalize(demo); if (onUpdate) onUpdate(cat); }
      return cat;
    }
  };
  DA.saveDemoCatalog = (c) => DA.ls.set(DEMO_CAT, DA.strip(c));

  /* ---------- reglas de producto ---------- */
  DA.price = (cat, p, gid) => { const v = p && p.precios && p.precios[gid]; return v != null && v !== "" ? Number(v) : Number((cat._g[gid] || {}).precio || 0); };
  DA.minPrice = (cat, p) => Math.min(...(p.prendas || []).filter((g) => cat._g[g]).map((g) => DA.price(cat, p, g)));
  DA.colorsFor = (cat, p, gid) => {
    const kids = (cat._g[gid] || {}).grupo === "infantil";
    return cat.colores.filter((k) => (!k.soloInfantil || kids) && (p.fondo === "todos" || (p.fondo === "oscuro" ? k.oscuro : !k.oscuro)));
  };
  DA.visible = (cat, p) => !!(p && p.activo !== false && cat._c[p.coleccion] && cat._c[p.coleccion].activa !== false && (p.prendas || []).some((g) => cat._g[g]) && p.imagen);
  DA.groupOf = (cat, p) => (cat._c[p.coleccion] || {}).grupo || "adultos";

  /* ---------- dibujo de prendas ---------- */
  const SHAPES = {
    playera: {
      body: "M141,42 C162,66 238,66 259,42 L330,64 L394,150 L342,184 L318,158 L318,422 Q200,432 82,422 L82,158 L58,184 L6,150 L70,64 Z",
      area: { x: 200, y: 112, w: 150, h: 184 },
      extra: (s) => `<path d="M141,42 C162,70 238,70 259,42" fill="none" stroke="${s}" stroke-opacity=".35" stroke-width="9"/><path d="M342,184 L394,150 L388,140 L336,174Z M58,184 L6,150 L12,140 L64,174Z" fill="${s}" fill-opacity=".14"/>`,
    },
    sudadera: {
      body: "M132,70 C128,18 272,18 268,70 L306,84 L360,140 L392,328 L352,338 L320,196 L320,404 L80,404 L80,196 L48,338 L8,328 L40,140 L94,84 Z",
      area: { x: 200, y: 146, w: 130, h: 136 },
      extra: (s, dk) => `<path d="M150,72 C158,108 242,108 250,72 C240,46 160,46 150,72Z" fill="${s}" fill-opacity=".38"/><path d="M132,70 C140,112 260,112 268,70" fill="none" stroke="${s}" stroke-opacity=".25" stroke-width="5"/><path d="M186,98 L183,170 M214,98 L217,170" stroke="${dk ? "#d9d4ca" : "#f7f4ee"}" stroke-width="3.2" stroke-linecap="round"/><path d="M126,300 L274,300 L292,384 L108,384 Z" fill="${s}" fill-opacity=".08" stroke="${s}" stroke-opacity=".28" stroke-width="2"/><rect x="80" y="388" width="240" height="16" fill="${s}" fill-opacity=".16"/><path d="M352,338 L392,328 L389,312 L349,322Z M48,338 L8,328 L11,312 L51,322Z" fill="${s}" fill-opacity=".18"/>`,
    },
  };
  let sprite = false;
  function ensureSprite() {
    if (sprite) return; sprite = true;
    const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("width", "0"); s.setAttribute("height", "0"); s.setAttribute("aria-hidden", "true");
    s.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    s.innerHTML = `<defs>
      <clipPath id="da-cp-playera"><path d="${SHAPES.playera.body}"/></clipPath>
      <clipPath id="da-cp-sudadera"><path d="${SHAPES.sudadera.body}"/></clipPath>
      ${[1, 0].map((dk) => `<linearGradient id="da-s${dk}" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity="${dk ? 0.35 : 0.16}"/><stop offset=".22" stop-color="#000" stop-opacity="0"/><stop offset=".78" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${dk ? 0.35 : 0.16}"/></linearGradient>
      <linearGradient id="da-v${dk}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="${dk ? 0.07 : 0.25}"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="${dk ? 0.18 : 0.07}"/></linearGradient>`).join("")}
    </defs>`;
    document.body.prepend(s);
  }
  /* tipo: 'playera' | 'sudadera'; color: objeto color; p: producto */
  DA.garment = function (tipo, color, p) {
    ensureSprite();
    const S = SHAPES[tipo] || SHAPES.playera, dk = color && color.oscuro ? 1 : 0, hex = (color && color.hex) || "#151515";
    const shade = dk ? "#000" : "#3a2f22";
    let art = "";
    if (p && p.imagen) {
      const w = Number(p.ancho) || 600, h = Number(p.alto) || 700, a = S.area;
      const sc = Math.min(a.w / w, a.h / h), W = w * sc, H = h * sc;
      const src = DA.esc(DA.img(p.imagen));
      art = `<image href="${src}" xlink:href="${src}" x="${(a.x - W / 2).toFixed(1)}" y="${a.y}" width="${W.toFixed(1)}" height="${H.toFixed(1)}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    return `<svg viewBox="0 0 400 440" width="100%" height="100%" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" focusable="false">
      <path d="${S.body}" fill="${hex}"/>
      <g clip-path="url(#da-cp-${tipo})">${art}
        <rect width="400" height="440" fill="url(#da-s${dk})"/><rect width="400" height="440" fill="url(#da-v${dk})"/>
        ${S.extra(shade, dk)}</g>
      <path d="${S.body}" fill="none" stroke="#000" stroke-opacity="${dk ? 0.5 : 0.12}" stroke-width="1.2"/></svg>`;
  };

  /* ---------- listas de regalo (servidor o demostración) ---------- */
  const DEMO_LISTS = "dastrea_demo_lists";
  DA.lists = {
    async create(data) {
      if (DA.live) return DA.api("/lists", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      const all = DA.ls.get(DEMO_LISTS, {}); const id = DA.uid(8), token = DA.uid(16);
      all[id] = Object.assign({ id, items: [], creada: new Date().toISOString() }, data, { _token: token }); DA.ls.set(DEMO_LISTS, all);
      return { id, token, list: pub(all[id]) };
    },
    async get(id) {
      if (DA.live) return DA.api("/lists/" + encodeURIComponent(id), { cache: "no-store" });
      const l = DA.ls.get(DEMO_LISTS, {})[id]; if (!l) { const e = new Error("No encontramos esta lista"); e.status = 404; throw e; } return { list: pub(l) };
    },
    async update(id, token, data) {
      if (DA.live) return DA.api("/lists/" + encodeURIComponent(id), { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(Object.assign({ token }, data)) });
      const all = DA.ls.get(DEMO_LISTS, {}); const l = all[id]; if (!l || l._token !== token) throw new Error("Sin permiso");
      Object.assign(l, data); DA.ls.set(DEMO_LISTS, all); return { list: pub(l) };
    },
    async remove(id, token) {
      if (DA.live) return DA.api("/lists/" + encodeURIComponent(id), { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) });
      const all = DA.ls.get(DEMO_LISTS, {}); delete all[id]; DA.ls.set(DEMO_LISTS, all); return { ok: true };
    },
    async gift(id, idx, q) {
      if (DA.live) return DA.api("/lists/" + encodeURIComponent(id) + "/gift", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idx, q }) });
      const all = DA.ls.get(DEMO_LISTS, {}); const l = all[id]; if (l && l.items[idx]) { l.items[idx].comprados = Math.min(l.items[idx].q, (l.items[idx].comprados || 0) + q); DA.ls.set(DEMO_LISTS, all); }
      return { ok: true };
    },
  };
  function pub(l) { const o = Object.assign({}, l); delete o._token; return o; }
})();
