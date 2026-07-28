/* Hifz Repeater — service worker
   Strategy:
   - App shell (this page, icons, manifest): cache-first, so the app opens instantly and offline.
   - Fonts + GSAP (CDN): cache-first, cached after first visit.
   - Quran text/translations (API): cache-first, so any passage you've loaded once is
     available offline for revision — the whole point before Fajr with no signal.
   - Audio: network-first with a cache fallback, so a broken MP3 cached during an
     earlier bug is never served forever.

   Note: audio requests made by the gapless engine are `mode: "cors"` fetches, so the
   responses stored here are real (non-opaque) and can be decoded straight from cache
   on a second listen — the second pass through a passage needs no network at all.
*/
const VERSION   = "hifz-v3";
const SHELL     = "shell-" + VERSION;
const RUNTIME   = "runtime-" + VERSION;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png"
];

// Hosts whose responses we runtime-cache for offline revision.
const RUNTIME_HOSTS = [
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "cdnjs.cloudflare.com",
  "api.quran.com",
  "verses.quran.com",
  "everyayah.com",
  "mirrors.quranicaudio.com",
  "mp3quran.net"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL)
      // addAll is all-or-nothing; a single 404 would abort the whole install.
      .then(c => Promise.all(SHELL_ASSETS.map(a => c.add(a).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  const isShell = url.origin === self.location.origin;
  const isRuntime = RUNTIME_HOSTS.some(h => url.hostname === h || url.hostname.endsWith("." + h));

  if (isShell) {
    // cache-first for the app shell, fall back to network, then to cached index for navigations
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).catch(() =>
        req.mode === "navigate" ? caches.match("./index.html") : Response.error()
      ))
    );
    return;
  }

  if (!isRuntime) return; // everything else: default network handling

  const isAudio = /\.mp3($|\?)/i.test(url.pathname) ||
                  url.hostname.includes("everyayah") ||
                  url.hostname.includes("quranicaudio") ||
                  url.hostname.includes("mp3quran") ||
                  url.hostname === "verses.quran.com";

  if (isAudio) {
    // Range requests (what <audio> issues when seeking) must never be cached —
    // storing a 206 and replaying it as a full response corrupts playback.
    if (req.headers.has("range")) return;

    event.respondWith(
      fetch(req).then(res => {
        if (res && res.ok && res.status === 200) {
          const copy = res.clone();
          caches.open(RUNTIME).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(req).then(hit => hit || Response.error()))
    );
    return;
  }

  // cache-first for text/translations/fonts/scripts: once fetched, works offline next time
  event.respondWith(
    caches.match(req).then(hit => {
      if (hit) return hit;
      return fetch(req).then(res => {
        if (res && (res.ok || res.type === "opaque")) {
          const copy = res.clone();
          caches.open(RUNTIME).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => Response.error());
    })
  );
});
