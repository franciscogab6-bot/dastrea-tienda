/* D'Astrea · tienda */
(function () {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const E = DA.esc, money = DA.money, ic = DA.icon;
  const K_CART = "dastrea_cart_v2", K_FAV = "dastrea_favs", K_LISTS = "dastrea_mylists", K_COOKIE = "dastrea_cookie_ok";
  const THEMES = { ninguna: "#4A0F17", octubre: "#B4500E", navidad: "#8E0F1A", amor: "#9E1640", girasoles: "#8A6400", verano: "#B8323A", clases: "#1F3F6E", patrias: "#1E5E3A" };
  const PAGE = 24;

  let cat = DA.normalize(DA.ls.get("dastrea_catalog_cache", null) || window.DASTREA_SEED);
  let cart = DA.ls.get(K_CART, []), favs = DA.ls.get(K_FAV, []), myLists = DA.ls.get(K_LISTS, []);
  const F = { grupo: "todo", col: "all", tipo: "all", sort: "dest", q: "", fav: false, n: PAGE };
  let M = null; // producto abierto
  let pendingListItem = null;

  /* ---------- utilidades ---------- */
  const A = () => cat.ajustes;
  const prod = (id) => cat._p[id];
  const garmentFor = (p, tipoPref) => {
    const gs = (p.prendas || []).filter((g) => cat._g[g]);
    return gs.find((g) => cat._g[g].tipo === tipoPref) || gs[0];
  };
  const visibleProducts = () => cat.productos.filter((p) => DA.visible(cat, p));
  const colorObj = (id) => cat._k[id];
  const gar = (gid, colorId, p) => DA.garment((cat._g[gid] || {}).tipo || "playera", colorObj(colorId), p);
  const fill = (t) => DA.fill(t, Object.assign({}, A(), { responsable: A().responsable || "La responsable de D’Astrea" }));

  /* ---------- bloqueo de scroll (iOS seguro) ---------- */
  let lockY = 0, locks = 0;
  function lock() { if (locks++ === 0) { lockY = window.scrollY; document.body.style.top = -lockY + "px"; document.body.classList.add("lock"); } }
  function unlock() { if (locks > 0 && --locks === 0) { document.body.classList.remove("lock"); document.body.style.top = ""; window.scrollTo(0, lockY); } }

  /* ---------- tema de temporada ---------- */
  function applyTheme() {
    const t = (A().temporada || {}).activa || "ninguna";
    document.documentElement.style.setProperty("--accent", A().colorAcento || THEMES[t] || THEMES.ninguna);
  }

  /* ---------- barra, franja, hero ---------- */
  function renderTop() {
    const bar = (A().barra || []).filter(Boolean), strip = (A().franja || []).filter(Boolean);
    const msgs = bar.map((t) => String(t).replace(/[✦★✧·]+/g, " ").replace(/\s+/g, " ").trim()).filter(Boolean);
    $("#bar").hidden = !msgs.length;
    $("#barTrack").innerHTML = msgs.map((t, i) => `<span class="${i ? "" : "on"}">${E(t)}</span>`).join("");
    clearInterval(renderTop.t);
    if (msgs.length > 1) { let k = 0; renderTop.t = setInterval(() => { const sp = $$("#barTrack span"); if (!sp.length) return; sp[k % sp.length].classList.remove("on"); k++; sp[k % sp.length].classList.add("on"); }, 4500); }
    const h = A().hero || {};
    $("#heroL1").textContent = h.linea1 || "Mira";
    $("#heroL2").textContent = h.linea2 || "más allá.";
    $("#heroTxt").textContent = h.texto || "";
    const vis = visibleProducts();
    const p1 = prod(h.producto1) && DA.visible(cat, prod(h.producto1)) ? prod(h.producto1) : vis[0];
    const p2 = prod(h.producto2) && DA.visible(cat, prod(h.producto2)) ? prod(h.producto2) : vis[1];
    if (p1) { const g = garmentFor(p1, "sudadera"), c = DA.colorsFor(cat, p1, g)[0]; $("#heroG1").innerHTML = gar(g, c && c.id, p1); $("#heroG1").onclick = () => openProduct(p1.id, g, c && c.id); }
    if (p2) { const g = garmentFor(p2, "playera"), c = DA.colorsFor(cat, p2, g)[0]; $("#heroG2").innerHTML = gar(g, c && c.id, p2); }
    const p3 = vis.find((p) => p !== p1 && p !== p2 && DA.groupOf(cat, p) !== "infantil");
    if (p3) { const g = garmentFor(p3, "playera"), cs = DA.colorsFor(cat, p3, g), c = cs[1] || cs[0]; $("#heroG3").innerHTML = gar(g, c && c.id, p3); $("#heroG3").onclick = () => openProduct(p3.id, g, c && c.id); }
    if (p2) { const g = garmentFor(p2, "playera"), c = DA.colorsFor(cat, p2, g)[0]; $("#heroG2").onclick = () => openProduct(p2.id, g, c && c.id); }
    const t = A().temporada || {}; const tc = cat._c[t.coleccion];
    const navT = $("#navTemp"); if (navT) navT.textContent = tc && tc.activa !== false && t.activa !== "ninguna" ? tc.nombre : "Temporada";
  }

  /* ---------- temporada ---------- */
  function renderSeason() {
    const t = A().temporada || {}; const c = cat._c[t.coleccion];
    const sec = $("#season");
    if (!c || c.activa === false || t.activa === "ninguna") { sec.hidden = true; return; }
    const ps = visibleProducts().filter((p) => p.coleccion === c.id).slice(0, 3);
    if (!ps.length) { sec.hidden = true; return; }
    sec.hidden = false;
    $("#seasonTitle").textContent = t.titulo || c.nombre;
    $("#seasonText").textContent = t.texto || c.descripcion || "";
    $("#seasonBtn").onclick = () => { setGrupo(c.grupo, c.id); goShop(); };
    $("#seasonArt").innerHTML = ps.map((p, i) => { const g = garmentFor(p, i === 1 ? "sudadera" : "playera"), k = DA.colorsFor(cat, p, g)[0]; return `<button data-open="${p.id}" data-g="${g}" data-c="${k && k.id}" aria-label="${E(p.nombre)}">${gar(g, k && k.id, p)}</button>`; }).join("");
  }

  /* ---------- colecciones ---------- */
  let colTab = "todo";
  const GROUPS = [["todo", "Todo"], ["adultos", "Adultos"], ["infantil", "Mini"], ["temporada", "Temporada"]];
  function renderCollections() {
    const cols = cat.colecciones.filter((c) => c.activa !== false && visibleProducts().some((p) => p.coleccion === c.id));
    $("#colTabs").innerHTML = GROUPS.filter(([g]) => g === "todo" || cols.some((c) => c.grupo === g)).map(([g, n]) => `<button class="${g === colTab ? "on" : ""}" data-ctab="${g}" role="tab" aria-selected="${g === colTab}">${n}</button>`).join("");
    const t = A().temporada || {};
    const list = cols.filter((c) => colTab === "todo" || c.grupo === colTab);
    $("#cols").innerHTML = list.map((c, i) => {
      const ps = visibleProducts().filter((p) => p.coleccion === c.id); const hp = ps[0]; const g = garmentFor(hp, i % 3 === 1 ? "sudadera" : "playera"); const k = DA.colorsFor(cat, hp, g)[0];
      const feat = c.id === t.coleccion && t.activa !== "ninguna";
      return `<button class="colc ${feat ? "feat" : ""}" data-colgo="${c.id}"><div class="ph"><div class="gar">${gar(g, k && k.id, hp)}</div></div><div class="cap"><span class="nm">${E(c.nombre)}</span><span class="n">${ps.length}</span></div></button>`;
    }).join("");
  }

  /* ---------- filtros ---------- */
  function renderFilters() {
    const vis = visibleProducts();
    $("#grupoSeg").innerHTML = GROUPS.filter(([g]) => g === "todo" || vis.some((p) => DA.groupOf(cat, p) === g)).map(([g, n]) => `<button data-grupo-f="${g}" class="${F.grupo === g && !F.fav ? "on" : ""}" role="tab">${n}</button>`).join("") + (F.fav ? `<button class="on" data-favoff>Favoritos ×</button>` : "");
    const cols = cat.colecciones.filter((c) => c.activa !== false && (F.grupo === "todo" || c.grupo === F.grupo) && vis.some((p) => p.coleccion === c.id));
    $("#chips").innerHTML = [`<button class="chip ${F.col === "all" ? "on" : ""}" data-col="all">Todas</button>`].concat(cols.map((c) => `<button class="chip ${F.col === c.id ? "on" : ""}" data-col="${c.id}">${E(c.nombre)}</button>`)).join("");
    $$("#tipoSeg button").forEach((b) => b.classList.toggle("on", b.dataset.t === F.tipo));
    $("#sort").value = F.sort;
  }
  function filtered() {
    const q = F.q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    let list = visibleProducts().filter((p) => {
      if (F.fav && !favs.includes(p.id)) return false;
      if (!F.fav && F.grupo !== "todo" && DA.groupOf(cat, p) !== F.grupo) return false;
      if (!F.fav && F.col !== "all" && p.coleccion !== F.col) return false;
      if (F.tipo !== "all" && !(p.prendas || []).some((g) => cat._g[g] && cat._g[g].tipo === F.tipo)) return false;
      if (q) { const hay = (p.nombre + " " + (cat._c[p.coleccion] || {}).nombre + " " + (p.descripcion || "") + " " + (p.etiqueta || "")).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); if (!q.split(/\s+/).every((w) => hay.includes(w))) return false; }
      return true;
    });
    const pr = (p) => F.tipo === "all" ? DA.minPrice(cat, p) : DA.price(cat, p, garmentFor(p, F.tipo));
    if (F.sort === "menor") list.sort((a, b) => pr(a) - pr(b));
    else if (F.sort === "mayor") list.sort((a, b) => pr(b) - pr(a));
    else if (F.sort === "nuevo") list.sort((a, b) => (b.etiqueta === "Nuevo") - (a.etiqueta === "Nuevo") || (b.orden || 0) - (a.orden || 0));
    else list.sort((a, b) => ((b.etiqueta === "Más vendido") - (a.etiqueta === "Más vendido")) || (a.orden || 0) - (b.orden || 0));
    return list;
  }

  /* ---------- tarjetas ---------- */
  let io = null;
  function lazy(el) {
    if (!("IntersectionObserver" in window)) { paintCard(el); return; }
    if (!io) io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); paintCard(e.target); } }), { rootMargin: "400px 0px" });
    io.observe(el);
  }
  function paintCard(el) { const p = prod(el.dataset.pid); if (p) el.innerHTML = gar(el.dataset.g, el.dataset.c, p); }
  function tagHTML(p) {
    const t = [];
    if (p.etiqueta) t.push(`<span class="tg ${/edici|temporada/i.test(p.etiqueta) ? "w" : /original/i.test(p.etiqueta) ? "b" : ""}">${E(p.etiqueta)}</span>`);
    if (p.piezas === 0) t.push(`<span class="tg o">Agotado</span>`);
    else if (p.piezas != null && p.piezas !== "" && p.piezas <= 4) t.push(`<span class="tg w">Quedan ${p.piezas}</span>`);
    return t.join("");
  }
  function cardHTML(p, i) {
    const g = garmentFor(p, F.tipo !== "all" ? F.tipo : i % 3 === 1 ? "sudadera" : "playera");
    const cs = DA.colorsFor(cat, p, g), c0 = cs[0] || {};
    const price = F.tipo === "all" ? `${(p.prendas || []).length > 1 ? "desde " : ""}${DA.moneyShort(DA.minPrice(cat, p))}` : DA.moneyShort(DA.price(cat, p, g));
    return `<article class="card ${c0.oscuro ? "dk" : ""} ${p.piezas === 0 ? "out" : ""}" data-id="${p.id}" style="animation-delay:${Math.min(i % PAGE, 12) * 30}ms">
      <div class="ph">
        <div class="tags">${tagHTML(p)}</div>
        <button class="fav ${favs.includes(p.id) ? "on" : ""}" data-fav="${p.id}" aria-label="Guardar en favoritos" aria-pressed="${favs.includes(p.id)}">${ic("Favoritos")}</button>
        <div class="gar" data-pid="${p.id}" data-g="${g}" data-c="${c0.id || ""}"></div>
      </div>
      <div class="meta"><div><div class="nm">${E(p.nombre)}</div><div class="cl">${E((cat._c[p.coleccion] || {}).nombre || "")} · ${E(cat._g[g].corto)}</div>
        <div class="sw">${cs.slice(0, 5).map((c, j) => `<i class="${j === 0 ? "on" : ""}" style="background:${c.hex}" data-sw="${c.id}" title="${E(c.nombre)}"></i>`).join("")}</div></div>
        <div class="pr">${price}</div></div>
    </article>`;
  }
  function renderGrid(keepN) {
    if (!keepN) F.n = PAGE;
    const list = filtered();
    const grid = $("#grid");
    const colName = F.col !== "all" ? (cat._c[F.col] || {}).nombre : null;
    $("#result").textContent = F.fav ? `${list.length} favoritos` : `${list.length} diseños${colName ? " · " + colName : ""}${F.q ? " · “" + F.q + "”" : ""}`;
    if (!list.length) {
      grid.innerHTML = `<div class="empty"><div class="t">${F.fav ? "Sin favoritos aún" : "Nada por aquí"}</div><div>${F.fav ? "Toca el corazón en un diseño" : "Prueba con otra búsqueda o colección"}</div></div>`;
      $("#moreWrap").hidden = true; return;
    }
    grid.innerHTML = list.slice(0, F.n).map(cardHTML).join("");
    $$(".gar[data-pid]", grid).forEach(lazy);
    $("#moreWrap").hidden = list.length <= F.n;
  }

  /* ---------- mini / pie ---------- */
  function renderKids() {
    const ps = visibleProducts().filter((p) => DA.groupOf(cat, p) === "infantil");
    $("#mini").hidden = !ps.length;
    const pick = [0, 3, 6, 9, 12, 15].map((i) => ps[i]).filter(Boolean).slice(0, 3);
    $("#kidsArt").innerHTML = pick.map((p, i) => { const g = garmentFor(p, i === 1 ? "sudadera" : "playera"); const cs = DA.colorsFor(cat, p, g); const k = cs[i % cs.length] || cs[0]; return `<button data-open="${p.id}" data-g="${g}" data-c="${k && k.id}" aria-label="${E(p.nombre)}">${gar(g, k && k.id, p)}</button>`; }).join("");
  }
  function waLink(text) { return `https://wa.me/${String(A().whatsapp || "").replace(/\D/g, "")}${text ? "?text=" + encodeURIComponent(text) : ""}`; }
  function renderFooter() {
    const a = A();
    const c = [];
    if (a.whatsapp) c.push(`<li><a href="${waLink("Hola D’Astrea 🦉")}" target="_blank" rel="noopener">${ic("Chat")} WhatsApp</a></li>`);
    if (a.instagram) c.push(`<li><a href="https://instagram.com/${E(a.instagram.replace("@", ""))}" target="_blank" rel="noopener">${ic("Instagram")} @${E(a.instagram.replace("@", ""))}</a></li>`);
    if (a.tiktok) c.push(`<li><a href="https://www.tiktok.com/@${E(a.tiktok.replace("@", ""))}" target="_blank" rel="noopener">${ic("Compartir")} TikTok</a></li>`);
    if (a.facebook) c.push(`<li><a href="https://facebook.com/search/top?q=${encodeURIComponent(a.facebook)}" target="_blank" rel="noopener">${ic("Cuenta")} Facebook</a></li>`);
    if (a.correo) c.push(`<li><a href="mailto:${E(a.correo)}">${ic("Correo")} ${E(a.correo)}</a></li>`);
    $("#ftContact").innerHTML = c.join("");
    $("#mnavContact").innerHTML = [a.instagram && "@" + E(a.instagram.replace("@", "")), a.correo && E(a.correo)].filter(Boolean).map((x) => `<span>${x}</span>`).join("");
    $("#ftCity").textContent = a.ciudad || "";
    $("#yr").textContent = new Date().getFullYear();
  }

  function renderAll() {
    applyTheme(); renderTop(); renderSeason(); renderCollections(); renderFilters(); renderGrid(); renderKids(); renderFooter(); badges(); drawCart();
    if (M) drawModal();
  }

  /* ---------- navegación ---------- */
  function goShop() { closeAll(true); $("#tienda").scrollIntoView({ behavior: "smooth", block: "start" }); }
  function setGrupo(g, col) { F.grupo = g === "todo" || !g ? "todo" : g; F.col = col || "all"; F.fav = false; renderFilters(); renderGrid(); }
  document.addEventListener("click", (e) => {
    const t = e.target;
    const go = t.closest("[data-go]");
    if (go) { e.preventDefault(); if (go.dataset.grupo) setGrupo(go.dataset.grupo); if (go.dataset.go === "tienda") goShop(); else { closeAll(true); const el = document.getElementById(go.dataset.go); if (el) el.scrollIntoView({ behavior: "smooth" }); } return; }
    const home = t.closest("[data-home]"); if (home) { e.preventDefault(); closeAll(true); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const r = t.closest("[data-route]"); if (r) { e.preventDefault(); navigate(r.dataset.route); return; }
    const cg = t.closest("[data-colgo]"); if (cg) { const c = cat._c[cg.dataset.colgo]; setGrupo(c ? c.grupo : "todo", cg.dataset.colgo); goShop(); return; }
    const ct = t.closest("[data-ctab]"); if (ct) { colTab = ct.dataset.ctab; renderCollections(); return; }
    const op = t.closest("[data-open]"); if (op) { openProduct(op.dataset.open, op.dataset.g, op.dataset.c); return; }
    if (t.closest("[data-close]") || t === $("#ov")) { closeAll(); return; }
    if (t.closest("[data-sizes]")) { e.preventDefault(); if (!M) { const p = visibleProducts()[0]; openProduct(p.id); } const d = $("#sizesDet"); d.open = true; setTimeout(() => d.scrollIntoView({ behavior: "smooth", block: "center" }), 350); return; }
  });
  $("#grupoSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-grupo-f]"); if (b) setGrupo(b.dataset.grupoF); if (e.target.closest("[data-favoff]")) { F.fav = false; renderFilters(); renderGrid(); } });
  $("#chips").addEventListener("click", (e) => { const b = e.target.closest("[data-col]"); if (!b) return; F.col = b.dataset.col; renderFilters(); renderGrid(); });
  $("#tipoSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-t]"); if (!b) return; F.tipo = b.dataset.t; renderFilters(); renderGrid(); });
  $("#sort").addEventListener("change", (e) => { F.sort = e.target.value; renderGrid(); });
  $("#moreBtn").addEventListener("click", () => { F.n += PAGE; renderGrid(true); });

  /* tarjetas */
  const grid = $("#grid");
  grid.addEventListener("click", (e) => {
    const s = e.target.closest("[data-sw]"); if (s) { e.stopPropagation(); swapCard(s); return; }
    const f = e.target.closest("[data-fav]"); if (f) { e.stopPropagation(); toggleFav(f.dataset.fav); f.classList.toggle("on", favs.includes(f.dataset.fav)); f.setAttribute("aria-pressed", favs.includes(f.dataset.fav)); if (F.fav) renderGrid(true); return; }
    const c = e.target.closest(".card"); if (c) { const g = $(".gar", c); openProduct(c.dataset.id, g.dataset.g, g.dataset.c); }
  });
  if (matchMedia("(hover:hover)").matches) grid.addEventListener("mouseover", (e) => { const s = e.target.closest("[data-sw]"); if (s) swapCard(s); });
  function swapCard(s) {
    const card = s.closest(".card"), g = $(".gar", card), p = prod(card.dataset.id);
    if (g.dataset.c === s.dataset.sw) return; g.dataset.c = s.dataset.sw; g.innerHTML = gar(g.dataset.g, s.dataset.sw, p);
    $$("[data-sw]", card).forEach((x) => x.classList.toggle("on", x === s)); card.classList.toggle("dk", !!(colorObj(s.dataset.sw) || {}).oscuro);
  }

  /* búsqueda */
  let qT;
  $("#searchBtn").onclick = () => { const s = $("#search"); s.classList.toggle("open"); if (s.classList.contains("open")) setTimeout(() => $("#q").focus(), 150); };
  $("#q").addEventListener("input", (e) => { clearTimeout(qT); qT = setTimeout(() => { F.q = e.target.value.trim(); F.fav = false; renderFilters(); renderGrid(); }, 220); });
  $("#q").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); goShop(); } });

  /* favoritos */
  function toggleFav(id) { favs = favs.includes(id) ? favs.filter((x) => x !== id) : [...favs, id]; DA.ls.set(K_FAV, favs); badges(); }
  $("#favBtn").onclick = () => { if (!favs.length) { toastMsg("Aún no tienes favoritos", "Toca el corazón en un diseño"); return; } F.fav = true; F.q = ""; $("#q").value = ""; renderFilters(); renderGrid(); goShop(); };

  /* menú móvil */
  $("#menuBtn").onclick = () => { $("#mnav").classList.add("on"); $("#ov").classList.add("on"); lock(); };

  /* ---------- modal de producto ---------- */
  function openProduct(id, g, c, opts = {}) {
    const p = prod(id); if (!p) return;
    const gid = g && (p.prendas || []).includes(g) ? g : garmentFor(p, "playera");
    const cs = DA.colorsFor(cat, p, gid);
    M = { pid: id, g: gid, c: cs.some((k) => k.id === c) ? c : (cs[0] || {}).id, s: null, q: 1 };
    drawModal();
    if (!$("#modal").classList.contains("on")) { $("#modal").classList.add("on"); $("#modal").setAttribute("aria-hidden", "false"); $("#ov").classList.add("on"); lock(); }
    $(".minfo").scrollTop = 0; $("#mbox").scrollTop = 0; $("#sizesDet").open = false;
    if (!opts.noHash) setHash("p=" + id);
  }
  function sizeTable(gid) {
    const kids = (cat._g[gid] || {}).grupo === "infantil";
    const rows = kids ? [["2", "2 años", "33", "42"], ["4", "3–4 años", "36", "46"], ["6", "5–6 años", "39", "50"], ["8", "7–8 años", "42", "54"], ["10", "9–10 años", "45", "58"], ["12", "11–12 años", "48", "62"], ["14", "13–14 años", "50", "66"]]
      : [["CH", "Chica", "52", "70"], ["M", "Mediana", "55", "72"], ["G", "Grande", "58", "74"], ["XG", "Ex-grande", "61", "76"], ["XXG", "2X-grande", "64", "78"]];
    return `<table><tr><th>Talla</th><th>${kids ? "Edad" : "Nombre"}</th><th>Ancho</th><th>Largo</th></tr>${rows.map((r) => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]} cm</td><td>${r[3]} cm</td></tr>`).join("")}</table><p>Medidas aproximadas de la prenda en plano. ${kids ? "Si está entre dos tallas, elige la mayor: crecen rápido." : "Corte oversize: si te gusta más ajustada, pide una talla menos."}</p>`;
  }
  function drawModal() {
    const p = prod(M.pid); if (!p) { closeAll(); return; }
    const g = cat._g[M.g], cs = DA.colorsFor(cat, p, M.g);
    if (!cs.some((k) => k.id === M.c)) M.c = (cs[0] || {}).id;
    const col = cat._c[p.coleccion] || {};
    $("#mCol").textContent = `${col.nombre || ""} · ${g.nombre}`;
    $("#mName").textContent = p.nombre;
    $("#mPrice").textContent = money(DA.price(cat, p, M.g));
    $("#mDesc").textContent = p.descripcion || "";
    $("#mDet").textContent = g.detalle || "";
    $("#mShip").textContent = `Enviamos a todo México en ${A().diasEnvio || "3 a 6 días hábiles"}. Envío gratis desde ${money(A().envioGratis)}. Cambios de talla dentro de ${A().diasCambio || 7} días, con la prenda sin uso y con etiqueta.`;
    $("#mTags").innerHTML = tagHTML(p);
    $("#mBig").innerHTML = gar(M.g, M.c, p);
    $("#mG").innerHTML = (p.prendas || []).filter((x) => cat._g[x]).map((x) => `<button class="${x === M.g ? "on" : ""}" data-mg="${x}" aria-pressed="${x === M.g}"><b>${E(cat._g[x].corto)}</b><span>${money(DA.price(cat, p, x))}</span></button>`).join("");
    $("#mC").innerHTML = cs.map((k) => `<button class="${k.id === M.c ? "on" : ""}" data-mc="${k.id}" style="background:${k.hex}" title="${E(k.nombre)}" aria-label="${E(k.nombre)}" aria-pressed="${k.id === M.c}"></button>`).join("");
    $("#mCName").textContent = (colorObj(M.c) || {}).nombre || "";
    const grp = DA.groupOf(cat, p);
    const sib = visibleProducts().filter((x) => DA.groupOf(cat, x) === grp);
    $("#mD").innerHTML = sib.map((x) => `<button class="${x.id === p.id ? "on" : ""} ${x.fondo === "oscuro" ? "dk" : ""}" data-md="${x.id}" title="${E(x.nombre)}" aria-label="${E(x.nombre)}"><img src="${E(DA.img(x.imagen))}" alt="" loading="lazy" decoding="async"></button>`).join("");
    $("#mDName").textContent = p.nombre;
    $("#mS").innerHTML = (g.tallas || []).map((s) => `<button class="${s === M.s ? "on" : ""}" data-ms="${E(s)}" aria-pressed="${s === M.s}">${E(s)}</button>`).join("");
    $("#mSName").textContent = M.s || "elige una";
    $("#sizeTable").innerHTML = sizeTable(M.g);
    const out = p.piezas === 0;
    $("#mStock").innerHTML = out ? "Agotado · avísanos por WhatsApp si lo quieres" : p.piezas != null && p.piezas !== "" ? `<i></i> Quedan ${p.piezas} piezas de esta edición` : "";
    $("#addBtn").disabled = out;
    $("#qv").textContent = M.q;
    $("#mFav").classList.toggle("on", favs.includes(p.id)); $("#mFav").style.color = favs.includes(p.id) ? "var(--accent)" : "";
    const on = $("#mD .on"), dsl = $("#mD"); if (on) dsl.scrollLeft = on.offsetLeft - dsl.clientWidth / 2 + on.clientWidth / 2;
  }
  $("#modal").addEventListener("click", (e) => {
    const t = e.target.closest("[data-mg],[data-mc],[data-md],[data-ms]"); if (!t) return;
    if (t.dataset.mg) { M.g = t.dataset.mg; const g = cat._g[M.g]; if (M.s && !(g.tallas || []).includes(M.s)) M.s = null; }
    if (t.dataset.mc) M.c = t.dataset.mc;
    if (t.dataset.md) { const p = prod(t.dataset.md); M.pid = p.id; if (!(p.prendas || []).includes(M.g)) M.g = garmentFor(p, cat._g[M.g].tipo); setHash("p=" + p.id, true); }
    if (t.dataset.ms) M.s = t.dataset.ms;
    drawModal();
  });
  $("#qm").onclick = () => { M.q = Math.max(1, M.q - 1); $("#qv").textContent = M.q; };
  $("#qp").onclick = () => { M.q = Math.min(20, M.q + 1); $("#qv").textContent = M.q; };
  $("#mFav").onclick = () => { toggleFav(M.pid); drawModal(); renderGrid(true); };
  $("#mShare").onclick = async () => {
    const p = prod(M.pid); const url = location.origin + location.pathname + "#p=" + p.id;
    if (navigator.share) { try { await navigator.share({ title: "D’Astrea · " + p.nombre, text: p.descripcion || "", url }); } catch (e) {} }
    else { copy(url); toastMsg("Liga copiada", "Pégala donde quieras"); }
  };
  function needSize() {
    if (M.s) return false;
    const o = $("#sizeOpt"); o.classList.remove("shake"); void o.offsetWidth; o.classList.add("shake");
    const b = $("#mSName"); b.textContent = "elige tu talla"; b.style.color = "var(--accent)"; setTimeout(() => (b.style.color = ""), 1400);
    o.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }
  $("#addBtn").onclick = () => {
    if (needSize()) return;
    addToCart({ pid: M.pid, prenda: M.g, color: M.c, talla: M.s, q: M.q });
    const m = Object.assign({}, M); closeAll(); toastAdd(m);
  };
  $("#addListBtn").onclick = () => {
    if (needSize()) return;
    pendingListItem = { pid: M.pid, prenda: M.g, color: M.c, talla: M.s, q: M.q };
    if (myLists.length === 1) { addItemToList(myLists[0], pendingListItem); pendingListItem = null; return; }
    navigate("mis-listas");
  };

  /* ---------- bolsa ---------- */
  const keyOf = (i) => [i.pid, i.prenda, i.color, i.talla, i.lista ? i.lista.id + ":" + i.lista.idx : ""].join("|");
  function addToCart(item) {
    const k = keyOf(item); const ex = cart.find((i) => keyOf(i) === k);
    if (ex) ex.q = Math.min(20, ex.q + item.q); else cart.push(item);
    saveCart();
  }
  function saveCart() { DA.ls.set(K_CART, cart); badges(); drawCart(); }
  function badges() {
    const n = cart.reduce((a, i) => a + i.q, 0);
    $("#cartBadge").textContent = n; $("#cartBadge").classList.toggle("show", n > 0);
    $("#favBadge").textContent = favs.length; $("#favBadge").classList.toggle("show", favs.length > 0);
    $("#listBadge").textContent = myLists.length; $("#listBadge").classList.toggle("show", myLists.length > 0);
  }
  function lineInfo(i) {
    const p = prod(i.pid), g = cat._g[i.prenda];
    const ok = p && DA.visible(cat, p) && g && (p.prendas || []).includes(i.prenda) && p.piezas !== 0;
    return { p, g, ok, price: ok ? DA.price(cat, p, i.prenda) : 0 };
  }
  function totals() {
    const sub = cart.reduce((a, i) => { const L = lineInfo(i); return a + (L.ok ? L.price * i.q : 0); }, 0);
    const env = sub === 0 || sub >= Number(A().envioGratis || 0) ? 0 : Number(A().envio || 0);
    return { sub, env, tot: sub + env };
  }
  function drawCart() {
    const { sub, env, tot } = totals(); const gratis = Number(A().envioGratis || 0);
    const falta = Math.max(0, gratis - sub);
    $("#shipT").innerHTML = sub === 0 ? `Envío gratis en compras desde <b>${money(gratis)}</b>` : falta > 0 ? `Te faltan <b>${money(falta)}</b> para envío gratis` : "<b>¡Tu envío es gratis!</b>";
    $("#shipBar").style.width = Math.min(100, gratis ? (sub / gratis) * 100 : 100) + "%";
    if (!cart.length) {
      $("#items").innerHTML = `<div class="cempty"><img src="assets/buho-blanco.svg" alt=""><div class="got">Tu bolsa está vacía</div><p class="mono">El búho te está esperando</p><button class="btn btn-k" data-go="tienda" data-grupo="todo">Ver la colección</button></div>`;
      $("#df").hidden = true; return;
    }
    $("#df").hidden = false;
    $("#items").innerHTML = cart.map((i, k) => {
      const L = lineInfo(i); const c = colorObj(i.color);
      if (!L.p) return `<div class="it na"><div class="th"></div><div><div class="nm">Diseño retirado</div><div class="na-t mono">Ya no está disponible</div></div><div><button class="rm" data-rm="${k}">Quitar</button></div></div>`;
      return `<div class="it ${L.ok ? "" : "na"}"><div class="th">${L.g ? gar(i.prenda, i.color, L.p) : ""}</div>
        <div><div class="nm">${E(L.p.nombre)}</div><div class="op mono">${E(L.g ? L.g.corto : "")} · ${E(c ? c.nombre : "")} · Talla ${E(i.talla)}</div>
        ${i.lista ? `<div class="gl mono">${ic("Regalo")} Regalo · ${E(i.lista.nombre)}</div><br>` : ""}
        ${L.ok ? `<div class="qty"><button data-cq="${k}" data-v="-1" aria-label="Menos">−</button><span>${i.q}</span><button data-cq="${k}" data-v="1" aria-label="Más">+</button></div>` : `<div class="na-t mono">No disponible por ahora</div>`}</div>
        <div><div class="pr">${L.ok ? DA.moneyShort(L.price * i.q) : "—"}</div><button class="rm" data-rm="${k}">Quitar</button></div></div>`;
    }).join("");
    $("#sub").textContent = money(sub); $("#env").textContent = env ? money(env) : "Gratis"; $("#tot").textContent = money(tot);
    $("#checkout").disabled = sub === 0;
  }
  $("#items").addEventListener("click", (e) => {
    const q = e.target.closest("[data-cq]"); if (q) { const i = cart[+q.dataset.cq]; i.q = Math.min(20, i.q + Number(q.dataset.v)); if (i.q < 1) cart.splice(+q.dataset.cq, 1); saveCart(); }
    const r = e.target.closest("[data-rm]"); if (r) { cart.splice(+r.dataset.rm, 1); saveCart(); }
  });
  function openCart() { drawCart(); $("#drawer").classList.add("on"); $("#drawer").setAttribute("aria-hidden", "false"); $("#ov").classList.add("on"); lock(); }
  $("#cartBtn").onclick = openCart;
  $("#clearCart").onclick = () => { if (confirm("¿Vaciar tu bolsa?")) { cart = []; saveCart(); } };
  $("#checkout").onclick = () => {
    const { sub, env, tot } = totals();
    const lines = [], gifts = [];
    cart.forEach((i) => { const L = lineInfo(i); if (!L.ok) return; const c = colorObj(i.color);
      lines.push(`• ${i.q} × ${L.p.nombre} — ${L.g.corto} ${c ? c.nombre : ""}, talla ${i.talla} (${money(L.price * i.q)})${i.lista ? ` 🎁 regalo para la lista “${i.lista.nombre}”` : ""}`);
      if (i.lista) gifts.push(i); });
    const msg = `Hola D’Astrea 🦉 quiero hacer este pedido:\n\n${lines.join("\n")}\n\nSubtotal: ${money(sub)}\nEnvío: ${env ? money(env) : "Gratis"}\nTotal: ${money(tot)}\n\nMi nombre:\nCiudad y código postal:`;
    const w = window.open(waLink(msg), "_blank"); if (!w) location.href = waLink(msg);
    gifts.forEach((i) => DA.lists.gift(i.lista.id, i.lista.idx, i.q).catch(() => {}));
    if (gifts.length) { cart = cart.filter((i) => !i.lista); saveCart(); }
  };

  /* ---------- capas ---------- */
  let hashPushed = false;
  function setHash(h, replace) {
    if (location.hash.slice(1) === h) return;
    if (replace || hashPushed) history.replaceState(null, "", "#" + h);
    else { history.pushState(null, "", "#" + h); hashPushed = true; }
  }
  function clearHash() {
    if (!location.hash) return;
    if (hashPushed) { hashPushed = false; history.back(); }
    else history.replaceState(null, "", location.pathname + location.search);
  }
  function closeAll(silent) {
    const any = $$(".drawer.on,.modal.on,.mnav.on,.sheet.on").length;
    ["#drawer", "#modal", "#mnav", "#sheet", "#ov"].forEach((s) => { $(s).classList.remove("on"); $(s).setAttribute("aria-hidden", "true"); });
    if (any) { locks = 1; unlock(); }
    M = null;
    if (!silent || location.hash) clearHash();
  }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });
  window.addEventListener("popstate", () => { hashPushed = false; route(true); });

  /* ---------- aviso flotante ---------- */
  let tT;
  function toastAdd(m) { const p = prod(m.pid); $("#tTh").innerHTML = gar(m.g, m.c, p); $("#tName").textContent = "Agregado · " + p.nombre; $("#tOpt").textContent = `${cat._g[m.g].corto} · ${(colorObj(m.c) || {}).nombre || ""} · ${m.s}`; $("#tView").hidden = false; $("#tView").textContent = "Ver bolsa"; $("#tView").onclick = () => { hideToast(); openCart(); }; showToast(); }
  function toastMsg(a, b, btn) { $("#tTh").innerHTML = `<img src="assets/buho-blanco.svg" alt="">`; $("#tName").textContent = a; $("#tOpt").textContent = b || ""; $("#tView").hidden = !btn; if (btn) { $("#tView").textContent = btn.t; $("#tView").onclick = () => { hideToast(); btn.f(); }; } showToast(); }
  function showToast() { $("#toast").classList.add("on"); clearTimeout(tT); tT = setTimeout(hideToast, 3400); }
  function hideToast() { $("#toast").classList.remove("on"); }
  function copy(t) { if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(t).catch(() => fallbackCopy(t)); else fallbackCopy(t); }
  function fallbackCopy(t) { const a = document.createElement("textarea"); a.value = t; a.setAttribute("readonly", ""); a.style.cssText = "position:fixed;top:-100px;opacity:0"; document.body.appendChild(a); a.select(); try { document.execCommand("copy"); } catch (e) {} a.remove(); }

  /* ---------- hoja completa: rutas ---------- */
  function navigate(r) { if (location.hash.slice(1) === r) route(); else setHash(r); route(); }
  function openSheet(html) { $("#sheetBody").innerHTML = html; DA.paintIcons($("#sheetBody")); $("#sheetBody").scrollTop = 0; if (!$("#sheet").classList.contains("on")) { $("#modal").classList.remove("on"); $("#drawer").classList.remove("on"); $("#mnav").classList.remove("on"); $("#ov").classList.remove("on"); M = null; locks = 0; lock(); $("#sheet").classList.add("on"); $("#sheet").setAttribute("aria-hidden", "false"); } }
  async function route(fromPop) {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) { if ($$(".drawer.on,.modal.on,.mnav.on,.sheet.on").length) { ["#drawer", "#modal", "#mnav", "#sheet", "#ov"].forEach((s) => $(s).classList.remove("on")); locks = 1; unlock(); M = null; } return; }
    if (h.startsWith("p=")) { const id = h.slice(2); if (prod(id) && (!M || M.pid !== id)) { $("#sheet").classList.remove("on"); openProduct(id, null, null, { noHash: true }); } return; }
    if (h.startsWith("legal=")) return showLegal(h.slice(6));
    if (h === "mis-listas") return showMyLists();
    if (h.startsWith("lista=")) return showPublicList(h.slice(6));
  }

  function showLegal(k) {
    const L = (A().legal || {})[k];
    if (!L) { openSheet(`<div class="wrap"><h2>Página no encontrada</h2></div>`); return; }
    const links = Object.entries(A().legal).map(([key, v]) => `<button class="chip ${key === k ? "on" : ""}" data-route="legal=${key}">${E(v.titulo)}</button>`).join("");
    openSheet(`<div class="wrap legal-t"><div class="k mono">Información legal</div><h2>${E(L.titulo)}</h2><div class="chips" style="margin:6px 0 10px;flex-wrap:wrap">${links}</div>${DA.md(fill(L.texto))}<p class="mono" style="margin-top:30px;color:#8A857D">Contacto: ${E(A().correo || "")}</p></div>`);
  }

  /* listas de regalo */
  const OCAS = ["Cumpleaños", "Navidad", "Baby shower", "Boda", "Aniversario", "Graduación", "Día de Reyes", "Otra"];
  function listForm(l = {}, mode = "new") {
    return `<form class="form lform" data-mode="${mode}" data-id="${E(l.id || "")}">
      <label class="fld"><span>¿Cómo se llama tu lista?</span><input name="nombre" required maxlength="60" value="${E(l.nombre || "")}" placeholder="Ej. Cumple de Deya"></label>
      <div class="fld2"><label class="fld"><span>Ocasión</span><select name="ocasion">${OCAS.map((o) => `<option ${o === l.ocasion ? "selected" : ""}>${o}</option>`).join("")}</select></label>
      <label class="fld"><span>Fecha (opcional)</span><input name="fecha" type="date" value="${E(l.fecha || "")}"></label></div>
      <label class="fld"><span>Mensaje para quien te regale (opcional)</span><textarea name="mensaje" maxlength="240" placeholder="Ej. Soy talla M y me encanta el negro 🖤">${E(l.mensaje || "")}</textarea></label>
      <div class="ctas"><button class="btn btn-k" type="submit">${mode === "new" ? "Crear lista" : "Guardar cambios"}</button>${mode !== "new" ? `<button class="btn btn-l" type="button" data-cancel>Cancelar</button>` : ""}</div></form>`;
  }
  const listUrl = (id) => location.origin + location.pathname + "#lista=" + id;
  function itemCard(it, idx, l, owner) {
    const p = prod(it.pid), g = cat._g[it.prenda], c = colorObj(it.color);
    if (!p || !g) return `<div class="litem done"><div class="ph"></div><div class="b"><div class="nm">Diseño retirado</div>${owner ? `<button class="btn btn-l" data-ldel="${idx}" data-lid="${l.id}">Quitar</button>` : ""}</div></div>`;
    const done = (it.comprados || 0) >= it.q, falta = it.q - (it.comprados || 0);
    return `<div class="litem ${done ? "done" : ""}"><div class="ph">${gar(it.prenda, it.color, p)}</div><div class="b">
      <div class="nm">${E(p.nombre)}</div><div class="op mono">${E(g.corto)} · ${E(c ? c.nombre : "")} · Talla ${E(it.talla)}${it.q > 1 ? " · " + it.q + " pzas" : ""}</div>
      <div class="pr">${DA.moneyShort(DA.price(cat, p, it.prenda))}</div>
      <div class="st ${done ? "ok" : ""}">${done ? "✓ Ya se lo regalaron" : it.comprados ? `Faltan ${falta}` : owner ? "Aún disponible" : ""}</div>
      ${owner ? `<button class="btn btn-l" data-ldel="${idx}" data-lid="${l.id}">${ic("Basura")} Quitar</button>` : done ? "" : `<button class="btn btn-k" data-lgift="${idx}" data-lid="${l.id}">${ic("Regalo")} Regalar</button>`}
    </div></div>`;
  }
  function demoNote() { return DA.live ? "" : `<div class="notice">${ic("Candado")}<span><b>Modo demostración.</b> Tus listas se guardan solo en este navegador. Cuando la tienda esté en línea, la liga funcionará para todos.</span></div>`; }
  async function showMyLists(editId) {
    const pending = pendingListItem ? prod(pendingListItem.pid) : null;
    let html = `<div class="wrap"><div class="k mono">Listas de regalo</div><h2>Tus listas</h2><p class="lead">Arma tu lista, comparte la liga y que te regalen lo que sí quieres. Sin cuentas ni contraseñas: tus listas quedan guardadas en este celular o computadora.</p>${demoNote()}`;
    if (pending) html += `<div class="notice">${ic("Regalo")}<span>Vas a agregar <b>${E(pending.nombre)}</b> (talla ${E(pendingListItem.talla)}). ${myLists.length ? "Elige la lista:" : "Primero crea tu lista:"}</span></div>`;
    if (pending && myLists.length) html += `<div class="lbtns" style="margin-bottom:24px">${myLists.map((l) => `<button class="btn btn-k" data-pickl="${l.id}">${ic("Mas")} ${E(l.nombre)}</button>`).join("")}</div>`;
    if (!myLists.length) html += `<div class="lcard"><h3 style="margin-bottom:16px">Crea tu primera lista</h3>${listForm()}</div>`;
    html += `<div id="myListsBox">${myLists.map((l) => `<div class="lcard" data-lcard="${l.id}"><div class="mono">Cargando…</div></div>`).join("")}</div>`;
    if (myLists.length) html += `<details class="lcard" style="border:1px solid var(--lineL)"><summary>Crear otra lista</summary>${listForm()}</details>`;
    html += `</div>`;
    openSheet(html);
    for (const m of myLists) {
      const box = $(`[data-lcard="${m.id}"]`);
      try {
        const { list: l } = await DA.lists.get(m.id);
        if (m.nombre !== l.nombre) { m.nombre = l.nombre; DA.ls.set(K_LISTS, myLists); }
        box.innerHTML = editId === l.id ? `<h3 style="margin-bottom:14px">Editar lista</h3>${listForm(l, "edit")}` : `
          <div class="lcard-h"><div><h3>${E(l.nombre)}</h3><div class="mono">${E(l.ocasion || "")}${l.fecha ? " · " + new Date(l.fecha + "T12:00").toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" }) : ""} · ${l.items.length} prendas · ${l.items.filter((i) => (i.comprados || 0) >= i.q).length} regaladas</div></div></div>
          <div class="lbtns">
            <a class="btn btn-k" href="https://wa.me/?text=${encodeURIComponent("🎁 Mi lista de regalos en D’Astrea: " + listUrl(l.id))}" target="_blank" rel="noopener">${ic("Chat")} Compartir por WhatsApp</a>
            <button class="btn btn-l" data-lcopy="${l.id}">${ic("Copiar")} Copiar liga</button>
            <button class="btn btn-l" data-route="lista=${l.id}">${ic("Ver")} Ver como invitado</button>
            <button class="btn btn-l" data-ledit="${l.id}">${ic("Editar")} Editar</button>
            <button class="btn btn-l" data-lrm="${l.id}">${ic("Basura")} Borrar</button>
          </div>
          ${l.items.length ? `<div class="litems">${l.items.map((it, i) => itemCard(it, i, l, true)).join("")}</div>` : `<p style="margin-top:16px;color:var(--muted)">Tu lista está vacía. Abre cualquier diseño, elige talla y color y toca <b>“Agregar a mi lista”</b>.</p><div class="lbtns"><button class="btn btn-k" data-go="tienda" data-grupo="todo">Ir a la tienda</button></div>`}`;
      } catch (e) {
        box.innerHTML = `<div class="lcard-h"><div><h3>${E(m.nombre)}</h3><div class="mono">${e.status === 404 ? "Esta lista ya no existe" : "No pudimos cargarla, revisa tu conexión"}</div></div><button class="btn btn-l sm" data-lforget="${m.id}">Quitar de aquí</button></div>`;
      }
    }
  }
  async function showPublicList(id) {
    openSheet(`<div class="wrap"><div class="mono">Cargando lista…</div></div>`);
    try {
      const { list: l } = await DA.lists.get(id);
      const owner = myLists.find((m) => m.id === id);
      const total = l.items.length, done = l.items.filter((i) => (i.comprados || 0) >= i.q).length;
      openSheet(`<div class="wrap"><div class="pub-h"><img src="assets/buho-blanco.svg" alt=""><div class="k mono">Lista de regalos · ${E(l.ocasion || "")}${l.fecha ? " · " + new Date(l.fecha + "T12:00").toLocaleDateString("es-MX", { day: "numeric", month: "long" }) : ""}</div><h2>${E(l.nombre)}</h2>${l.mensaje ? `<p>${E(l.mensaje)}</p>` : ""}<p class="mono" style="margin-top:12px">${total - done} de ${total} prendas por regalar</p></div>
        ${owner ? `<div class="notice">${ic("Candado")}<span>Esta es tu lista. <button class="linkbtn" data-route="mis-listas">Editarla</button></span></div>` : `<p class="lead">Elige una prenda y toca <b>Regalar</b>: se agrega a tu bolsa con la talla y color que pidió. Al pedir por WhatsApp se marca como regalada.</p>`}
        ${total ? `<div class="litems">${l.items.map((it, i) => itemCard(it, i, l, false)).join("")}</div>` : `<p class="lead">Esta lista todavía no tiene prendas.</p>`}
        <div class="lbtns" style="margin-top:28px"><button class="btn btn-l" data-route="mis-listas">${ic("Regalo")} Crear mi propia lista</button></div></div>`);
      $("#sheetBody").dataset.list = JSON.stringify({ id: l.id, nombre: l.nombre });
    } catch (e) {
      openSheet(`<div class="wrap"><div class="k mono">Listas de regalo</div><h2>No encontramos esta lista</h2><p class="lead">Puede que la liga esté incompleta o que la lista se haya borrado.</p><div class="lbtns"><button class="btn btn-k" data-go="tienda" data-grupo="todo">Ir a la tienda</button></div></div>`);
    }
  }
  async function addItemToList(m, item) {
    try {
      const { list: l } = await DA.lists.get(m.id);
      const items = l.items || [];
      const same = items.find((i) => i.pid === item.pid && i.prenda === item.prenda && i.color === item.color && i.talla === item.talla);
      if (same) same.q = Math.min(20, same.q + item.q); else { if (items.length >= 60) throw new Error("Tu lista ya tiene muchas prendas"); items.push(Object.assign({ comprados: 0 }, item)); }
      await DA.lists.update(m.id, m.token, { items });
      closeAll(true); clearHash();
      toastMsg("Agregado a tu lista", m.nombre, { t: "Ver lista", f: () => navigate("mis-listas") });
    } catch (e) { toastMsg("No se pudo agregar", e.message || "Intenta de nuevo"); }
  }
  $("#sheet").addEventListener("submit", async (e) => {
    const f = e.target.closest(".lform"); if (!f) return; e.preventDefault();
    const d = Object.fromEntries(new FormData(f).entries());
    const btn = $("button[type=submit]", f); btn.disabled = true;
    try {
      if (f.dataset.mode === "new") {
        const r = await DA.lists.create({ nombre: d.nombre.trim(), ocasion: d.ocasion, fecha: d.fecha, mensaje: d.mensaje.trim() });
        const m = { id: r.id, token: r.token, nombre: d.nombre.trim() }; myLists.push(m); DA.ls.set(K_LISTS, myLists); badges();
        if (pendingListItem) { const it = pendingListItem; pendingListItem = null; await addItemToList(m, it); return; }
        showMyLists();
      } else {
        const m = myLists.find((x) => x.id === f.dataset.id);
        await DA.lists.update(m.id, m.token, { nombre: d.nombre.trim(), ocasion: d.ocasion, fecha: d.fecha, mensaje: d.mensaje.trim() });
        showMyLists();
      }
    } catch (err) { btn.disabled = false; toastMsg("No se pudo guardar", err.message || "Intenta de nuevo"); }
  });
  $("#sheet").addEventListener("click", async (e) => {
    const t = e.target;
    const pick = t.closest("[data-pickl]"); if (pick) { const m = myLists.find((x) => x.id === pick.dataset.pickl); const it = pendingListItem; pendingListItem = null; addItemToList(m, it); return; }
    const cp = t.closest("[data-lcopy]"); if (cp) { copy(listUrl(cp.dataset.lcopy)); toastMsg("Liga copiada", "Mándala por WhatsApp o redes"); return; }
    const ed = t.closest("[data-ledit]"); if (ed) { showMyLists(ed.dataset.ledit); return; }
    if (t.closest("[data-cancel]")) { showMyLists(); return; }
    const rm = t.closest("[data-lrm]"); if (rm) { if (!confirm("¿Borrar esta lista? Quien tenga la liga ya no podrá verla.")) return; const m = myLists.find((x) => x.id === rm.dataset.lrm); try { await DA.lists.remove(m.id, m.token); } catch (err) {} myLists = myLists.filter((x) => x.id !== m.id); DA.ls.set(K_LISTS, myLists); badges(); showMyLists(); return; }
    const fg = t.closest("[data-lforget]"); if (fg) { myLists = myLists.filter((x) => x.id !== fg.dataset.lforget); DA.ls.set(K_LISTS, myLists); badges(); showMyLists(); return; }
    const del = t.closest("[data-ldel]"); if (del) { const m = myLists.find((x) => x.id === del.dataset.lid); const { list: l } = await DA.lists.get(m.id); l.items.splice(+del.dataset.ldel, 1); await DA.lists.update(m.id, m.token, { items: l.items }); showMyLists(); return; }
    const gf = t.closest("[data-lgift]"); if (gf) {
      const info = JSON.parse($("#sheetBody").dataset.list || "{}"); const { list: l } = await DA.lists.get(gf.dataset.lid); const it = l.items[+gf.dataset.lgift];
      const falta = it.q - (it.comprados || 0); if (falta <= 0) return;
      addToCart({ pid: it.pid, prenda: it.prenda, color: it.color, talla: it.talla, q: falta, lista: { id: l.id, idx: +gf.dataset.lgift, nombre: info.nombre || l.nombre } });
      toastMsg("Regalo en tu bolsa", "Para " + l.nombre, { t: "Ver bolsa", f: () => { closeAll(true); clearHash(); openCart(); } });
      return;
    }
  });

  /* lista de espera */
  $("#waitForm").addEventListener("submit", async (e) => {
    e.preventDefault(); const v = $("#waitIn").value.trim(); if (!v) return;
    try { if (DA.live) await DA.api("/subs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contacto: v }) }); } catch (err) {}
    e.target.reset(); toastMsg("Ya estás en la lista", "Te avisamos antes del próximo drop");
  });

  /* aviso de cookies */
  if (!DA.ls.get(K_COOKIE, false)) setTimeout(() => ($("#cookie").hidden = false), 1500);
  $("#cookieOk").onclick = () => { DA.ls.set(K_COOKIE, true); $("#cookie").hidden = true; };

  /* sincronizar entre pestañas */
  window.addEventListener("storage", (e) => { if (e.key === K_CART) { cart = DA.ls.get(K_CART, []); badges(); drawCart(); } if (e.key === K_FAV) { favs = DA.ls.get(K_FAV, []); badges(); } });

  /* ---------- arranque ---------- */
  DA.paintIcons();
  renderAll();
  route();
  DA.loadCatalog((c) => { cat = c; renderAll(); route(); }).then((c) => { if (c && DA.strip(c) !== DA.strip(cat)) { /* ya actualizado */ } });
})();
