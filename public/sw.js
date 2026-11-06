// Lets the app open without signal. Firestore keeps its own offline copy of the list;
// this worker only caches the app's own files and the Firebase/font libraries.
const CACHE = "family-list-v2";
const SHELL = ["./", "index.html", "styles.css", "app.js", "store.js", "categories.js", "icons.js",
  "firebase-config.js", "manifest.webmanifest", "icons/icon-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const versionedLib = url.hostname === "www.gstatic.com" || url.hostname.startsWith("fonts.");
  if (url.origin === location.origin) {
    // Network first, so updates show up right away; fall back to the cached copy offline.
    e.respondWith(fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
  } else if (versionedLib) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })));
  }
  // Everything else (Firestore and sign-in traffic) goes straight to the network.
});
