/* GIABA instalable (un solo ícono) · lo común: entrar con el PIN, el pase, la cola y qué sección baja cada uno.
   Cada rol baja SOLO su parte. Primera sección: Ferias (ferias/ferias.js) para vendedoras y Lucas / Adriana.
   Lo que todavía no está acá sigue en la app de siempre (link «GIABA completa»). */
(function () {
  var G = self.GIABA, $ = function (id) { return document.getElementById(id); };
  var A = self.App = { pase: null, prueba: false };
  var PANTALLAS = ["s-cargando", "s-nombres", "s-pin", "s-sinacceso"];

  A.ver = function (id) {
    PANTALLAS.forEach(function (p) { $(p).hidden = p !== id; });
    Array.prototype.forEach.call(document.querySelectorAll("#modulo > section"), function (s) { s.hidden = s.id !== id; });
    window.scrollTo(0, 0);
  };
  var tt = null;
  A.toast = function (t, mal) { var e = $("toast"); e.textContent = t; e.className = "on" + (mal ? " mal" : ""); clearTimeout(tt); tt = setTimeout(function () { e.className = ""; }, 3200); };
  A.plata = function (n) { n = Number(n) || 0; return "$ " + n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  A.hoy = function () { var d = new Date(); return ("0" + d.getDate()).slice(-2) + "/" + ("0" + (d.getMonth() + 1)).slice(-2) + "/" + d.getFullYear(); };
  A.esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  // Google (Apps Script): solo para entrar y para la lista de nombres / medios. Texto plano = sin «preflight».
  A.gas = function (fn, args) {
    return fetch(G.GAS, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ fn: fn, args: args || [] }), redirect: "follow" })
      .then(function (r) { if (!r.ok) throw new Error("Google respondió " + r.status); return r.json(); });
  };
  A.rpc = function (fn, body, ms) {
    if (!A.pase) return Promise.reject(new Error("sin pase"));
    return Cola.rpc(A.pase, fn, body, ms).then(function (j) {
      if (j && j.status === "token") { A.salir("Tu sesión venció: entrá de nuevo con tu PIN"); throw new Error("pase vencido"); }
      return j;
    });
  };
  // guardar algo para mandar (cobro, anulación, cierre): primero queda en el celu, después se manda
  A.mandar = function (fn, args, uid) {
    var it = { uid: uid, fn: fn, args: args, prueba: A.prueba, t: Date.now() };
    return Cola.encolar(it).then(function () { A.empujar(); return it; });
  };
  A.empujar = function () {
    var p = Cola.mandarCola().then(function (r) {
      if (r && r.pase === "vencido") A.salir("Tu sesión venció: entrá de nuevo con tu PIN");
      if (A.alMandar) A.alMandar(r);
      return r;
    });
    // si se corta antes, el teléfono lo manda solo cuando vuelve la señal (aunque cierren la app)
    try { navigator.serviceWorker && navigator.serviceWorker.ready.then(function (reg) { return reg.sync && reg.sync.register("cola"); }).catch(function () {}); } catch (e) {}
    return p;
  };
  A.salir = function (msg) {
    A.pase = null;
    Cola.set("pase", null).then(function () { if (msg) A.toast(msg, true); nombres(); });
  };

  // ---- entrar ----
  function nombres() {
    A.ver("s-nombres");
    var pintar = function (L) {
      $("nomLista").innerHTML = (L || []).map(function (n) { return '<button class="btn" data-n="' + A.esc(n) + '">' + A.esc(n) + "</button>"; }).join("");
      $("nomHint").textContent = L && L.length ? "" : "Necesito señal la primera vez para traer los nombres.";
    };
    Cola.get("nombres").then(function (L) { if (L) pintar(L); });
    A.gas("vfNombres").then(function (r) { if (r && r.status === "ok") { Cola.set("nombres", r.nombres); pintar(r.nombres); } }, function () {});
  }
  $("nomLista").addEventListener("click", function (e) { var b = e.target.closest("[data-n]"); if (b) pedirPin(b.dataset.n); });
  var PIN = "", QUIEN = "";
  function pedirPin(n) {
    QUIEN = n; PIN = ""; $("pinNombre").textContent = n; $("pinMsg").textContent = ""; puntos(); A.ver("s-pin");
  }
  function puntos() { $("pinPuntos").innerHTML = [0, 1, 2, 3].map(function (i) { return '<i class="' + (i < PIN.length ? "on" : "") + '"></i>'; }).join(""); }
  $("pinTec").innerHTML = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map(function (k) { return k ? '<button data-k="' + k + '">' + k + "</button>" : "<span></span>"; }).join("");
  $("pinTec").addEventListener("click", function (e) {
    var b = e.target.closest("[data-k]"); if (!b) return;
    if (b.dataset.k === "⌫") PIN = PIN.slice(0, -1); else if (PIN.length < 4) PIN += b.dataset.k;
    puntos(); if (PIN.length === 4) setTimeout(probarPin, 150);
  });
  $("pinAtras").addEventListener("click", nombres);
  var probando = false;
  function probarPin() {
    if (probando || PIN.length < 4) return; probando = true;
    $("pinMsg").textContent = "Entrando…";
    A.gas("vfEntrar", [QUIEN, PIN]).then(function (r) {
      probando = false;
      if (r && r.status === "ok") { A.pase = r; Cola.set("pase", r).then(arrancar); return; }
      PIN = ""; puntos();
      if (r && r.status === "sinacceso") { sinAcceso(r.msg); return; }
      $("pinMsg").textContent = (r && r.msg) || "No se pudo entrar";
    }, function () { probando = false; $("pinMsg").textContent = "Sin señal: para entrar la primera vez hace falta internet."; });
  }
  function sinAcceso(msg) {
    $("saTxt").textContent = msg || "Esta app es para cobrar en las ferias. Lo tuyo está en la app de siempre.";
    $("saLink").href = G.APP_COMPLETA; A.ver("s-sinacceso");
  }
  $("saSalir").addEventListener("click", function () { A.salir(); });

  // ---- cada rol baja su parte ----
  // sección → archivo. Por rol, qué secciones tiene (la primera es la que abre). Las que faltan se suman acá.
  var SECCIONES = { ferias: "ferias/ferias.js" };
  var ROLES = { vendedora: ["ferias"], admin: ["ferias"] };
  A.cargar = function (sec) {
    self.Secciones = self.Secciones || {};
    if (self.Secciones[sec]) { self.Secciones[sec].iniciar(); return; }
    var s = document.createElement("script"); s.src = SECCIONES[sec];
    s.onload = function () { self.Secciones[sec].iniciar(); };
    s.onerror = function () { A.toast("No se pudo abrir la app: probá de nuevo", true); };
    document.body.appendChild(s);
  };
  function arrancar() {
    var L = ROLES[A.pase.rol || "vendedora"] || [];
    if (!L.length) { sinAcceso(); return; }
    A.cargar(L[0]);
  }

  // ---- al abrir ----
  function prueba() {
    var q = new URLSearchParams(location.search);
    var p = q.get("prueba") === "1" ? Promise.resolve(true).then(function (v) { return Cola.set("prueba", true).then(function () { return v; }); })
      : q.get("prueba") === "0" ? Cola.set("prueba", null).then(function () { return false; })
      : Cola.get("prueba").then(function (v) { return !!v; });
    return p.then(function (v) { A.prueba = v; $("banPrueba").hidden = !v; });
  }
  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(function () {});
  window.addEventListener("online", function () { if (A.pase) A.empujar(); });
  prueba().then(function () { return Cola.get("pase"); }).then(function (p) {
    if (p && p.token && p.vence * 1000 > Date.now() + 3600000) { A.pase = p; arrancar(); A.empujar(); }
    else nombres();
  }, function () { nombres(); });
})();
