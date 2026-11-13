/* GIABA instalable · sección FERIAS: la parte de la vendedora (y de Lucas / Adriana cuando atienden): elegir el puesto, caja inicial, cobrar,
   deshacer, ver el total y cerrar (lo que volvió + el efectivo) en un solo envío. Todo queda primero en el celu y se manda solo. */
(function () {
  var A = self.App, $ = function (id) { return document.getElementById(id); };
  var MEDIOS_DEF = ["Efectivo", "Transferencia", "QR / MP", "Débito", "Crédito"];
  var MONTO_ALTO = 200000;
  var SES = null, EST = null, MIS = [], MEDIOS = MEDIOS_DEF, MONTO = "", MEDIO = "", MODO = "cobro", ALTO = 0, FS = null, VOL = {}, CONTADO = "", cerrando = false;

  // las mismas pantallas (clases y estilo) que la app de Ferias de siempre (Index.html v3f)
  $("modulo").innerHTML = [
    '<div id="s-puestos" class="screen" hidden><div class="topbar"><div class="pills"><span class="pill" id="puYo"></span></div></div>',
    '<div style="display:flex;flex-direction:column;gap:6px"><span class="eyebrow">Arrancar feria</span><h1>¿Dónde atendés hoy?</h1></div>',
    '<div id="puLista" style="display:flex;flex-direction:column;gap:10px"><div class="empty">Buscando las ferias de hoy…</div></div><div class="spacer"></div>',
    '<div class="btn2" id="puSalir" role="button">Salir (entrar con otro nombre)</div></div>',
    '<div id="loop" class="screen" hidden><div class="topbar"><button class="back" id="coPuestos" data-lbl="Ferias" aria-label="Volver"></button>',
    '<div class="pills"><span class="pill s2" id="coTit"></span></div></div>',
    '<div class="total-card"><div class="left"><span class="k" id="coK">VENDIDO HOY</span><span class="v" id="coTotal">$ 0</span></div>',
    '<div class="right"><span class="sync ok" id="coSync"></span><span class="count" role="button" id="coVer">Ver cobros ›</span></div></div>',
    '<div class="sync-banner" id="coApertura" hidden>Antes de cobrar: ¿con cuánto cambio arrancás? Tipeá la plata de la billetera y tocá «Guardar caja inicial».</div>',
    '<div class="amount zero" id="coMonto">$ 0,00</div>',
    '<div class="keypad grow" id="coTec"></div>',
    '<div class="lbl3" id="payLbl">¿Cómo paga?</div><div class="pay-grid" id="coMedios"></div>',
    '<div class="accept-btn" id="coOk" role="button">Aceptar</div>',
    '<div class="btn-red-o" id="coCerrar" role="button">🔒 Terminar la feria</div></div>',
    '<div id="s-cobros" class="screen" hidden><div class="topbar"><button class="back" id="lsAtras" data-lbl="Cobrar" aria-label="Volver"></button></div><h1>Cobros de hoy</h1><div class="card" id="lsLista"></div></div>',
    '<div id="s-volvio" class="screen" hidden><div class="topbar"><button class="back" id="voAtras" data-lbl="Cobrar" aria-label="Volver"></button></div>',
    '<h1>¿Qué volvió?</h1><div class="sub">Bajá lo que vendiste. Lo que queda es lo que vuelve.</div><div class="card" id="voLista"></div><div class="spacer"></div>',
    '<div class="btn" id="voOk" role="button">Seguir: contar el efectivo</div></div>',
    '<div id="s-efectivo" class="screen" hidden><div class="topbar"><button class="back" id="efAtras" data-lbl="Atrás" aria-label="Volver"></button></div>',
    '<h1>Contá el efectivo</h1><div class="card"><div class="r"><span>Tiene que haber</span><b id="efEsp"></b></div></div>',
    '<div class="amount zero" id="efMonto">$ 0</div><div class="pin-error" id="efDif" style="color:var(--ink-soft)"></div><div class="keypad grow" id="efTec"></div>',
    '<textarea id="efNota" rows="2" placeholder="Si hay diferencia, contá por qué (ej.: pagué bolsas)" style="background:var(--surface);color:var(--ink);border:1.5px solid var(--line);border-radius:12px;padding:10px;font-family:inherit"></textarea>',
    '<div class="btn-red" id="efCerrar" role="button">🔒 Cerrar la feria</div></div>',
    '<div id="s-cerrada" class="screen" hidden><div class="topbar"></div><h1 id="ceTit">Feria cerrada ✓</h1><div class="card"><span id="ceTxt"></span><span class="sync" id="ceSync"></span></div>',
    '<div class="spacer"></div><div class="btn2" id="cePuestos" role="button">Ir a otra feria</div></div>'
  ].join("");

  function clave() { return SES ? SES.fecha + "|" + SES.feria + "|" + (SES.ubicacion || "") : ""; }
  function guardarMis() { return Cola.set("mis|" + clave(), MIS); }
  function nombre() { return A.pase.nombre; }

  // ---- puestos de hoy ----
  function puestos() {
    A.ver("s-puestos"); $("puYo").textContent = nombre();
    Cola.get("ferias").then(function (L) { if (L) pintarPuestos(L); });
    var t = Date.now();
    A.rpc("vf_mis_ferias", {}).then(function (r) { A.log("base: ferias de hoy", r && r.status, Date.now() - t, !!(r && r.status === "ok")); if (r && r.status === "ok") { Cola.set("ferias", r.ferias); pintarPuestos(r.ferias); } }, function (e) {
      A.log("base: ferias de hoy falló", e && e.message, Date.now() - t, false); A.logMandar();
      if (!$("puLista").querySelector("[data-i]")) $("puLista").innerHTML = '<div class="empty">No pude traer las ferias de hoy (' + A.esc(e && e.message || "sin señal") + '). Probá de nuevo en un rato.</div>';
    });
  }
  var LP = [];
  function pintarPuestos(L) {
    var hoy = A.hoy(); LP = (L || []).filter(function (x) { return x.fecha === hoy; });
    var mias = LP.filter(function (x) { return x.mia; }), otras = LP.filter(function (x) { return !x.mia; });
    var b = function (x) { var i = LP.indexOf(x); return '<div class="choice-btn' + (x.mia ? " mia" : "") + '" role="button" data-i="' + i + '">' + A.esc(x.ubicacion || x.feria)
      + "<small>" + A.esc(x.feria) + (x.desde ? " · " + x.desde + " a " + x.hasta + " h" : "") + (x.cerrada ? " · ya cerrada" : "") + "</small></div>"; };
    $("puLista").innerHTML = (mias.length ? '<span class="ey">Tus ferias de hoy</span>' + mias.map(b).join("") : '<div class="empty">Hoy no tenés ferias en el calendario.</div>')
      + (otras.length ? '<span class="ey" style="margin-top:8px">Otras ferias de hoy</span>' + otras.map(b).join("") : "");
  }
  $("puLista").addEventListener("click", function (e) {
    var bt = e.target.closest("[data-i]"); if (!bt) return; var x = LP[+bt.dataset.i];
    SES = { fecha: x.fecha, feria: x.feria, ubicacion: x.ubicacion };
    Cola.set("sesion", SES).then(abrirPuesto);
  });
  $("puSalir").addEventListener("click", function () { Cola.set("sesion", null).then(function () { A.salir(); }); });

  // ---- cobrar ----
  function abrirPuesto() {
    Promise.all([Cola.get("mis|" + clave()), Cola.get("estado|" + clave()), Cola.get("cerrada|" + clave()), Cola.get("medios")]).then(function (v) {
      MIS = v[0] || []; EST = v[1] || null; MEDIOS = v[3] || MEDIOS_DEF;
      if (v[2]) { mostrarCerrada(); return; }
      $("coTit").textContent = nombre() + " · " + (SES.ubicacion || SES.feria);
      MONTO = ""; MEDIO = ""; ALTO = 0; pintarMedios(); pintarMonto(); A.ver("loop"); pintarTotal();
      refrescar();
    });
    A.gas("vfConfig").then(function (r) { if (r && r.status === "ok" && r.mediosPago && r.mediosPago.length) { MEDIOS = r.mediosPago; Cola.set("medios", MEDIOS); pintarMedios(); } }, function () {});
  }
  function refrescar() {
    if (!SES) return Promise.resolve();
    return A.rpc("vf_estado_puesto", { p_feria: SES.feria, p_ubicacion: SES.ubicacion || "", p_prueba: A.prueba }).then(function (r) {
      if (!r || r.status !== "ok") return;
      EST = r; Cola.set("estado|" + clave(), r); pintarTotal();
      if (r.cerrada && !$("loop").hidden) { Cola.set("cerrada|" + clave(), true); mostrarCerrada(); }
    }, function () { pintarTotal(); });
  }
  A.alMandar = function () { if (!$("s-cerrada").hidden) mostrarCerrada(); else refrescar(); };
  function pendientes() {
    return Cola.cola().then(function (L) { return L.filter(function (it) {
      var a = it.args && it.args[0]; if (it.fn === "cerrarFeria") a = a && a.caja;
      return it.fn === "anularCobro" || !!a && a.feria === SES.feria && (a.ubicacion || "") === (SES.ubicacion || "");
    }); });
  }
  function pintarTotal() {
    if (!SES) return;
    pendientes().then(function (P) {
      var t = EST ? Number(EST.bruto) || 0 : 0, n = EST ? EST.cobros || 0 : 0, ap = EST ? (EST.aperturas || []).length : 0;
      P.forEach(function (it) {
        var a = it.args[0];
        if (it.fn === "appendCobro" && (a.tipo === "Cobro" || a.tipo === "Ajuste") && !P.some(function (x) { return x.fn === "anularCobro" && x.args[0] === it.uid; })) { t += a.monto; if (a.tipo === "Cobro") n++; }
        if (it.fn === "appendCobro" && a.tipo === "Apertura") ap++;
        if (it.fn === "anularCobro") { var c = MIS.concat(LS).filter(function (m) { return m.id === it.args[0]; })[0], enC = P.some(function (x) { return x.fn === "appendCobro" && x.uid === it.args[0]; }); if (c && !enC) { t -= c.monto; n--; } }
      });
      $("coTotal").textContent = A.plata(t);
      $("coK").textContent = "VENDIDO HOY" + (n ? " · " + n + " COBRO" + (n === 1 ? "" : "S") : "");
      var s = $("coSync"); s.textContent = P.length ? "⏳ " + P.length + " sin subir" : "✓ todo subido"; s.className = "sync " + (P.length ? "wait" : "ok");
      MODO = ap ? "cobro" : "apertura";
      $("coApertura").hidden = MODO !== "apertura"; $("coMedios").hidden = MODO === "apertura"; $("payLbl").hidden = MODO === "apertura";
      $("coOk").textContent = MODO === "apertura" ? "Guardar caja inicial" : ALTO ? "Sí, cobrar " + A.plata(ALTO) : "✓ Cobrar";
      $("coOk").classList.toggle("ready", !!Number(MONTO) && (MODO === "apertura" || !!MEDIO));
    });
  }
  function pintarMedios() {
    $("coMedios").innerHTML = MEDIOS.map(function (m) { return '<div role="button" data-m="' + A.esc(m) + '" class="pay-btn' + (m === MEDIO ? " active" : "") + '">' + A.esc(m) + "</div>"; }).join("");
    $("coOk").classList.toggle("ready", !!Number(MONTO) && (MODO === "apertura" || !!MEDIO));
  }
  function pintarMonto() { var n = Number(MONTO) || 0; $("coMonto").textContent = A.plata(n); $("coMonto").classList.toggle("zero", !n); }
  function teclado(id, f) { A.teclado($(id), ["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0", "000"], f); }
  teclado("coTec", function (k) {
    ALTO = 0;
    if (k === "⌫") MONTO = MONTO.slice(0, -1); else if ((MONTO + k).length <= 9) MONTO = (MONTO + k).replace(/^0+/, "");
    pintarMonto(); pintarTotal();
  });
  $("coMedios").addEventListener("click", function (e) { var b = e.target.closest("[data-m]"); if (!b) return; MEDIO = b.dataset.m; pintarMedios(); });
  $("coOk").addEventListener("click", function () {
    var n = Number(MONTO) || 0;
    if (!n) { A.toast("Tipeá el monto", true); return; }
    if (MODO === "apertura") { registrar({ monto: n, medioPago: "Efectivo", tipo: "Apertura", motivo: "caja inicial" }, "Caja abierta con " + A.plata(n)); return; }
    if (!MEDIO) { A.toast("Elegí cómo pagó", true); return; }
    if (n >= MONTO_ALTO && ALTO !== n) { ALTO = n; pintarTotal(); A.toast("Es mucha plata: revisá el monto y tocá de nuevo para confirmar"); return; }
    registrar({ monto: n, medioPago: MEDIO, tipo: "Cobro" }, A.plata(n) + " · " + MEDIO);
  });
  function registrar(p, msg) {
    var id = Date.now() + "-" + Math.floor(Math.random() * 10000), d = new Date();
    p.id = id; p.vendedor = nombre(); p.feria = SES.feria; p.ubicacion = SES.ubicacion || "";
    MIS.unshift({ id: id, monto: p.monto, medio: p.medioPago, tipo: p.tipo, hora: ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2) });
    guardarMis();
    A.mandar("appendCobro", [p], id).then(pintarTotal);
    MONTO = ""; MEDIO = ""; ALTO = 0; pintarMonto(); pintarMedios(); pintarTotal(); A.toast("✓ " + msg);
  }
  $("coPuestos").addEventListener("click", puestos);

  // ---- cobros de hoy (deshacer) · la misma lista que el total: la de la base + lo que todavía está en el celu ----
  var LS = [];
  function pintarLista(srv) {
    pendientes().then(function (P) {
      var enCola = {}, anulCola = {};
      P.forEach(function (it) { if (it.fn === "appendCobro") enCola[it.uid] = it; if (it.fn === "anularCobro") anulCola[it.args[0]] = 1; });
      MIS.forEach(function (m) { m.enBase = !enCola[m.id]; });
      var vistos = {}; LS = [];
      Object.keys(enCola).forEach(function (u) { var a = enCola[u].args[0], m = MIS.filter(function (x) { return x.id === u; })[0];
        LS.push({ id: u, monto: a.monto, medio: a.medioPago, tipo: a.tipo, hora: m ? m.hora : "", vendedor: a.vendedor, pend: true, anulado: !!(m && m.anulado) }); vistos[u] = 1; });
      (srv || []).forEach(function (it) { if (vistos[it.id]) return; vistos[it.id] = 1;
        LS.push({ id: it.id, monto: it.monto, medio: it.medio, tipo: it.tipo, hora: it.hora, vendedor: it.vendedor, anulado: it.anulado || !!anulCola[it.id] }); });
      if (!srv) MIS.forEach(function (m) { if (!vistos[m.id]) LS.push({ id: m.id, monto: m.monto, medio: m.medio, tipo: m.tipo, hora: m.hora, vendedor: nombre(), anulado: m.anulado }); });
      $("lsLista").innerHTML = LS.length ? LS.map(function (m) {
        var puede = !m.anulado && m.tipo === "Cobro" && (m.vendedor === nombre() || A.pase.admin);
        return '<div class="fila' + (m.anulado ? " anul" : "") + '"><div><b>' + A.plata(m.monto) + '</b><div class="s">' + A.esc(m.hora) + " · " + A.esc(m.tipo === "Apertura" ? "Caja inicial" : m.tipo === "Cobro" ? m.medio : m.tipo)
          + (m.vendedor && m.vendedor !== nombre() ? " · " + A.esc(m.vendedor) : "") + (m.pend ? " · sin mandar" : "") + "</div></div>"
          + (puede ? '<button class="chico" data-a="' + A.esc(m.id) + '">Deshacer</button>' : "") + "</div>";
      }).join("") : '<div class="empty">Todavía no hay cobros hoy en este puesto.</div>';
    });
  }
  $("coVer").addEventListener("click", function () {
    A.ver("s-cobros"); pintarLista(null);
    A.rpc("vf_historial_puesto", { p_feria: SES.feria, p_ubicacion: SES.ubicacion || "", p_prueba: A.prueba }).then(function (r) { if (r && r.status === "ok" && !$("s-cobros").hidden) pintarLista(r.items); }, function () {});
  });
  $("lsLista").addEventListener("click", function (e) {
    var b = e.target.closest("[data-a]"); if (!b) return;
    var m = LS.filter(function (x) { return x.id === b.dataset.a; })[0]; if (!m) return;
    var mm = MIS.filter(function (x) { return x.id === m.id; })[0]; if (mm) { mm.anulado = true; guardarMis(); }
    m.anulado = true;
    A.mandar("anularCobro", [m.id, "Deshacer"], "A|" + m.id).then(function () { A.toast("Deshecho: " + A.plata(m.monto)); $("coVer").click(); pintarTotal(); });
  });
  $("lsAtras").addEventListener("click", function () { A.ver("loop"); pintarTotal(); });

  // ---- terminar: qué volvió ----
  $("coCerrar").addEventListener("click", function () {
    A.ver("s-volvio"); $("voLista").innerHTML = '<div class="empty">Trayendo lo que se llevó…</div>';
    var listo = function (r) {
      FS = r && r.status === "ok" ? r : { llevado: [] };
      Cola.get("conteo|" + clave()).then(function (c) {
        VOL = c || {}; FS.llevado.forEach(function (it) { if (VOL[it.sku] === undefined) VOL[it.sku] = Number(it.cant) || 0; });
        if (!FS.llevado.length) { efectivo(); return; }
        pintarVolvio();
      });
    };
    A.rpc("vf_stock_puesto", { p_fecha: SES.fecha, p_feria: SES.feria, p_ubicacion: SES.ubicacion || "" }).then(function (r) { Cola.set("stock|" + clave(), r); listo(r); },
      function () { Cola.get("stock|" + clave()).then(listo); });
  });
  function pintarVolvio() {
    $("voLista").innerHTML = FS.llevado.map(function (it) {
      var v = VOL[it.sku], vend = (Number(it.cant) || 0) - v;
      return '<div class="fila"><div><b>' + A.esc(it.nombre) + '</b><div class="s">llevaste ' + it.cant + (vend ? " · vendiste " + vend : "") + '</div></div><div class="cont"><button data-s="' + A.esc(it.sku) + '" data-d="-1" aria-label="Menos">−</button><b>' + v + '</b><button data-s="' + A.esc(it.sku) + '" data-d="1" aria-label="Más">+</button></div></div>';
    }).join("");
  }
  $("voLista").addEventListener("click", function (e) {
    var b = e.target.closest("[data-s]"); if (!b) return;
    var it = FS.llevado.filter(function (x) { return x.sku === b.dataset.s; })[0];
    VOL[it.sku] = Math.max(0, Math.min(Number(it.cant) || 0, VOL[it.sku] + Number(b.dataset.d)));
    Cola.set("conteo|" + clave(), VOL); pintarVolvio();
  });
  $("voAtras").addEventListener("click", function () { A.ver("loop"); pintarTotal(); });
  $("voOk").addEventListener("click", function () {
    var llev = FS.llevado.reduce(function (a, it) { return a + (Number(it.cant) || 0); }, 0), vol = FS.llevado.reduce(function (a, it) { return a + VOL[it.sku]; }, 0);
    var cobros = (EST && EST.cobros) || MIS.filter(function (m) { return m.tipo === "Cobro" && !m.anulado; }).length;
    if (cobros > 0 && llev > 0 && vol >= llev) { A.toast("Hubo cobros: bajá lo que vendiste antes de seguir", true); return; }
    efectivo();
  });

  // ---- terminar: efectivo ----
  var ESP = 0;
  function efectivo() {
    pendientes().then(function (P) {
      ESP = EST ? Number(EST.efectivo) || 0 : 0;
      P.forEach(function (it) { var a = it.args[0]; if (it.fn === "appendCobro" && a.medioPago === "Efectivo") ESP += a.monto; });
      $("efEsp").textContent = A.plata(ESP); CONTADO = ""; pintarEf(); A.ver("s-efectivo");
    });
  }
  function pintarEf() {
    var c = Number(CONTADO) || 0, d = Math.round((c - ESP) * 100) / 100;
    $("efMonto").textContent = A.plata(c); $("efMonto").classList.toggle("zero", !c);
    $("efDif").textContent = CONTADO === "" ? "" : d === 0 ? "✓ Da justo" : d > 0 ? "Sobran " + A.plata(d) : "Faltan " + A.plata(-d);
  }
  teclado("efTec", function (k) { if (k === "⌫") CONTADO = CONTADO.slice(0, -1); else if ((CONTADO + k).length <= 9) CONTADO = (CONTADO + k).replace(/^0+(?=\d)/, ""); pintarEf(); });
  $("efAtras").addEventListener("click", function () { if (FS && FS.llevado && FS.llevado.length) A.ver("s-volvio"); else { A.ver("loop"); pintarTotal(); } });
  $("efCerrar").addEventListener("click", function () {
    if (cerrando) return;
    if (CONTADO === "") { A.toast("Contá el efectivo y poné el total", true); return; }
    var c = Number(CONTADO) || 0, d = Math.round((c - ESP) * 100) / 100, nota = $("efNota").value.trim();
    if (d !== 0 && !nota) { A.toast("Hay diferencia: contá por qué en la nota", true); $("efNota").focus(); return; }
    cerrando = true;
    var stock = FS && FS.llevado && FS.llevado.length && FS.estado !== "Cerrado"
      ? { fecha: SES.fecha, feria: SES.feria, ubicacion: SES.ubicacion || "", quien: nombre(), volvio: FS.llevado.map(function (it) { return { sku: it.sku, cant: VOL[it.sku] }; }) } : null;
    var caja = { fecha: SES.fecha, feria: SES.feria, ubicacion: SES.ubicacion || "", quien: nombre(), contado: c, nota: (d ? "Diferencia de caja: " + nota + "." : nota).trim() };
    A.mandar("cerrarFeria", [{ stock: stock, caja: caja }], "C|" + clave() + "|" + Date.now()).then(function () {
      cerrando = false;
      return Promise.all([Cola.set("cerrada|" + clave(), true), Cola.set("conteo|" + clave(), null)]);
    }).then(mostrarCerrada);
  });
  function mostrarCerrada() {
    A.ver("s-cerrada");
    $("ceTxt").textContent = (SES.ubicacion || SES.feria) + " · " + SES.fecha;
    pendientes().then(function (P) {
      var s = $("ceSync");
      s.textContent = P.length ? "⏳ Guardado en el celu: se manda solo apenas haya señal (aunque cierres la app)" : "✓ Mandado";
      s.className = "sync " + (P.length ? "wait" : "ok");
    });
  }
  $("cePuestos").addEventListener("click", function () { Cola.set("sesion", null).then(puestos); });

  // cada minuto, con la app a la vista: manda lo pendiente y trae el total
  setInterval(function () { if (document.visibilityState === "visible" && A.pase) A.empujar(); }, 60000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible" && A.pase) A.empujar(); });

  self.Secciones = self.Secciones || {};
  self.Secciones.ferias = {
    iniciar: function () {
      Cola.get("sesion").then(function (s) { if (s && s.fecha === A.hoy()) { SES = s; abrirPuesto(); } else puestos(); });
    }
  };
})();
