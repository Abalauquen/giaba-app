/* GIABA instalable · service worker: guarda la app en el celu (abre al instante, y sin señal abre la guardada). */
var VERSION = "giaba-e10db6e";
var ARCHIVOS = ["./", "./index.html", "./ferias/index.html", "./ferias/gsr.js", "./manifest.webmanifest", "./icono.svg", "./icono-192.png", "./icono-512.png"];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(ARCHIVOS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.clients.claim(); }));
});
// con señal: siempre la versión nueva (si tarda más de 3 s o no hay señal, la guardada en el celu)
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;   // la base y Google nunca pasan por acá
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(e.request, { ignoreSearch: true }).then(function (hit) {
      var red = fetch(e.request, { cache: "no-store" }).then(function (r) { if (r && r.ok) c.put(e.request, r.clone()); return r; });
      if (!hit) return red;
      return Promise.race([red.catch(function () { return hit; }), new Promise(function (ok) { setTimeout(function () { ok(hit); }, 3000); })]);
    });
  }));
});
// 24/11 · Avisos al celu (mockup aprobado 23/11): el lugar arriba, el título y el texto; al tocar abre la pantalla que corresponde.
self.addEventListener("push", function (e) {
  var d = {}; try { d = e.data ? e.data.json() : {}; } catch (x) { d = { t: "GIABA", b: e.data ? e.data.text() : "" }; }
  var titulo = (d.l ? d.l + " · " : "") + (d.t || "GIABA");
  var op = { body: d.b || "", icon: "icono-aviso.png", badge: "badge-aviso.png", tag: d.g || undefined, renotify: !!d.g, data: { u: d.u || "./web/menu.html" }, lang: "es-AR" };
  if (d.ac && d.ac.length) op.actions = d.ac.slice(0, 2).map(function (a, i) { return { action: "a" + i, title: String(a.t || a) }; });
  if (d.ac && d.ac.length) op.data.acc = d.ac.map(function (a) { return a.u || ""; });
  e.waitUntil(self.registration.showNotification(titulo, op));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var dd = e.notification.data || {}, u = dd.u || "./web/menu.html";
  if (e.action && dd.acc) { var i = +String(e.action).slice(1); if (dd.acc[i]) u = dd.acc[i]; }
  var url = new URL(u, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (cs) {
    for (var k = 0; k < cs.length; k++) { if (cs[k].url === url && "focus" in cs[k]) return cs[k].focus(); }
    return self.clients.openWindow ? self.clients.openWindow(url) : null;
  }));
});
