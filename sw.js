// Bottari SW — 앱 셸만 캐시. Supabase 응답은 절대 캐시하지 않음.
// 배포할 때 CACHE와 app.js의 VERSION을 같이 올릴 것
const CACHE = "bottari-v1.7";
const SHELL = ["./", "./index.html", "./style.css", "./app.js", "./config.js", "./manifest.webmanifest", "./icon-180.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("bottari-") && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});
// 네트워크 우선, 실패(오프라인) 시 캐시
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || e.request.method !== "GET") return;
  e.respondWith(
    // no-cache: GitHub Pages의 10분 HTTP 캐시를 건너뛰고 매번 재확인(304면 공짜)
    fetch(e.request, { cache: "no-cache" }).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match(e.request))
  );
});
