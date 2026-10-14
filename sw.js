// ==============================================================================
// Gamingpig Portfolio PWA Service Worker (v24.215.0)
// Robust Update- & Cache-Strategie:
// - HTML / Navigation: ECHTES Network-First mit Offline-Fallback
// - Statische Assets (Bilder, Icons, Manifest): Stale-While-Revalidate mit Cache-Fallback
// - Live APIs & Externe Dienste: Network-Only (niemals veraltete Musikdaten)
// - Kontrollierte Übernahme: Nutzer-gesteuerte Aktivierung via Update-Center
// ==============================================================================

const SW_VERSION = "24.215.0";
const CURRENT_CACHE_VERSION = `gamingpig-cache-v${SW_VERSION}`;
const CACHE_NAME = CURRENT_CACHE_VERSION;

// Wichtige Offline-Kerndateien
const PRECACHE_URLS = [
    "./",
    "./index.html",
    "./spatial-audio.html",
    "./arcade.html",
    "./status.html",
    "./release.html",
    "./release-v24-115.html",
    "./privacy.html",
    "./impressum.html",
    "./roadmap.html",
    "./js/core/storage.e856be99df567fd2.js",
    "./js/core/push-config.c9a9d21e3077b97f.js",
    "./js/services/push-registration.dac93cbcb3758c9f.js",
    "./js/roadmap-protocol.0d283f073353011c.js",
    "./js/github-roadmap.6d5d949a55d29080.js",
    "./js/read-aloud-service.1fc24873f319082e.js",
    "./js/i18n-manager.56dbdc7cc518ed8b.js",
    "./manifest.json",
    "./icon-192.png",
    "./icon-512.png",
    "./og-v2.jpg",
    "./assets/community-glass.20260910.css",
    "./js/community-glass.20260910.js",
    "./version.json"
];

// Kontrollierte Installation (kein automatisches skipWaiting — wartet auf Nutzerbestätigung)
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CURRENT_CACHE_VERSION).then((cache) => {
            return cache.addAll(PRECACHE_URLS);
        })
    );
});

// Aktivierung: Veraltete Caches bereinigen, Clients sofort übernehmen und Tabs benachrichtigen
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key.startsWith("gamingpig-cache-v") && key !== CURRENT_CACHE_VERSION) {
                        console.log("[SW] Lösche veralteten Cache:", key);
                        return caches.delete(key);
                    }
                    return Promise.resolve();
                })
            );
        }).then(() => {
            return self.clients.claim();
        }).then(() => {
            return self.clients.matchAll({ type: "window" });
        }).then((windowClients) => {
            if (windowClients && windowClients.length > 0) {
                windowClients.forEach((client) => {
                    try {
                        client.postMessage({ type: "SW_UPDATED", version: SW_VERSION });
                    } catch(e) {}
                });
            }
        })
    );
});

// Nachrichten-Listener (z. B. für automatisches skipWaiting)
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});


// Benachrichtigungs-Klick-Handler (öffnet oder fokussiert die Status-Seite / Ziel-URL)
self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const rawUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : "./status.html";
    let targetUrl;
    try {
        targetUrl = safeLocalUrl(rawUrl, "./status.html");
    } catch(e) {
        targetUrl = safeLocalUrl("./status.html", "./status.html");
    }

    event.waitUntil(
        clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url === targetUrl) {
                    if ("focus" in client) return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        }).catch((err) => {
            console.error("[SW] notificationclick error:", err);
        })
    );
});

// Resolve project-relative notification targets and reject external/special schemes.
function safeLocalUrl(raw, fallback) {
    const base = self.registration.scope;
    try {
        const url = new URL(String(raw), base);
        if (url.origin === self.location.origin && url.pathname.startsWith(new URL(base).pathname) && /^https?:$/.test(url.protocol)) return url.href;
    } catch (_) {}
    return new URL(fallback, base).href;
}

