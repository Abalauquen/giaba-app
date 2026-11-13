/* GIABA instalable · service worker: guarda la app en el celu (abre al instante y sin señal) y manda la cola en segundo plano. */
var VERSION = "giaba-a3213f9";
var ARCHIVOS = ["./", "./index.html", "./app.js", "./cola.js", "./config.js", "./ferias/ferias.js", "./manifest.webmanifest", "./icono.svg", "./icono-192.png", "./icono-512.png"];
importScripts("./cola.js");
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(ARCHIVOS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.clients.claim(); }));
});
// la app sale del celu; si hay señal se fija atrás si hay una versión nueva (la usa la próxima vez que se abre)
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== self.location.origin) return;   // la base y Google nunca pasan por acá
  e.respondWith(caches.open(VERSION).then(function (c) {
    return c.match(e.request, { ignoreSearch: true }).then(function (hit) {
      var red = fetch(e.request).then(function (r) { if (r && r.ok) c.put(e.request, r.clone()); return r; }).catch(function () { return hit; });
      return hit || red;
    });
  }));
});
// Android: aunque cierren la app, cuando vuelve la señal el sistema despierta esto y se manda lo pendiente
self.addEventListener("sync", function (e) { if (e.tag === "cola") e.waitUntil(Cola.mandarCola()); });
self.addEventListener("message", function (e) { if (e.data === "mandar") e.waitUntil ? e.waitUntil(Cola.mandarCola()) : Cola.mandarCola(); });
