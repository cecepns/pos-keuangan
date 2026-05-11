/**
 * Service worker — hindari HTML/shell stale setelah deploy Vite (nama chunk berubah).
 * Masalah lama: cache-first untuk "/" memuat index.html versi lama → request JS hash lama → 404.
 */
const CACHE = "pos-keu-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isHtmlNavigation(req) {
  if (req.mode === "navigate") return true;
  const url = new URL(req.url);
  if (url.pathname === "/" || url.pathname.endsWith(".html")) return true;
  const accept = req.headers.get("accept") || "";
  return accept.includes("text/html");
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return;

  // Dokumen HTML: selalu network dulu agar selalu dapat index.html terbaru (+ daftar chunk baru)
  if (isHtmlNavigation(e.request)) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => {
              c.put(e.request, copy);
            });
          }
          return res;
        })
        .catch(() => caches.match("/index.html").then((r) => r || caches.match("/")))
    );
    return;
  }

  // Aset lain (JS/CSS ber-hash di /assets/, ikon, manifest): cache-first + update cache
  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request).then((res) => {
          const copy = res.clone();
          if (res.ok) {
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
    )
  );
});
