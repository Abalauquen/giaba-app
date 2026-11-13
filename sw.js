/* GIABA instalable · service worker: guarda la app en el celu (abre al instante, y sin señal abre la guardada). */
var VERSION = "giaba-3d6a8be";
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
