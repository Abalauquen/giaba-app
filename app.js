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
  A.gas = function (fn, args, ms) {
    ms = ms || self.GIABA_GAS_MS || 25000;
    var ctl = typeof AbortController === "function" ? new AbortController() : null, listo = false;
    return new Promise(function (ok, mal) {
      var tmo = setTimeout(function () { if (listo) return; listo = true; try { ctl && ctl.abort(); } catch (e) {} mal(new Error("Google no contestó en " + Math.round((ms || 25000) / 1000) + " s")); }, ms || 25000);
      fetch(G.GAS, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ fn: fn, args: args || [] }), redirect: "follow", cache: "no-store", signal: ctl ? ctl.signal : undefined })
        .then(function (r) { if (!r.ok) throw new Error("Google respondió " + r.status); return r.text(); })
        .then(function (t) { if (listo) return; listo = true; clearTimeout(tmo); try { ok(JSON.parse(t)); } catch (e) { mal(new Error("Google devolvió algo raro: " + String(t).slice(0, 60))); } },
              function (e) { if (listo) return; listo = true; clearTimeout(tmo); mal(e); });
    });
  };
  // registro de pasos (para ver dónde se traba un celu): consola + Tiempos_App (app «giaba-app»), de a tandas
  var LOG = [], T0 = Date.now();
  A.log = function (que, det, ms, okk) {
    var t = String(que) + (det ? ": " + String(det).slice(0, 200) : "");
    try { console.log("[giaba-app] " + t); } catch (e) {}
    LOG.push([t, ms === undefined ? Date.now() - T0 : ms, okk === false ? 0 : 1, Date.now(), 0]);
    if (LOG.length >= 15) A.logMandar();
  };
  A.logMandar = function () {
    if (!LOG.length) return; var l = LOG.splice(0, 40);
    var quien = (A.pase && A.pase.nombre) || QUIEN || "";
    A.gas("vfLog", [{ quien: quien, ua: navigator.userAgent.slice(0, 120), items: l }], 15000).catch(function () {});
  };
  setInterval(A.logMandar, 30000);
  window.addEventListener("pagehide", A.logMandar);
  window.addEventListener("error", function (ev) { A.log("ERROR JS", (ev && ev.message) + " @" + (ev && ev.lineno), 0, false); A.logMandar(); });
  window.addEventListener("unhandledrejection", function (ev) { var r = ev && ev.reason; A.log("ERROR promesa", r && r.message || r, 0, false); });
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
    $("pinMsg").textContent = "Entrando… (1 de 3: Google)";
    var t1 = Date.now(); A.log("entrar: pide el pase", QUIEN);
    A.gas("vfEntrar", [QUIEN, PIN]).then(function (r) {
      probando = false;
      A.log("entrar: Google contestó", r && r.status, Date.now() - t1, !!(r && r.status === "ok"));
      if (r && r.status === "ok") {
        A.pase = r; $("pinMsg").textContent = "Entrando… (2 de 3: guardando en el celu)";
        var t2 = Date.now();
        Cola.set("pase", r).then(function () { A.log("entrar: pase guardado", "", Date.now() - t2); }, function (e) { A.log("entrar: no se pudo guardar el pase", e && e.message, Date.now() - t2, false); })
          .then(function () { $("pinMsg").textContent = "Entrando… (3 de 3: tus ferias)"; arrancar(); A.logMandar(); });
        return;
      }
      PIN = ""; puntos();
      if (r && r.status === "sinacceso") { sinAcceso(r.msg); return; }
      $("pinMsg").textContent = (r && r.msg) || "No se pudo entrar";
    }, function (e) {
      probando = false; PIN = ""; puntos();
      A.log("entrar: falló", e && e.message, Date.now() - t1, false); A.logMandar();
      $("pinMsg").textContent = (e && /no contestó|respondió|raro/.test(e.message) ? e.message : "Sin señal: para entrar la primera vez hace falta internet") + ". Probá de nuevo.";
    });
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
    var s = document.createElement("script"), t = Date.now(); s.src = SECCIONES[sec];
    s.onload = function () { A.log("sección cargada", sec, Date.now() - t); self.Secciones[sec].iniciar(); };
    s.onerror = function () { A.log("sección NO cargó", sec, Date.now() - t, false); A.toast("No se pudo abrir la app: probá de nuevo", true); };
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
  A.log("abrió", (navigator.standalone || (window.matchMedia && matchMedia("(display-mode: standalone)").matches) ? "instalada" : "navegador") + " · " + navigator.userAgent.slice(0, 90));
  prueba().then(function () { return Cola.get("pase"); }).then(function (p) {
    if (p && p.token && p.vence * 1000 > Date.now() + 3600000) { A.pase = p; arrancar(); A.empujar(); }
    else nombres();
  }, function () { nombres(); });
})();
