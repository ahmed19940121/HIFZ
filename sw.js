/* Hifz Repeater — service worker
Strategy:

- App shell (this page, icons, manifest): cache-first, so the app opens instantly and offline.
- Fonts + GSAP (CDN): stale-while-revalidate, cached after first visit.
- Quran text/translations/audio (API + CDNs): runtime cache-first, so any passage you’ve
  loaded once is available offline for revision — the whole point before Fajr with no signal.
  */
  const VERSION   = “hifz-v2”;
  const SHELL     = “shell-” + VERSION;
  const RUNTIME   = “runtime-” + VERSION;

const SHELL_ASSETS = [
“./”,
“./index.html”,
“./manifest.webmanifest”,
“./icons/icon-192.png”,
“./icons/icon-512.png”,
“./icons/icon-maskable-512.png”,
“./icons/apple-touch-icon.png”
];

// Hosts whose responses we runtime-cache for offline revision.
const RUNTIME_HOSTS = [
“fonts.googleapis.com”,
“fonts.gstatic.com”,
“cdnjs.cloudflare.com”,
“api.quran.com”,
“verses.quran.com”,
“everyayah.com”,
“mirrors.quranicaudio.com”
];

self.addEventListener(“install”, event => {
event.waitUntil(
caches.open(SHELL).then(c => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
);
});

self.addEventListener(“activate”, event => {
event.waitUntil(
caches.keys()
.then(keys => Promise.all(
keys.filter(k => k !== SHELL && k !== RUNTIME).map(k => caches.delete(k))
))
.then(() => self.clients.claim())
);
});

self.addEventListener(“fetch”, event => {
const req = event.request;
if (req.method !== “GET”) return;

const url = new URL(req.url);
const isShell = url.origin === self.location.origin;
const isRuntime = RUNTIME_HOSTS.some(h => url.hostname === h || url.hostname.endsWith(”.” + h));

if (isShell) {
// cache-first for the app shell, fall back to network, then to cached index for navigations
event.respondWith(
caches.match(req).then(hit => hit || fetch(req).catch(() =>
req.mode === “navigate” ? caches.match(”./index.html”) : undefined
))
);
return;
}

if (isRuntime) {
const isAudio = /.mp3($|?)/i.test(url.pathname) || url.hostname.includes(“everyayah”) ||
url.hostname.includes(“quranicaudio”) || url.hostname === “verses.quran.com”;

```
if (isAudio) {
  // network-first for audio: always try fresh, fall back to cache only when offline.
  // prevents a broken MP3 cached during an earlier bug from being served forever.
  event.respondWith(
    fetch(req).then(res => {
      if (res && (res.ok || res.type === "opaque")) {
        const copy = res.clone();
        caches.open(RUNTIME).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => caches.match(req))
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
        caches.open(RUNTIME).then(c => c.put(req, copy));
      }
      return res;
    }).catch(() => hit);
  })
);
```

}
// everything else: default network handling
});
