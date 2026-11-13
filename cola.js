/* GIABA instalable · lo que se guarda en el celu y la cola de envío. Lo usan la página y el service worker (envío en segundo plano).
   IndexedDB «giaba-ferias»: «kv» (pase, sesión, conteos…) y «cola» (cobros, anulaciones y cierres que todavía no llegaron a la base). */
(function (G) {
  var DB = null;
  function abrir() {
    if (DB) return DB;
    DB = new Promise(function (ok, mal) {
      var r = indexedDB.open("giaba-app", 1);
      r.onupgradeneeded = function () { var d = r.result; d.createObjectStore("kv"); d.createObjectStore("cola", { keyPath: "uid" }); };
      r.onsuccess = function () { ok(r.result); }; r.onerror = function () { DB = null; mal(r.error); };
    });
    return DB;
  }
  function tx(store, modo, f) {
    return abrir().then(function (d) { return new Promise(function (ok, mal) {
      var t = d.transaction(store, modo), s = t.objectStore(store), res; var q = f(s);
      if (q) q.onsuccess = function () { res = q.result; };
      t.oncomplete = function () { ok(res); }; t.onerror = function () { mal(t.error); }; t.onabort = function () { mal(t.error); };
    }); });
  }
  var C = {
    get: function (k) { return tx("kv", "readonly", function (s) { return s.get(k); }); },
    set: function (k, v) { return tx("kv", "readwrite", function (s) { return v === undefined || v === null ? s.delete(k) : s.put(v, k); }); },
    encolar: function (it) { it.t = it.t || Date.now(); return tx("cola", "readwrite", function (s) { return s.put(it); }); },
    cola: function () { return tx("cola", "readonly", function (s) { return s.getAll(); }).then(function (L) { return (L || []).sort(function (a, b) { return a.t - b.t; }); }); },
    sacar: function (uid) { return tx("cola", "readwrite", function (s) { return s.delete(uid); }); },
    // pedido a la base con el pase (fn = vf_mandar, vf_estado_puesto…)
    rpc: function (pase, fn, body, ms) {
      var h = { apikey: pase.key, "Content-Type": "application/json", Accept: "application/json" };
      if (!/^sb_/.test(pase.key)) h.Authorization = "Bearer " + pase.key;
      body = Object.assign({ p_token: pase.token }, body || {});
      var ctl = typeof AbortController === "function" ? new AbortController() : null, tmo = setTimeout(function () { try { ctl && ctl.abort(); } catch (e) {} }, ms || 15000);
      return fetch(pase.url + "/rest/v1/rpc/" + fn, { method: "POST", headers: h, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
        .then(function (r) { clearTimeout(tmo); if (!r.ok) throw new Error("La base respondió " + r.status); return r.json(); },
              function (e) { clearTimeout(tmo); throw e; });
    },
    // manda la cola en orden. Para en el primero que no llega (sin señal): el resto espera su turno.
    enviando: null,
    mandarCola: function () {
      if (C.enviando) return C.enviando;
      C.enviando = C.get("pase").then(function (pase) {
        if (!pase || !pase.token) return { mandados: 0, faltan: -1 };
        return C.cola().then(function (L) {
          var n = 0;
          var uno = function (i) {
            if (i >= L.length) return { mandados: n, faltan: 0 };
            var it = L[i];
            return C.rpc(pase, "vf_mandar", { p_fn: it.fn, p_args: it.args, p_uid: it.uid, p_prueba: !!it.prueba }).then(function (j) {
              if (j && j.status === "token") return { mandados: n, faltan: L.length - i, pase: "vencido" };
              if (!j || j.status !== "ok") { it.error = (j && j.msg) || "no se guardó"; return C.encolar(it).then(function () { return uno(i + 1); }); }
              n++; return C.sacar(it.uid).then(function () { return uno(i + 1); });
            }, function () { return { mandados: n, faltan: L.length - i, sinSenal: true }; });
          };
          return uno(0);
        });
      }).then(function (r) { C.enviando = null; return r; }, function (e) { C.enviando = null; return { error: String(e) }; });
      return C.enviando;
    }
  };
  G.Cola = C;
})(self);
