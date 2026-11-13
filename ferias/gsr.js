/* App instalable · google.script.run fuera de Google: la MISMA pantalla de Ferias de siempre (Index.html) le pide las cosas
   a Apps Script por doPost (texto plano, sin «preflight»). Lo que va directo a la base lo cambia después FeriasDirecto. */
(function () {
  var URL_GAS = self.GIABA_GAS;
  var Q = [], quien = function () { try { var a = JSON.parse(localStorage.getItem("giaba_auth") || "null"); return (a && a.nombre) || ""; } catch (e) { return ""; } };
  function rec(fn, ms, ok, kb) { Q.push([String(fn).slice(0, 200), Math.round(ms), ok ? 1 : 0, Date.now(), kb || 0]); if (Q.length >= 30) flush(); }
  function flush() { if (!Q.length) return; var l = Q.splice(0, 40); llamar("registrarTiemposApp", [{ app: "giaba-app·ferias", quien: quien(), items: l }], function () {}, function () {}, true); }
  setInterval(flush, 30000); window.addEventListener("pagehide", flush);
  function llamar(fn, args, ok, mal, sinMedir) {
    var t0 = Date.now(), listo = false, ctl = typeof AbortController === "function" ? new AbortController() : null;
    var tmo = setTimeout(function () { if (listo) return; listo = true; try { ctl && ctl.abort(); } catch (e) {} if (!sinMedir) rec(fn, Date.now() - t0, false); mal(new Error("Google no contestó")); }, 60000);
    fetch(URL_GAS, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ via: "gsr", fn: fn, args: args }), redirect: "follow", cache: "no-store", signal: ctl ? ctl.signal : undefined })
      .then(function (r) { if (!r.ok) throw new Error("Google respondió " + r.status); return r.text(); })
      .then(function (t) {
        if (listo) return; listo = true; clearTimeout(tmo);
        var v; try { v = JSON.parse(t); } catch (e) { if (!sinMedir) rec(fn, Date.now() - t0, false); return mal(new Error("Respuesta rara de Google")); }
        if (!sinMedir) rec(fn, Date.now() - t0, !(v && v.__err), Math.round(t.length / 102.4) / 10);
        if (v && v.__err) mal(new Error(v.__err)); else ok(v);
      }, function (e) { if (listo) return; listo = true; clearTimeout(tmo); if (!sinMedir) rec(fn, Date.now() - t0, false); mal(e); });
  }
  function cadena(ok, fail, uo) {
    return new Proxy({}, { get: function (_, k) {
      if (k === "withSuccessHandler") return function (f) { return cadena(f, fail, uo); };
      if (k === "withFailureHandler") return function (f) { return cadena(ok, f, uo); };
      if (k === "withUserObject") return function (o) { return cadena(ok, fail, o); };
      if (typeof k !== "string") return undefined;
      return function () {
        var args = Array.prototype.slice.call(arguments);
        llamar(k, args, function (v) { if (ok) ok(v, uo); }, function (e) { if (fail) fail(e, uo); else if (window.console) console.error(e); });
      };
    } });
  }
  window.google = window.google || {};
  google.script = google.script || {};
  google.script.run = cadena(null, null, undefined);
  rec("· página abierta (app instalable)", 0, true);
})();
