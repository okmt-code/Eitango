/* オフライン用 service worker(build_ios.py が sw.js として書き出します。sw.js は直接編集しないでください)
   ネットにつながるときは最新版を取りに行き(ブラウザの一時保存を使わず確認する)、つながらないときは保存しておいた版で動きます。 */
const CACHE = "eigo-ios-fb2ab3284c";
const FILES = ["./", "index.html", "eitango.html", "bunpou.html", "ios.css", "ios.js", "manifest-index.webmanifest", "manifest-eitango.webmanifest", "manifest-bunpou.webmanifest", "icons/index-180.png", "icons/index-192.png", "icons/index-512.png", "icons/eitango-180.png", "icons/eitango-192.png", "icons/eitango-512.png", "icons/bunpou-180.png", "icons/bunpou-192.png", "icons/bunpou-512.png"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, {cache: "reload"})))).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("eigo-ios-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try{
      const res = await Promise.race([fetch(req.url, {cache: "no-cache", credentials: "same-origin"}), new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 4000))]);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }catch(err){
      const hit = await cache.match(req, {ignoreSearch: true});
      if (hit) return hit;
      if (req.mode === "navigate") return (await cache.match("index.html")) || Response.error();
      return Response.error();
    }
  })());
});
