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
  // respaldo: si IndexedDB no responde (pasa en iPhone dentro de otras apps), se usa localStorage (o memoria)
  var MEM = {}, SIN_IDB = false;
  try { SIN_IDB = typeof localStorage !== "undefined" && localStorage.getItem("giaba-app|sinidb") === "1"; } catch (e) {}
  function lsKey(store, k) { return "giaba-app|" + store + "|" + k; }
  function lsGet(store, k) { try { var v = localStorage.getItem(lsKey(store, k)); return v === null ? (MEM[lsKey(store, k)]) : JSON.parse(v); } catch (e) { return MEM[lsKey(store, k)]; } }
  function lsPut(store, k, v) { MEM[lsKey(store, k)] = v; try { if (v === undefined || v === null) localStorage.removeItem(lsKey(store, k)); else localStorage.setItem(lsKey(store, k), JSON.stringify(v)); } catch (e) {} }
  function lsAll(store) { var out = [], pre = "giaba-app|" + store + "|", vistos = {}; try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (k && k.indexOf(pre) === 0) { vistos[k] = 1; out.push(JSON.parse(localStorage.getItem(k))); } } } catch (e) {}
    Object.keys(MEM).forEach(function (k) { if (k.indexOf(pre) === 0 && !vistos[k] && MEM[k] != null) out.push(MEM[k]); }); return out; }
  function conTiempo(p, ms) { return new Promise(function (ok, mal) { var t = setTimeout(function () { mal(new Error("IndexedDB no respondió")); }, ms); p.then(function (v) { clearTimeout(t); ok(v); }, function (e) { clearTimeout(t); mal(e); }); }); }
  function txLS(store, modo, f) {
    // emula lo mínimo que usa esta app: get / put / delete / getAll
    var res, fake = { get: function (k) { res = lsGet(store, k); return {}; }, put: function (v, k) { lsPut(store, k === undefined ? v.uid : k, v); return {}; },
      delete: function (k) { lsPut(store, k, null); return {}; }, getAll: function () { res = lsAll(store); return {}; } };
    f(fake); return Promise.resolve(res);
  }
  function tx(store, modo, f) {
    if (SIN_IDB || typeof indexedDB === "undefined") return txLS(store, modo, f);
    return conTiempo(txIDB(store, modo, f), 3000).catch(function (e) { SIN_IDB = true; try { localStorage.setItem("giaba-app|sinidb", "1"); } catch (e2) {} if (self.App && App.log) App.log("almacen", "sin IndexedDB: " + (e && e.message)); return txLS(store, modo, f); });
  }
  function txIDB(store, modo, f) {
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
