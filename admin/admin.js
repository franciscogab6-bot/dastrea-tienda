/* D'Astrea · administrador */
(function () {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const E = DA.esc, ic = DA.icon;
  const K_PASS = "dastrea_admin_key";
  let KEY = "";
  try { KEY = sessionStorage.getItem(K_PASS) || ""; } catch (e) {}
  let cat = null, saved = "", tab = "productos", demo = false;

  /* ---------- utilidades ---------- */
  const strip = (c) => JSON.stringify(DA.strip(c));
  const renorm = () => { // reindexa sin clonar (el editor guarda referencias a los objetos)
    const map = (a) => Object.fromEntries(a.map((x) => [x.id, x]));
    cat._p = map(cat.productos); cat._c = map(cat.colecciones); cat._g = map(cat.prendas); cat._k = map(cat.colores);
  };
  function dirty() { const d = strip(cat) !== saved; $("#dirty").hidden = !d; $("#saveBtn").disabled = !d; return d; }
  let tT;
  function toast(m, err) { const t = $("#toast"); t.textContent = m; t.classList.toggle("err", !!err); t.classList.add("on"); clearTimeout(tT); tT = setTimeout(() => t.classList.remove("on"), 3200); }
  const slug = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) || "item";
  const uniq = (base, set) => { let id = base, n = 2; while (set.has(id)) id = base + "-" + n++; return id; };
  async function api(path, opts = {}) { opts.headers = Object.assign({ "x-admin-key": KEY }, opts.headers || {}); return DA.api(path, opts); }
  window.addEventListener("beforeunload", (e) => { if (cat && dirty()) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- acceso ---------- */
  async function tryLogin(pass) {
    if (!location.protocol.startsWith("http")) { demo = true; return true; }
    try { KEY = pass; await api("/login", { method: "POST" }); return true; }
    catch (e) {
      if (e.status === 401) throw new Error("Contraseña incorrecta");
      if (e.status === 500) throw e;
      demo = true; return true; // sin servidor: modo demostración
    }
  }
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault(); $("#loginErr").textContent = "";
    const p = $("#pass").value; const btn = $("button", e.target); btn.disabled = true;
    try { await tryLogin(p); try { sessionStorage.setItem(K_PASS, p); } catch (x) {} start(); }
    catch (err) { $("#loginErr").textContent = err.message; }
    btn.disabled = false;
  });
  async function start() {
    $("#login").hidden = true; $("#app").hidden = false;
    cat = await DA.loadCatalog();
    if (DA.live) demo = false;
    saved = strip(cat);
    $("#mode").textContent = demo ? "Demostración" : "En línea"; $("#mode").className = "mode " + (demo ? "demo" : "live");
    DA.paintIcons(); render(); dirty();
  }
  if (KEY || !location.protocol.startsWith("http")) {
    tryLogin(KEY).then(start).catch(() => { KEY = ""; });
    if (!location.protocol.startsWith("http")) $("#loginMsg").textContent = "Abierto desde tu computadora: modo demostración.";
  }

  /* ---------- guardar ---------- */
  async function save() {
    const btn = $("#saveBtn"); btn.disabled = true; $(".t", btn).textContent = "Guardando…";
    try {
      const body = DA.strip(cat);
      if (demo) { DA.saveDemoCatalog(body); saved = strip(cat); toast("Guardado en este navegador (demostración)"); }
      else {
        const r = await api("/catalog", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ catalog: body }) });
        cat.version = r.version; cat.actualizado = r.actualizado; saved = strip(cat);
        DA.ls.set("dastrea_catalog_cache", DA.strip(cat));
        toast("¡Listo! La tienda ya muestra los cambios");
      }
    } catch (e) { toast("No se pudo guardar: " + e.message, true); if (e.status === 401) logout(); }
    $(".t", btn).textContent = "Guardar"; dirty();
  }
  $("#saveBtn").onclick = save;
  document.addEventListener("keydown", (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (dirty()) save(); } if (e.key === "Escape") closeEd(); });
  function logout() { try { sessionStorage.removeItem(K_PASS); } catch (e) {} location.reload(); }

  /* ---------- navegación ---------- */
  $("#side").addEventListener("click", (e) => {
    if (e.target.closest("[data-logout]")) { if (!dirty() || confirm("Tienes cambios sin guardar. ¿Salir de todos modos?")) { cat = null; logout(); } return; }
    const b = e.target.closest("[data-tab]"); if (!b) return; tab = b.dataset.tab; $$("#side [data-tab]").forEach((x) => x.classList.toggle("on", x === b)); $("#side").classList.remove("on"); render(); window.scrollTo(0, 0);
  });
  $("#menuBtn").onclick = () => $("#side").classList.toggle("on");

  function render() {
    const V = { productos: vProductos, colecciones: vColecciones, prendas: vPrendas, colores: vColores, portada: vPortada, contacto: vContacto, legal: vLegal, listas: vListas, espera: vEspera, respaldo: vRespaldo };
    $("#main").innerHTML = (demo ? `<div class="note warn">${ic("Candado")}<span><b>Modo demostración:</b> los cambios se guardan solo en este navegador. Cuando la tienda esté publicada en Netlify, al guardar se actualiza para todos.</span></div>` : "") + V[tab]();
    DA.paintIcons($("#main"));
    if (V[tab].after) V[tab].after();
  }
  const bindInputs = (root, apply) => root.addEventListener("input", (e) => { const el = e.target.closest("[data-k]"); if (!el) return; apply(el); dirty(); });

  /* ================= PRODUCTOS ================= */
  let pf = { q: "", col: "all" };
  function vProductos() {
    const cols = cat.colecciones;
    const list = cat.productos.filter((p) => (pf.col === "all" || p.coleccion === pf.col) && (!pf.q || (p.nombre + " " + p.descripcion).toLowerCase().includes(pf.q.toLowerCase())));
    return `<div class="h"><div><h2>Productos</h2><p>${cat.productos.length} diseños. Toca uno para editarlo. Los apagados no se ven en la tienda.</p></div><button class="btn pri" data-newp>${ic("Mas")} Nuevo diseño</button></div>
      <div class="bar"><input id="pq" type="search" placeholder="Buscar diseño…" value="${E(pf.q)}"><select id="pcol"><option value="all">Todas las colecciones</option>${cols.map((c) => `<option value="${c.id}" ${pf.col === c.id ? "selected" : ""}>${E(c.nombre)}${c.activa === false ? " (oculta)" : ""}</option>`).join("")}</select></div>
      <div class="grid">${pf.q ? "" : `<button class="pc add" data-newp>${ic("Mas")}Agregar diseño</button>`}${list.map((p) => {
        const g = (p.prendas || [])[0]; const k = cat._g[g] ? DA.colorsFor(cat, p, g)[0] : null; const vis = DA.visible(cat, p);
        return `<div class="pc ${vis ? "" : "off"}" data-editp="${p.id}">${p.etiqueta ? `<span class="bd">${E(p.etiqueta)}</span>` : ""}<div class="th">${cat._g[g] ? DA.garment(cat._g[g].tipo, k, p) : ""}</div><div class="b"><div class="nm">${E(p.nombre)}</div><div class="mt">${E((cat._c[p.coleccion] || {}).nombre || "Sin colección")} · desde ${DA.moneyShort(DA.minPrice(cat, p) || 0)}${p.piezas === 0 ? " · agotado" : ""}${!vis ? " · oculto" : ""}</div></div></div>`;
      }).join("")}</div>`;
  }
  vProductos.after = () => {
    $("#pq").addEventListener("input", (e) => { pf.q = e.target.value; const pos = e.target.selectionStart; render(); const n = $("#pq"); n.focus(); n.setSelectionRange(pos, pos); });
    $("#pcol").addEventListener("change", (e) => { pf.col = e.target.value; render(); });
    $("#main").onclick = (e) => { const n = e.target.closest("[data-newp]"); if (n) return newProduct(); const p = e.target.closest("[data-editp]"); if (p) editProduct(p.dataset.editp); };
  };
  function newProduct() {
    const col = pf.col !== "all" ? pf.col : (cat.colecciones[0] || {}).id;
    const grp = (cat._c[col] || {}).grupo;
    const id = uniq("diseno-" + DA.uid(4), new Set(Object.keys(cat._p)));
    const p = { id, nombre: "Nuevo diseño", coleccion: col, imagen: "", fondo: "oscuro", ancho: 600, alto: 700, etiqueta: "Nuevo", piezas: 10, descripcion: "", activo: true, orden: -1, prendas: cat.prendas.filter((g) => (g.grupo === "infantil") === (grp === "infantil")).map((g) => g.id), precios: {} };
    cat.productos.unshift(p); cat.productos.forEach((x, i) => (x.orden = i)); renorm(); dirty(); editProduct(id, true);
  }

  /* editor de producto */
  let ED = null;
  function openEd(html) { const old = $("#edBody"), nb = old.cloneNode(false); old.replaceWith(nb); nb.innerHTML = html; DA.paintIcons($("#edBody")); $("#editor").classList.add("on"); $("#ov").classList.add("on"); $("#editor").setAttribute("aria-hidden", "false"); }
  function closeEd() { $("#editor").classList.remove("on"); $("#ov").classList.remove("on"); $("#editor").setAttribute("aria-hidden", "true"); if (ED) { ED = null; render(); } }
  $("#ov").onclick = () => { closeEd(); $("#side").classList.remove("on"); };
  function editProduct(id, isNew) {
    const p = cat._p[id]; if (!p) return;
    ED = { id, g: (p.prendas || [])[0] || cat.prendas[0].id, c: null };
    const tags = ["", "Nuevo", "Más vendido", "Edición limitada", "Original", "Temporada", "Oferta"];
    openEd(`<div class="ed-h"><button class="ib" data-close aria-label="Cerrar">${ic("Atras")}</button><h3>${isNew ? "Nuevo diseño" : "Editar diseño"}</h3><label class="sw"><input type="checkbox" data-k="activo" ${p.activo !== false ? "checked" : ""}><span>Visible</span></label></div>
      <div class="ed-b">
        <div class="prev"><div><div class="pv" id="pv"></div><div class="pvt" id="pvt"></div><div class="pvs" id="pvs"></div></div>
          <div><label class="drop" id="drop">${ic("Imagen")}<b>${p.imagen ? "Cambiar imagen" : "Subir imagen del diseño"}</b><span>PNG o JPG. Ideal: fondo transparente, blanco o negro.</span><input type="file" accept="image/png,image/jpeg,image/webp" id="file" hidden></label>
          <div class="imgtools" id="imgtools" ${p.imagen ? "" : "hidden"}><button class="btn sm ghost" data-rmbg="claro">Quitar fondo blanco</button><button class="btn sm ghost" data-rmbg="oscuro">Quitar fondo negro</button></div>
          <p class="muted" style="font-size:12px;margin-top:8px" id="upmsg"></p></div></div>
        <div>
          <label class="fld"><span>Nombre</span><input data-k="nombre" value="${E(p.nombre)}" maxlength="40"></label>
          <label class="fld"><span>Descripción</span><textarea data-k="descripcion" maxlength="260">${E(p.descripcion || "")}</textarea></label>
          <div class="row2">
            <label class="fld"><span>Colección</span><select data-k="coleccion">${cat.colecciones.map((c) => `<option value="${c.id}" ${c.id === p.coleccion ? "selected" : ""}>${E(c.nombre)}</option>`).join("")}</select></label>
            <label class="fld"><span>Etiqueta</span><select data-k="etiqueta">${tags.concat(tags.includes(p.etiqueta) ? [] : [p.etiqueta]).map((t) => `<option value="${E(t)}" ${t === (p.etiqueta || "") ? "selected" : ""}>${t || "Sin etiqueta"}</option>`).join("")}</select></label>
          </div>
          <div class="row2">
            <label class="fld"><span>Piezas disponibles</span><input data-k="piezas" type="number" min="0" inputmode="numeric" value="${p.piezas ?? ""}" placeholder="Sin límite"><small>0 = agotado. Vacío = no mostrar.</small></label>
            <label class="fld"><span>Colores de prenda</span><select data-k="fondo"><option value="oscuro" ${p.fondo === "oscuro" ? "selected" : ""}>Solo oscuros (diseño claro)</option><option value="claro" ${p.fondo === "claro" ? "selected" : ""}>Solo claros (diseño oscuro)</option><option value="todos" ${p.fondo === "todos" ? "selected" : ""}>Todos los colores</option></select><small>Según cómo se ve el diseño.</small></label>
          </div>
          <div class="fld"><span>Se vende en · precio</span>
            <table class="t"><tr><th></th><th>Prenda</th><th>Precio especial</th></tr>${cat.prendas.map((g) => `<tr><td style="width:36px"><input type="checkbox" data-pg="${g.id}" ${(p.prendas || []).includes(g.id) ? "checked" : ""} style="width:20px;height:20px;min-height:0"></td><td>${E(g.nombre)}<div class="muted" style="font-size:12px">Normal ${DA.money(g.precio)}</div></td><td><input class="num" type="number" min="0" inputmode="numeric" data-pp="${g.id}" value="${(p.precios || {})[g.id] ?? ""}" placeholder="${g.precio}"></td></tr>`).join("")}</table>
            <small>Deja el precio vacío para usar el normal de la prenda.</small></div>
        </div>
      </div>
      <div class="ed-f"><button class="btn danger sm" data-delp>${ic("Basura")} Borrar</button><button class="btn ghost sm" data-dupp>${ic("Copiar")} Duplicar</button><div class="sp"></div><button class="btn ghost sm" data-movp="-1" title="Mover antes">${ic("Atras")}</button><button class="btn ghost sm" data-movp="1" title="Mover después" style="transform:scaleX(-1)">${ic("Atras")}</button><button class="btn pri" data-close>${ic("Listo")} Listo</button></div>`);
    drawPrev();
    const body = $("#edBody");
    bindInputs(body, (el) => { const k = el.dataset.k; let v = el.type === "checkbox" ? el.checked : el.value; if (k === "piezas") v = el.value === "" ? null : Math.max(0, parseInt(el.value) || 0); p[k] = v; if (k === "coleccion" || k === "fondo") { renorm(); } drawPrev(); });
    body.addEventListener("change", (e) => {
      const pg = e.target.closest("[data-pg]"); if (pg) { const set = new Set(p.prendas || []); pg.checked ? set.add(pg.dataset.pg) : set.delete(pg.dataset.pg); p.prendas = cat.prendas.map((g) => g.id).filter((x) => set.has(x)); if (!p.prendas.includes(ED.g)) ED.g = p.prendas[0]; drawPrev(); dirty(); }
    });
    body.addEventListener("input", (e) => { const pp = e.target.closest("[data-pp]"); if (pp) { p.precios = p.precios || {}; if (pp.value === "") delete p.precios[pp.dataset.pp]; else p.precios[pp.dataset.pp] = Math.max(0, Number(pp.value)); dirty(); } });
    body.onclick = (e) => {
      if (e.target.closest("[data-close]")) return closeEd();
      const t = e.target.closest("[data-pvg]"); if (t) { ED.g = t.dataset.pvg; drawPrev(); return; }
      const c = e.target.closest("[data-pvc]"); if (c) { ED.c = c.dataset.pvc; drawPrev(); return; }
      if (e.target.closest("[data-delp]")) { if (confirm(`¿Borrar “${p.nombre}”? Se quitará de la tienda.`)) { cat.productos = cat.productos.filter((x) => x.id !== p.id); renorm(); dirty(); closeEd(); } return; }
      if (e.target.closest("[data-dupp]")) { const n = JSON.parse(JSON.stringify(p)); n.id = uniq(p.id + "-copia", new Set(Object.keys(cat._p))); n.nombre = p.nombre + " (copia)"; const i = cat.productos.indexOf(p); cat.productos.splice(i + 1, 0, n); cat.productos.forEach((x, j) => (x.orden = j)); renorm(); dirty(); editProduct(n.id); toast("Duplicado"); return; }
      const mv = e.target.closest("[data-movp]"); if (mv) { const i = cat.productos.indexOf(p), j = i + Number(mv.dataset.movp); if (j < 0 || j >= cat.productos.length) return; cat.productos.splice(i, 1); cat.productos.splice(j, 0, p); cat.productos.forEach((x, k) => (x.orden = k)); renorm(); dirty(); toast("Movido a la posición " + (j + 1)); return; }
      const rb = e.target.closest("[data-rmbg]"); if (rb) { removeBg(p, rb.dataset.rmbg); return; }
    };
    const drop = $("#drop"), file = $("#file");
    drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("hov"); });
    drop.addEventListener("dragleave", () => drop.classList.remove("hov"));
    drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("hov"); if (e.dataTransfer.files[0]) handleFile(p, e.dataTransfer.files[0]); });
    file.addEventListener("change", () => { if (file.files[0]) handleFile(p, file.files[0]); file.value = ""; });
  }
  function drawPrev() {
    const p = cat._p[ED.id]; if (!p) return;
    const gs = (p.prendas || []).filter((g) => cat._g[g]);
    if (!gs.includes(ED.g)) ED.g = gs[0];
    if (!ED.g) { $("#pv").innerHTML = `<p class="muted" style="padding:20px">Elige al menos una prenda</p>`; $("#pvt").innerHTML = ""; $("#pvs").innerHTML = ""; return; }
    const cs = DA.colorsFor(cat, p, ED.g); if (!cs.some((c) => c.id === ED.c)) ED.c = (cs[0] || {}).id;
    $("#pv").innerHTML = DA.garment(cat._g[ED.g].tipo, cat._k[ED.c], p);
    $("#pvt").innerHTML = gs.map((g) => `<button class="${g === ED.g ? "on" : ""}" data-pvg="${g}">${E(cat._g[g].corto)}</button>`).join("");
    $("#pvs").innerHTML = cs.map((c) => `<button class="${c.id === ED.c ? "on" : ""}" data-pvc="${c.id}" style="background:${c.hex}" title="${E(c.nombre)}"></button>`).join("");
  }

  /* imágenes: redimensionar, convertir y subir */
  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.crossOrigin = "anonymous"; i.onload = () => res(i); i.onerror = () => rej(new Error("No se pudo leer la imagen")); i.src = src; }); }
  function toCanvas(img, max = 1000) { const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)); const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); return c; }
  function trim(c) {
    const x = c.getContext("2d"), d = x.getImageData(0, 0, c.width, c.height).data; let t = c.height, l = c.width, r = 0, b = 0;
    for (let y = 0; y < c.height; y++) for (let k = 0; k < c.width; k++) if (d[(y * c.width + k) * 4 + 3] > 12) { if (y < t) t = y; if (y > b) b = y; if (k < l) l = k; if (k > r) r = k; }
    if (r <= l || b <= t) return c; const o = document.createElement("canvas"); o.width = r - l + 1; o.height = b - t + 1; o.getContext("2d").drawImage(c, -l, -t); return o;
  }
  function guessFondo(c) {
    const x = c.getContext("2d"), d = x.getImageData(0, 0, c.width, c.height).data; let sum = 0, n = 0, alphaCount = 0;
    for (let i = 0; i < d.length; i += 16) { if (d[i + 3] < 30) { alphaCount++; continue; } sum += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
    // corners
    const px = (k, y) => { const i = (y * c.width + k) * 4; return d[i + 3] < 30 ? null : (d[i] + d[i + 1] + d[i + 2]) / 3; };
    const cs = [px(1, 1), px(c.width - 2, 1), px(1, c.height - 2), px(c.width - 2, c.height - 2)].filter((v) => v != null);
    if (cs.length >= 3) { const m = cs.reduce((a, b) => a + b, 0) / cs.length; return m > 128 ? "claro" : "oscuro"; }
    return n && sum / n > 150 ? "oscuro" : "claro"; // diseño mayormente claro -> va en prendas oscuras
  }
  function keyOut(c, mode) {
    const x = c.getContext("2d"), W = c.width, H = c.height, im = x.getImageData(0, 0, W, H), d = im.data;
    const tgt = mode === "claro" ? 255 : 0, tol = 60, seen = new Uint8Array(W * H), st = [];
    const near = (i) => Math.abs(d[i] - tgt) + Math.abs(d[i + 1] - tgt) + Math.abs(d[i + 2] - tgt) < tol * 1.6;
    for (let k = 0; k < W; k++) { st.push(k, (H - 1) * W + k); } for (let y = 0; y < H; y++) { st.push(y * W, y * W + W - 1); }
    while (st.length) { const p = st.pop(); if (seen[p]) continue; seen[p] = 1; const i = p * 4; if (!near(i)) continue; d[i + 3] = 0; const k = p % W, y = (p / W) | 0; if (k > 0) st.push(p - 1); if (k < W - 1) st.push(p + 1); if (y > 0) st.push(p - W); if (y < H - 1) st.push(p + W); }
    x.putImageData(im, 0, 0); return trim(c);
  }
  async function canvasToBlob(c) { return new Promise((res) => c.toBlob((b) => res(b), "image/webp", 0.86)); }
  async function storeImage(p, c) {
    c = trim(c);
    const blob = await canvasToBlob(c); const msg = $("#upmsg");
    p.ancho = c.width; p.alto = c.height;
    if (demo || !blob) { p.imagen = c.toDataURL("image/webp", 0.86); }
    else { msg.textContent = "Subiendo…"; const r = await DA.fetchJSON("/api/upload", { method: "POST", headers: { "x-admin-key": KEY, "content-type": blob.type || "image/webp" }, body: blob }, 30000); p.imagen = r.url; }
    msg.textContent = `Imagen lista (${c.width}×${c.height}).`; $("#imgtools").hidden = false; renorm(); drawPrev(); dirty();
  }
  async function handleFile(p, f) {
    if (!/image\/(png|jpe?g|webp)/.test(f.type)) return toast("Usa una imagen PNG, JPG o WEBP", true);
    if (f.size > 15e6) return toast("La imagen pesa demasiado (máx. 15 MB)", true);
    const url = URL.createObjectURL(f);
    try { const img = await loadImg(url); const c = toCanvas(img); p.fondo = guessFondo(c); $("[data-k=fondo]").value = p.fondo; await storeImage(p, c); toast("Imagen cargada. Si tiene fondo, usa “Quitar fondo”."); }
    catch (e) { toast(e.message, true); } finally { URL.revokeObjectURL(url); }
  }
  async function removeBg(p, mode) {
    try { const img = await loadImg(DA.img(p.imagen)); const c = keyOut(toCanvas(img), mode); p.fondo = mode === "claro" ? "claro" : "oscuro"; $("[data-k=fondo]").value = p.fondo; await storeImage(p, c); toast("Fondo quitado"); }
    catch (e) { toast("No se pudo quitar el fondo: " + e.message, true); }
  }

  /* ================= COLECCIONES ================= */
  const GR = { adultos: "Adultos", infantil: "Mini (infantil)", temporada: "Temporada" };
  function vColecciones() {
    return `<div class="h"><div><h2>Colecciones</h2><p>Agrupan los diseños. Apaga una colección para ocultarla completa (por ejemplo, Navidad fuera de temporada) sin borrar nada.</p></div><button class="btn pri" data-newc>${ic("Mas")} Nueva colección</button></div>
      <div class="wrapT"><table class="t" id="ctab"><tr><th>Orden</th><th>Visible</th><th>Nombre</th><th>Grupo</th><th>Descripción</th><th>Diseños</th><th></th></tr>
      ${cat.colecciones.map((c, i) => `<tr data-cid="${c.id}"><td><div class="ord"><button data-cmv="-1" aria-label="Subir" style="transform:rotate(90deg)">${ic("Atras")}</button><button data-cmv="1" aria-label="Bajar" style="transform:rotate(-90deg)">${ic("Atras")}</button></div></td>
        <td><label class="sw"><input type="checkbox" data-k="activa" ${c.activa !== false ? "checked" : ""}></label></td>
        <td><input data-k="nombre" value="${E(c.nombre)}" maxlength="30"></td>
        <td><select data-k="grupo">${Object.entries(GR).map(([k, v]) => `<option value="${k}" ${c.grupo === k ? "selected" : ""}>${v}</option>`).join("")}</select></td>
        <td style="min-width:220px"><input data-k="descripcion" value="${E(c.descripcion || "")}" maxlength="70"></td>
        <td>${cat.productos.filter((p) => p.coleccion === c.id).length}</td>
        <td><button class="ib" data-delc aria-label="Borrar">${ic("Basura")}</button></td></tr>`).join("")}</table></div>`;
  }
  vColecciones.after = () => {
    const t = $("#ctab");
    t.addEventListener("input", (e) => { const el = e.target.closest("[data-k]"); if (!el) return; const c = cat._c[el.closest("tr").dataset.cid]; c[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value; dirty(); });
    $("#main").onclick = (e) => {
      if (e.target.closest("[data-newc]")) { const n = prompt("Nombre de la nueva colección:"); if (!n) return; const id = uniq(slug(n), new Set(Object.keys(cat._c))); cat.colecciones.push({ id, nombre: n.trim().slice(0, 30), grupo: "adultos", descripcion: "", activa: true, orden: cat.colecciones.length }); renorm(); dirty(); render(); return; }
      const tr = e.target.closest("tr[data-cid]"); if (!tr) return; const c = cat._c[tr.dataset.cid]; const i = cat.colecciones.indexOf(c);
      const mv = e.target.closest("[data-cmv]"); if (mv) { const j = i + Number(mv.dataset.cmv); if (j < 0 || j >= cat.colecciones.length) return; cat.colecciones.splice(i, 1); cat.colecciones.splice(j, 0, c); cat.colecciones.forEach((x, k) => (x.orden = k)); renorm(); dirty(); render(); return; }
      if (e.target.closest("[data-delc]")) { const n = cat.productos.filter((p) => p.coleccion === c.id).length; if (n) return toast(`Tiene ${n} diseños. Muévelos o bórralos primero, o solo apágala.`, true); if (confirm(`¿Borrar la colección “${c.nombre}”?`)) { cat.colecciones.splice(i, 1); renorm(); dirty(); render(); } }
    };
  };

  /* ================= PRENDAS ================= */
  function vPrendas() {
    return `<div class="h"><div><h2>Prendas y precios</h2><p>El precio normal de cada prenda. Para un diseño con precio diferente, ponlo dentro del diseño.</p></div><button class="btn pri" data-newg>${ic("Mas")} Nueva prenda</button></div>
      <div id="gbox">${cat.prendas.map((g) => `<div class="card" data-gid="${g.id}"><div class="row3">
        <label class="fld"><span>Nombre completo</span><input data-k="nombre" value="${E(g.nombre)}"></label>
        <label class="fld"><span>Nombre corto</span><input data-k="corto" value="${E(g.corto)}"></label>
        <label class="fld"><span>Precio normal (MXN)</span><input data-k="precio" type="number" min="0" inputmode="numeric" value="${g.precio}"></label></div>
        <div class="row3">
        <label class="fld"><span>Forma</span><select data-k="tipo"><option value="playera" ${g.tipo === "playera" ? "selected" : ""}>Playera</option><option value="sudadera" ${g.tipo === "sudadera" ? "selected" : ""}>Sudadera</option></select></label>
        <label class="fld"><span>Para</span><select data-k="grupo"><option value="adultos" ${g.grupo === "adultos" ? "selected" : ""}>Adultos</option><option value="infantil" ${g.grupo === "infantil" ? "selected" : ""}>Infantil</option></select></label>
        <label class="fld"><span>Tallas (separadas por coma)</span><input data-k="tallas" value="${E((g.tallas || []).join(", "))}"></label></div>
        <label class="fld"><span>Detalles de la tela</span><textarea data-k="detalle">${E(g.detalle || "")}</textarea></label>
        <button class="btn danger sm" data-delg>${ic("Basura")} Borrar prenda</button></div>`).join("")}</div>`;
  }
  vPrendas.after = () => {
    $("#gbox").addEventListener("input", (e) => { const el = e.target.closest("[data-k]"); if (!el) return; const g = cat._g[el.closest("[data-gid]").dataset.gid]; const k = el.dataset.k; g[k] = k === "precio" ? Math.max(0, Number(el.value) || 0) : k === "tallas" ? el.value.split(",").map((s) => s.trim()).filter(Boolean) : el.value; dirty(); });
    $("#main").onclick = (e) => {
      if (e.target.closest("[data-newg]")) { const n = prompt("Nombre de la nueva prenda (ej. Playera manga larga):"); if (!n) return; const id = uniq(slug(n), new Set(Object.keys(cat._g))); cat.prendas.push({ id, nombre: n.trim(), corto: n.trim().split(" ")[0], tipo: "playera", grupo: "adultos", precio: 500, tallas: ["CH", "M", "G", "XG"], detalle: "" }); renorm(); dirty(); render(); toast("Prenda creada. Actívala dentro de cada diseño."); return; }
      const d = e.target.closest("[data-delg]"); if (d) { const id = d.closest("[data-gid]").dataset.gid; const n = cat.productos.filter((p) => (p.prendas || []).includes(id)).length; if (!confirm(`¿Borrar esta prenda? Se quitará de ${n} diseños.`)) return; cat.prendas = cat.prendas.filter((g) => g.id !== id); cat.productos.forEach((p) => (p.prendas = (p.prendas || []).filter((x) => x !== id))); renorm(); dirty(); render(); }
    };
  };

  /* ================= COLORES ================= */
  function vColores() {
    return `<div class="h"><div><h2>Colores de prenda</h2><p>“Oscuro” define en qué diseños aparece: los diseños claros van en colores oscuros y viceversa.</p></div><button class="btn pri" data-newk>${ic("Mas")} Nuevo color</button></div>
      <div class="wrapT"><table class="t" id="ktab"><tr><th>Color</th><th>Nombre</th><th>Es oscuro</th><th>Solo infantil</th><th></th></tr>
      ${cat.colores.map((k) => `<tr data-kid="${k.id}"><td><input type="color" data-k="hex" value="${E(k.hex)}"></td><td><input data-k="nombre" value="${E(k.nombre)}"></td><td><label class="sw"><input type="checkbox" data-k="oscuro" ${k.oscuro ? "checked" : ""}></label></td><td><label class="sw"><input type="checkbox" data-k="soloInfantil" ${k.soloInfantil ? "checked" : ""}></label></td><td><button class="ib" data-delk aria-label="Borrar">${ic("Basura")}</button></td></tr>`).join("")}</table></div>`;
  }
  vColores.after = () => {
    $("#ktab").addEventListener("input", (e) => { const el = e.target.closest("[data-k]"); if (!el) return; const k = cat._k[el.closest("tr").dataset.kid]; k[el.dataset.k] = el.type === "checkbox" ? el.checked : el.value; dirty(); });
    $("#main").onclick = (e) => {
      if (e.target.closest("[data-newk]")) { const n = prompt("Nombre del color:"); if (!n) return; cat.colores.push({ id: uniq(slug(n), new Set(Object.keys(cat._k))), nombre: n.trim(), hex: "#777777", oscuro: true }); renorm(); dirty(); render(); return; }
      const d = e.target.closest("[data-delk]"); if (d && confirm("¿Borrar este color?")) { cat.colores = cat.colores.filter((k) => k.id !== d.closest("tr").dataset.kid); renorm(); dirty(); render(); }
    };
  };

  /* ================= PORTADA ================= */
  const THEMES = [["ninguna", "Sin temporada (vino de la marca)"], ["octubre", "Octubre: Muertos y Brujas"], ["navidad", "Navidad"], ["amor", "Amor y Amistad"], ["patrias", "Fiestas Patrias"], ["clases", "Regreso a clases"], ["girasoles", "Primavera"], ["verano", "Verano"]];
  function vPortada() {
    const a = cat.ajustes, h = a.hero, t = a.temporada;
    const opts = (sel) => cat.productos.map((p) => `<option value="${p.id}" ${p.id === sel ? "selected" : ""}>${E(p.nombre)}</option>`).join("");
    return `<div class="h"><div><h2>Portada y temporada</h2><p>Lo primero que ve la gente. Al cambiar de temporada cambia el color de acento y aparece el banner.</p></div></div>
      <div class="card" id="tcard"><h3>Temporada activa</h3>
        <div class="row2"><label class="fld"><span>Temporada</span><select data-t="activa">${THEMES.map(([k, v]) => `<option value="${k}" ${t.activa === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>
        <label class="fld"><span>Colección destacada</span><select data-t="coleccion">${cat.colecciones.map((c) => `<option value="${c.id}" ${t.coleccion === c.id ? "selected" : ""}>${E(c.nombre)}</option>`).join("")}</select><small>Recuerda dejarla visible en Colecciones.</small></label></div>
        <label class="fld"><span>Título del banner</span><input data-t="titulo" value="${E(t.titulo || "")}"></label>
        <label class="fld"><span>Texto del banner</span><input data-t="texto" value="${E(t.texto || "")}"></label>
        <div class="row2"><label class="fld"><span>Color de acento (opcional)</span><input type="color" data-a="colorAcento" value="${E(a.colorAcento || "#4A0F17")}"><small>Si no lo cambias se usa el de la temporada.</small></label>
        <div class="fld"><span>&nbsp;</span><button class="btn ghost sm" data-clracc>Usar color de la temporada</button></div></div></div>
      <div class="card" id="hcard"><h3>Portada</h3>
        <label class="fld"><span>Texto chiquito de arriba</span><input data-h="kicker" value="${E(h.kicker || "")}"></label>
        <div class="row2"><label class="fld"><span>Título línea 1</span><input data-h="linea1" value="${E(h.linea1 || "")}"></label><label class="fld"><span>Título línea 2</span><input data-h="linea2" value="${E(h.linea2 || "")}"></label></div>
        <label class="fld"><span>Texto</span><textarea data-h="texto">${E(h.texto || "")}</textarea></label>
        <div class="row2"><label class="fld"><span>Prenda grande (sudadera)</span><select data-h="producto1">${opts(h.producto1)}</select></label><label class="fld"><span>Prenda chica (playera)</span><select data-h="producto2">${opts(h.producto2)}</select></label></div></div>
      <div class="card" id="bcard"><h3>Avisos que se mueven</h3>
        <label class="fld"><span>Barra de arriba (uno por línea)</span><textarea data-l="barra">${E((a.barra || []).join("\n"))}</textarea></label>
        <label class="fld"><span>Franja grande (uno por línea)</span><textarea data-l="franja">${E((a.franja || []).join("\n"))}</textarea></label></div>`;
  }
  vPortada.after = () => {
    $("#main").addEventListener("input", (e) => {
      const a = cat.ajustes, el = e.target;
      if (el.dataset.t) a.temporada[el.dataset.t] = el.value;
      else if (el.dataset.h) a.hero[el.dataset.h] = el.value;
      else if (el.dataset.l) a[el.dataset.l] = el.value.split("\n").map((s) => s.trim()).filter(Boolean);
      else if (el.dataset.a) a[el.dataset.a] = el.value;
      else return; dirty();
    });
    $("#main").onclick = (e) => { if (e.target.closest("[data-clracc]")) { delete cat.ajustes.colorAcento; dirty(); render(); toast("Se usará el color de la temporada"); } };
  };

  /* ================= CONTACTO ================= */
  function vContacto() {
    const a = cat.ajustes;
    const f = (k, l, t = "text", ph = "", help = "") => `<label class="fld"><span>${l}</span><input data-c="${k}" type="${t}" value="${E(a[k] ?? "")}" placeholder="${E(ph)}" ${t === "number" ? 'inputmode="numeric" min="0"' : ""}>${help ? `<small>${help}</small>` : ""}</label>`;
    return `<div class="h"><div><h2>Contacto y envíos</h2><p>Aquí llegan los pedidos y se calculan los envíos.</p></div></div>
      <div class="card" id="cc"><h3>Contacto</h3>
        <div class="row2">${f("whatsapp", "WhatsApp de pedidos", "tel", "528112345678", "Con 52 y sin espacios. Ej. 528112345678")}${f("correo", "Correo", "email", "dastrea.mx@gmail.com")}</div>
        <div class="row3">${f("instagram", "Instagram", "text", "d.astrea")}${f("tiktok", "TikTok", "text", "d.astrea")}${f("facebook", "Facebook (nombre de la página)", "text", "D Astrea")}</div>
        <div class="row2">${f("ciudad", "Ciudad que aparece abajo", "text", "Nuevo León, México")}${f("responsable", "Nombre o razón social (para el aviso de privacidad)", "text", "")}</div>
        <button class="btn ghost sm" data-testwa>${ic("Chat")} Probar WhatsApp</button></div>
      <div class="card" id="ce"><h3>Envíos y cambios</h3>
        <div class="row3">${f("envio", "Costo de envío (MXN)", "number")}${f("envioGratis", "Envío gratis desde (MXN)", "number")}${f("diasCambio", "Días para cambios", "number")}</div>
        ${f("diasEnvio", "Tiempo de envío", "text", "3 a 6 días hábiles")}</div>`;
  }
  vContacto.after = () => {
    $("#main").addEventListener("input", (e) => { const el = e.target.closest("[data-c]"); if (!el) return; cat.ajustes[el.dataset.c] = el.type === "number" ? Math.max(0, Number(el.value) || 0) : el.dataset.c === "whatsapp" ? el.value.replace(/\D/g, "") : el.value; dirty(); });
    $("#main").onclick = (e) => { if (e.target.closest("[data-testwa]")) window.open(`https://wa.me/${cat.ajustes.whatsapp}?text=${encodeURIComponent("Prueba de la tienda D’Astrea 🦉")}`, "_blank"); };
  };

  /* ================= POLÍTICAS ================= */
  function vLegal() {
    const L = cat.ajustes.legal;
    return `<div class="h"><div><h2>Políticas</h2><p>Textos legales de la tienda. Usa <b>## </b> al inicio de una línea para un subtítulo. Puedes usar {correo}, {responsable}, {envio}, {envioGratis}, {diasEnvio} y {diasCambio}: se llenan solos.</p></div></div>
      <div class="note">${ic("Candado")}<span>Son textos base pensados para México (LFPDPPP y Profeco). Revísalos con tu contador o abogado antes de vender en grande.</span></div>
      <div id="lbox">${Object.entries(L).map(([k, v]) => `<div class="card" data-lk="${k}"><label class="fld"><span>Título</span><input data-k="titulo" value="${E(v.titulo)}"></label><label class="fld"><span>Texto</span><textarea class="big" data-k="texto">${E(v.texto)}</textarea></label></div>`).join("")}</div>`;
  }
  vLegal.after = () => $("#lbox").addEventListener("input", (e) => { const el = e.target.closest("[data-k]"); if (!el) return; cat.ajustes.legal[el.closest("[data-lk]").dataset.lk][el.dataset.k] = el.value; dirty(); });

  /* ================= LISTAS ================= */
  function vListas() { return `<div class="h"><div><h2>Listas de regalo</h2><p>Todas las listas que han creado tus clientes. Útil para preparar pedidos o ayudar a alguien con su lista.</p></div><button class="btn ghost" data-rel>${ic("Cambios")} Actualizar</button></div><div class="lst" id="lsts"><p class="muted">Cargando…</p></div>`; }
  vListas.after = async () => {
    $("#main").onclick = (e) => { if (e.target.closest("[data-rel]")) render(); const d = e.target.closest("[data-dell]"); if (d && confirm("¿Borrar esta lista? Ya no podrán verla.")) api("/lists/" + d.dataset.dell, { method: "DELETE", headers: { "content-type": "application/json" }, body: "{}" }).then(() => { toast("Lista borrada"); render(); }).catch((x) => toast(x.message, true)); };
    let lists = [];
    try { lists = demo ? Object.values(DA.ls.get("dastrea_demo_lists", {})) : (await api("/lists")).lists; } catch (e) { $("#lsts").innerHTML = `<p class="muted">No se pudieron cargar: ${E(e.message)}</p>`; return; }
    const base = location.origin + location.pathname.replace(/admin\/?(index\.html)?$/, "");
    $("#lsts").innerHTML = lists.length ? lists.map((l) => `<div class="li"><b>${E(l.nombre)}</b><span class="mono">${E(l.ocasion || "")}${l.fecha ? " · " + E(l.fecha) : ""} · creada ${new Date(l.creada).toLocaleDateString("es-MX")} · ${l.items.length} prendas</span>
      ${l.mensaje ? `<span class="muted" style="font-size:13.5px">“${E(l.mensaje)}”</span>` : ""}
      <div class="mini">${l.items.map((i) => { const p = cat._p[i.pid]; return `<span class="tag ${(i.comprados || 0) >= i.q ? "ok" : ""}">${E(p ? p.nombre : i.pid)} · ${E((cat._g[i.prenda] || {}).corto || "")} · ${E((cat._k[i.color] || {}).nombre || "")} · ${E(i.talla)}${(i.comprados || 0) >= i.q ? " ✓" : ""}</span>`; }).join("")}</div>
      <div class="mini"><a class="btn sm ghost" href="${base}#lista=${l.id}" target="_blank" rel="noopener">${ic("Ver")} Abrir</a><button class="btn sm danger" data-dell="${l.id}">${ic("Basura")} Borrar</button></div></div>`).join("") : `<p class="muted">Todavía no hay listas.</p>`;
  };

  /* ================= LISTA DE ESPERA ================= */
  function vEspera() { return `<div class="h"><div><h2>Lista de espera</h2><p>Correos y WhatsApp de quien pidió aviso del próximo drop.</p></div><div class="bar"><button class="btn ghost" data-csv>${ic("Copiar")} Descargar CSV</button></div></div><div id="subs"><p class="muted">Cargando…</p></div>`; }
  vEspera.after = async () => {
    let subs = [];
    try { subs = demo ? [] : (await api("/subs")).subs; } catch (e) { $("#subs").innerHTML = `<p class="muted">${E(e.message)}</p>`; return; }
    $("#subs").innerHTML = subs.length ? `<div class="wrapT"><table class="t"><tr><th>Contacto</th><th>Fecha</th></tr>${subs.slice().reverse().map((s) => `<tr><td>${E(s.contacto)}</td><td>${new Date(s.fecha).toLocaleString("es-MX")}</td></tr>`).join("")}</table></div>` : `<p class="muted">${demo ? "Disponible cuando la tienda esté en línea." : "Aún no hay registros."}</p>`;
    $("#main").onclick = (e) => { if (e.target.closest("[data-csv]")) { const csv = "contacto,fecha\n" + subs.map((s) => `"${s.contacto.replace(/"/g, '""')}",${s.fecha}`).join("\n"); dl(new Blob(["﻿" + csv], { type: "text/csv" }), "lista-de-espera.csv"); } };
  };

  /* ================= RESPALDOS ================= */
  function dl(blob, name) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function vRespaldo() {
    return `<div class="h"><div><h2>Respaldos</h2><p>Cada vez que guardas se hace un respaldo automático (se conservan los últimos 10).</p></div></div>
      <div class="card"><h3>Copia en tu computadora</h3><p class="muted" style="margin-bottom:12px">Descarga todo el catálogo en un archivo. Si algo sale mal, lo puedes volver a subir.</p>
        <div class="bar"><button class="btn ghost" data-exp>${ic("Copiar")} Descargar respaldo</button><label class="btn ghost">${ic("Imagen")} Subir respaldo<input type="file" accept="application/json,.json" id="impf" hidden></label></div></div>
      <div class="card"><h3>Respaldos automáticos</h3><div id="bks"><p class="muted">${demo ? "Disponible cuando la tienda esté en línea." : "Cargando…"}</p></div></div>
      <div class="card"><h3>Empezar de cero</h3><p class="muted" style="margin-bottom:12px">Regresa el catálogo al original con el que se entregó la tienda.</p><button class="btn danger" data-seed>Restaurar catálogo original</button></div>`;
  }
  vRespaldo.after = async () => {
    $("#main").onclick = async (e) => {
      if (e.target.closest("[data-exp]")) dl(new Blob([JSON.stringify(DA.strip(cat), null, 1)], { type: "application/json" }), `dastrea-catalogo-${new Date().toISOString().slice(0, 10)}.json`);
      if (e.target.closest("[data-seed]") && confirm("¿Regresar al catálogo original? Perderás tus cambios (después de guardar).")) { cat = DA.normalize(window.DASTREA_SEED); dirty(); toast("Catálogo original cargado. Toca Guardar para aplicarlo."); }
      const r = e.target.closest("[data-rb]"); if (r && confirm("¿Restaurar este respaldo? Reemplaza el catálogo actual.")) { try { await api("/backups?key=" + encodeURIComponent(r.dataset.rb), { method: "POST" }); cat = await DA.loadCatalog(); saved = strip(cat); dirty(); toast("Respaldo restaurado"); render(); } catch (x) { toast(x.message, true); } }
    };
    $("#impf").addEventListener("change", async (e) => { const f = e.target.files[0]; if (!f) return; try { const j = JSON.parse(await f.text()); if (!j.productos || !j.ajustes) throw new Error("Este archivo no es un respaldo de D’Astrea"); cat = DA.normalize(j); dirty(); toast("Respaldo cargado. Toca Guardar para aplicarlo."); } catch (x) { toast(x.message, true); } });
    if (demo) return;
    try { const { backups } = await api("/backups"); $("#bks").innerHTML = backups.length ? `<div class="lst">${backups.map((k) => `<div class="li" style="grid-template-columns:1fr auto;display:grid;align-items:center"><span>${new Date(k.slice(7).replace(/-(\d\d)-(\d\d)-(\d{3})Z$/, ":$1:$2.$3Z").replace(/T(\d\d)-/, "T$1:")).toLocaleString("es-MX")}</span><button class="btn sm ghost" data-rb="${E(k)}">Restaurar</button></div>`).join("")}</div>` : `<p class="muted">Todavía no hay respaldos. Se crean al guardar.</p>`; }
    catch (e) { $("#bks").innerHTML = `<p class="muted">${E(e.message)}</p>`; }
  };
})();