// Web Push Event Handler für Android / iOS / Desktop
// Robust: Garantiert, dass self.registration.showNotification immer aufgerufen wird und niemals rejected
self.addEventListener("push", (event) => {
    let payload = {
        title: "Gamingpig Update",
        body: "Neue Inhalte verfügbar!",
        url: "./status.html",
        icon: "icon-192.png",
        badge: "icon-192.png"
    };

    if (event.data) {
        try {
            const parsed = event.data.json();
            if (parsed && typeof parsed === "object") {
                payload = Object.assign(payload, parsed);
            }
        } catch (e) {
            try {
                const text = event.data.text();
                if (text) payload.body = text;
            } catch (err) {}
        }
    }

    // Sprach-Unterstützung falls im Payload hinterlegt
    let title = payload.title || "Gamingpig Update";
    let body = payload.body || "Neue Inhalte verfügbar!";
    if (payload.translations && typeof payload.translations === "object") {
        const lang = (navigator.language || "de").slice(0, 2).toLowerCase();
        if (payload.translations[lang]) {
            title = payload.translations[lang].title || title;
            body = payload.translations[lang].body || body;
        } else if (payload.translations.de) {
            title = payload.translations.de.title || title;
            body = payload.translations.de.body || body;
        } else if (payload.translations.en) {
            title = payload.translations.en.title || title;
            body = payload.translations.en.body || body;
        }
    }

    const iconUrl = safeLocalUrl(payload.icon || "icon-192.png", "icon-192.png");
    const badgeUrl = safeLocalUrl(payload.badge || "icon-192.png", "icon-192.png");

    event.waitUntil(
        self.registration.showNotification(String(title).slice(0, 160), {
            body: String(body).slice(0, 1000),
            icon: iconUrl,
            badge: badgeUrl,
            tag: typeof payload.broadcastId === "string" ? payload.broadcastId.slice(0, 160) : undefined,
            data: { url: payload.url || "./status.html" }
        }).catch((err) => {
            console.error("[SW] showNotification error:", err);
        })
    );
});

// Intelligenter Fetch-Handler
self.addEventListener("fetch", (event) => {
    // Nur GET-Anfragen behandeln
    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);
    const isSameOrigin = (url.origin === self.location.origin);
    const isNavigation = (event.request.mode === "navigate" || event.request.destination === "document");

    // 1. Live APIs, Musik-Streams & externe Ressourcen (Spotify, stats.fm, Discord, Apple, etc.)
    // -> IMMER direkt aus dem Netzwerk, niemals aus altem statischen Cache
    if (!isSameOrigin || url.pathname.includes("/api/") || url.searchParams.has("api")) {
        return; // Direkt dem Browser-Netzwerk überlassen
    }

    // Network-first for documents/scripts: never serve stale JS before checking the release.
    // Other local assets use the same bounded cache; live data is not cached.
    if (url.pathname.includes('/data/') || url.searchParams.has('api')) return;
    const cacheable = isNavigation || ['script', 'style', 'image', 'font', 'manifest'].includes(event.request.destination);
    if (!cacheable) return;
    event.respondWith((async () => {
        let cache;
        try { cache = await caches.open(CACHE_NAME); }
        catch (_) { return fetch(event.request).catch(() => new Response('Offline', { status: 503 })); }
        const immutable = /\.[a-f0-9]{16}\.js$/.test(url.pathname);
        const cached = await cache.match(event.request) || (immutable ? await caches.match(event.request) : null);
        if (immutable && cached) return cached;
        const network = (async () => {
        try {
            const fetchOptions = isNavigation ? { cache: 'reload' } : { cache: 'no-cache' };
            const response = await fetch(event.request, fetchOptions);
            if (response.ok) {
                const copy = response.clone();
                event.waitUntil((async () => {
                    await cache.put(event.request, copy);
                    const keys = await cache.keys();
                    const core = new Set(PRECACHE_URLS.map(value => new URL(value, self.registration.scope).href));
                    const runtime = keys.filter(request => !core.has(request.url));
                    for (const request of runtime.slice(0, Math.max(0, runtime.length - 80))) await cache.delete(request);
                })().catch(() => {}));
                return response;
            }
            if (cached && response.status >= 500) return cached;
            return response;
        } catch (_) {
            if (cached) return cached;
            if (isNavigation) {
                const home = await cache.match('./index.html') || await cache.match('./');
                if (home) return home;
            }
            return new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
        }
        })();
        if (cached && !isNavigation && event.request.destination !== 'script') {
            event.waitUntil(network.then(() => {}));
            return cached;
        }
        return network;
    })());
});
