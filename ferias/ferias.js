/* GIABA instalable · sección FERIAS: la parte de la vendedora (y de Lucas / Adriana cuando atienden): elegir el puesto, caja inicial, cobrar,
   deshacer, ver el total y cerrar (lo que volvió + el efectivo) en un solo envío. Todo queda primero en el celu y se manda solo. */
(function () {
  var A = self.App, $ = function (id) { return document.getElementById(id); };
  var MEDIOS_DEF = ["Efectivo", "Transferencia", "QR / MP", "Débito", "Crédito"];
  var MONTO_ALTO = 200000;
  var SES = null, EST = null, MIS = [], MEDIOS = MEDIOS_DEF, MONTO = "", MEDIO = "", MODO = "cobro", ALTO = 0, FS = null, VOL = {}, CONTADO = "", cerrando = false;

  $("modulo").innerHTML = [
    '<section id="s-puestos" hidden><div class="top"><h1>¿Dónde atendés hoy?</h1><span class="yo" id="puYo"></span></div><div id="puLista" class="lista"><p class="hint">Buscando las ferias de hoy…</p></div>',
    '<button class="btn" id="puSalir" style="margin-top:18px">Salir (entrar con otro nombre)</button></section>',
    '<section id="s-cobrar" hidden><div class="top"><button class="btn chico" id="coPuestos">‹</button><h1 id="coTit"></h1><span class="estado ok" id="coSync">✓</span></div>',
    '<div class="total"><div><span>VENDIDO HOY</span><br><b id="coTotal">$ 0,00</b></div><button class="btn chico" id="coVer">Ver cobros ›</button></div>',
    '<div class="card" id="coApertura" hidden style="margin-top:10px"><b>Antes de cobrar: ¿con cuánto cambio arrancás?</b><p class="hint">Tipeá la plata de la billetera y tocá «Guardar caja inicial».</p></div>',
    '<div class="monto" id="coMonto">$ 0,00</div>',
    '<div class="medios" id="coMedios"></div>',
    '<div class="teclado" id="coTec"></div>',
    '<button class="btn pri" id="coOk" style="margin-top:10px">Cobrar</button>',
    '<button class="btn peli" id="coCerrar" style="margin-top:18px">Terminar la feria</button></section>',
    '<section id="s-cobros" hidden><div class="top"><button class="btn chico" id="lsAtras">‹ Atrás</button><h1>Cobros de hoy</h1></div><div class="card" id="lsLista"></div></section>',
    '<section id="s-volvio" hidden><div class="top"><button class="btn chico" id="voAtras">‹ Atrás</button><h1>¿Qué volvió?</h1></div>',
    '<p class="hint">Bajá lo que vendiste. Lo que queda es lo que vuelve.</p><div class="card" id="voLista"></div>',
    '<button class="btn pri" id="voOk" style="margin-top:12px">Seguir: contar el efectivo</button></section>',
    '<section id="s-efectivo" hidden><div class="top"><button class="btn chico" id="efAtras">‹ Atrás</button><h1>Contá el efectivo</h1></div>',
    '<div class="total"><div><span>TIENE QUE HABER</span><br><b id="efEsp"></b></div></div>',
    '<div class="monto" id="efMonto">$ 0,00</div><div class="teclado" id="efTec"></div><p class="hint" id="efDif" style="text-align:center"></p>',
    '<textarea id="efNota" rows="2" placeholder="Si hay diferencia, contá por qué (ej.: pagué bolsas)"></textarea>',
    '<button class="btn pri" id="efCerrar" style="margin-top:10px">Cerrar la feria</button></section>',
    '<section id="s-cerrada" hidden><div class="top"><h1 id="ceTit">Feria cerrada ✓</h1></div><div class="card"><p id="ceTxt"></p><span class="estado" id="ceSync"></span></div>',
    '<button class="btn" id="cePuestos" style="margin-top:12px">Ir a otra feria</button></section>'
  ].join("");

  function clave() { return SES ? SES.fecha + "|" + SES.feria + "|" + (SES.ubicacion || "") : ""; }
  function guardarMis() { return Cola.set("mis|" + clave(), MIS); }
  function nombre() { return A.pase.nombre; }

  // ---- puestos de hoy ----
  function puestos() {
    A.ver("s-puestos"); $("puYo").textContent = nombre();
    Cola.get("ferias").then(function (L) { if (L) pintarPuestos(L); });
    A.rpc("vf_mis_ferias", {}).then(function (r) { if (r && r.status === "ok") { Cola.set("ferias", r.ferias); pintarPuestos(r.ferias); } }, function () {
      if (!$("puLista").querySelector("[data-i]")) $("puLista").innerHTML = '<p class="hint">Sin señal: no pude traer las ferias de hoy.</p>';
    });
  }
  var LP = [];
  function pintarPuestos(L) {
    var hoy = A.hoy(); LP = (L || []).filter(function (x) { return x.fecha === hoy; });
    var mias = LP.filter(function (x) { return x.mia; }), otras = LP.filter(function (x) { return !x.mia; });
    var b = function (x) { var i = LP.indexOf(x); return '<button class="btn' + (x.mia ? " mia" : "") + '" data-i="' + i + '">' + A.esc(x.ubicacion || x.feria)
      + "<small>" + A.esc(x.feria) + (x.desde ? " · " + x.desde + " a " + x.hasta + " h" : "") + (x.cerrada ? " · ya cerrada" : "") + "</small></button>"; };
    $("puLista").innerHTML = (mias.length ? '<div class="ey">Tus ferias de hoy</div>' + mias.map(b).join("") : '<p class="hint">Hoy no tenés ferias en el calendario.</p>')
      + (otras.length ? '<div class="ey">Otras ferias de hoy</div>' + otras.map(b).join("") : "");
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
      $("coTit").textContent = SES.ubicacion || SES.feria;
      MONTO = ""; MEDIO = ""; ALTO = 0; pintarMedios(); pintarMonto(); A.ver("s-cobrar"); pintarTotal();
      refrescar();
    });
    A.gas("vfConfig").then(function (r) { if (r && r.status === "ok" && r.mediosPago && r.mediosPago.length) { MEDIOS = r.mediosPago; Cola.set("medios", MEDIOS); pintarMedios(); } }, function () {});
  }
  function refrescar() {
    if (!SES) return Promise.resolve();
    return A.rpc("vf_estado_puesto", { p_feria: SES.feria, p_ubicacion: SES.ubicacion || "", p_prueba: A.prueba }).then(function (r) {
      if (!r || r.status !== "ok") return;
      EST = r; Cola.set("estado|" + clave(), r); pintarTotal();
      if (r.cerrada && !$("s-cobrar").hidden) { Cola.set("cerrada|" + clave(), true); mostrarCerrada(); }
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
      $("coVer").textContent = n + " cobro" + (n === 1 ? "" : "s") + " ›";
      var s = $("coSync"); s.textContent = P.length ? "⏳ " + P.length + " sin mandar" : "✓ todo mandado"; s.className = "estado " + (P.length ? "pend" : "ok");
      MODO = ap ? "cobro" : "apertura";
      $("coApertura").hidden = MODO !== "apertura"; $("coMedios").hidden = MODO === "apertura";
      $("coOk").textContent = MODO === "apertura" ? "Guardar caja inicial" : ALTO ? "Sí, cobrar " + A.plata(ALTO) : "Cobrar";
    });
  }
  function pintarMedios() {
    $("coMedios").innerHTML = MEDIOS.map(function (m) { return '<button data-m="' + A.esc(m) + '" class="' + (m === MEDIO ? "on" : "") + '">' + A.esc(m) + "</button>"; }).join("");
  }
  function pintarMonto() { $("coMonto").textContent = A.plata(Number(MONTO) || 0); }
  function teclado(id, f) {
    $(id).innerHTML = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "000", "0", "⌫"].map(function (k) { return '<button data-k="' + k + '">' + k + "</button>"; }).join("");
    $(id).addEventListener("click", function (e) { var b = e.target.closest("[data-k]"); if (b) f(b.dataset.k); });
  }
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
          + (puede ? '<button class="btn chico" data-a="' + A.esc(m.id) + '">Deshacer</button>' : "") + "</div>";
      }).join("") : '<p class="hint">Todavía no hay cobros hoy en este puesto.</p>';
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
  $("lsAtras").addEventListener("click", function () { A.ver("s-cobrar"); pintarTotal(); });

  // ---- terminar: qué volvió ----
  $("coCerrar").addEventListener("click", function () {
    A.ver("s-volvio"); $("voLista").innerHTML = '<p class="hint">Trayendo lo que se llevó…</p>';
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
  $("voAtras").addEventListener("click", function () { A.ver("s-cobrar"); pintarTotal(); });
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
    $("efMonto").textContent = A.plata(c);
    $("efDif").textContent = CONTADO === "" ? "" : d === 0 ? "✓ Da justo" : d > 0 ? "Sobran " + A.plata(d) : "Faltan " + A.plata(-d);
  }
  teclado("efTec", function (k) { if (k === "⌫") CONTADO = CONTADO.slice(0, -1); else if ((CONTADO + k).length <= 9) CONTADO = (CONTADO + k).replace(/^0+(?=\d)/, ""); pintarEf(); });
  $("efAtras").addEventListener("click", function () { if (FS && FS.llevado && FS.llevado.length) A.ver("s-volvio"); else { A.ver("s-cobrar"); pintarTotal(); } });
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
      s.className = "estado " + (P.length ? "pend" : "ok");
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
