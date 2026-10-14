/**
 * Gamingpig Portfolio - Automated Web Push & Health Monitoring Script
 * Runs in GitHub Actions to check services and send Web Push notifications
 * to Android, iOS (PWA), and Desktop browsers even when the app is closed.
 */

const fs = require('fs');
const path = require('path');
const webPush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BItv0vIf2FPn11TcGv_5Nyp1YHE4c6e7lYHWRONDnGL-ca7EPMbD_DlzkMlB_InZEVJEFASPhkMwOLnPRRxfX-w';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'cS5HGxWt9nsqWNAs_7ljuydLqf8D9uqkYh1WRkM3X8Q';
const VAPID_SUBJECT = 'mailto:support@gamingpig.de';

webPush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

const SUBSCRIBERS_FILE = path.join(__dirname, '..', 'data', 'subscribers.json');
const PUSH_SYNC_TOPIC = process.env.PUSH_SYNC_TOPIC || 'gamingpig_push_sub_vault_9f8a2b3c4d5e';
const PUSH_SYNC_URL = `https://ntfy.sh/${PUSH_SYNC_TOPIC}`;

function loadSubscribers() {
    try {
        if (!fs.existsSync(SUBSCRIBERS_FILE)) return [];
        const content = fs.readFileSync(SUBSCRIBERS_FILE, 'utf8');
        return JSON.parse(content || '[]');
    } catch (e) {
        console.error('Failed to load subscribers:', e.message);
        return [];
    }
}

function saveSubscribers(subscribers) {
    try {
        fs.writeFileSync(SUBSCRIBERS_FILE, JSON.stringify(subscribers, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save subscribers:', e.message);
    }
}

async function sendWelcomePush(sub) {
    const subLang = (sub.lang || 'de').slice(0, 2).toLowerCase();
    const welcomePayload = {
        title: '🔔 Gamingpig Störungs-Alarm aktiv',
        body: 'Dein Gerät empfängt ab sofort alle Alarme & Entwarnungen vollautomatisch!',
        translations: {
            de: {
                title: '🔔 Gamingpig Störungs-Alarm aktiv',
                body: 'Dein Gerät empfängt ab sofort alle Alarme & Entwarnungen vollautomatisch!'
            },
            en: {
                title: '🔔 Gamingpig Outage Alerts Active',
                body: 'Your device will now receive outage & recovery notifications automatically!'
            },
            es: {
                title: '🔔 Alertas del sistema Gamingpig activadas',
                body: '¡Tu dispositivo recibirá alertas de fallos y recuperaciones automáticamente!'
            },
            fr: {
                title: '🔔 Alertes système Gamingpig activées',
                body: 'Votre appareil recevra désormais toutes les alertes et retours en ligne automatiquement !'
            },
            pt: {
                title: '🔔 Alertas de sistema Gamingpig ativados',
                body: 'Seu dispositivo agora receberá todos os alertas e recuperações automaticamente!'
            },
            tr: {
                title: '🔔 Gamingpig Sistem Bildirimleri Aktif',
                body: 'Cihazınız artık tüm kesinti ve kurtarma bildirimlerini otomatik olarak alacak!'
            }
        },
        url: 'https://gamingpig.github.io/About-Gamingpig/status.html'
    };

    let welcomeTitle = welcomePayload.title;
    let welcomeBody = welcomePayload.body;
    if (welcomePayload.translations[subLang]) {
        welcomeTitle = welcomePayload.translations[subLang].title;
        welcomeBody = welcomePayload.translations[subLang].body;
    }

    await webPush.sendNotification(sub, JSON.stringify({
        broadcastId: 'welcome_' + Date.now(),
        title: welcomeTitle,
        body: welcomeBody,
        translations: welcomePayload.translations,
        url: welcomePayload.url,
        timestamp: Date.now()
    }), {
        TTL: 86400,
        urgency: 'high'
    });
    console.log(`✅ Welcome push delivered to ${sub.endpoint.substring(0, 45)}... [Lang: ${subLang}]`);
}

async function syncPendingSubscribersFromQueue() {
    console.log('🔄 Checking for pending push subscriptions in server queue...');
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(`${PUSH_SYNC_URL}/json?poll=1&since=24h`, {
            signal: controller.signal,
            headers: { 'Accept': 'application/json' }
        });
        clearTimeout(timeout);

        if (!res.ok) {
            console.log(`Queue response status: ${res.status}`);
            return;
        }

        const text = await res.text();
        if (!text || !text.trim()) {
            console.log('No pending subscriptions found in queue.');
            return;
        }

        const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
        let subscribers = loadSubscribers();
        let addedCount = 0;
        let updatedCount = 0;

        for (const line of lines) {
            try {
                const item = JSON.parse(line);
                if (item.event !== 'message' || !item.message) continue;
                
                let data;
                try {
                    data = typeof item.message === 'string' ? JSON.parse(item.message) : item.message;
                } catch (e) {
                    continue;
                }

                if (!data || !data.endpoint || typeof data.endpoint !== 'string') continue;
                if (!data.endpoint.startsWith('https://')) continue;
                if (!data.keys || !data.keys.p256dh || !data.keys.auth) continue;

                const cleanSub = {
                    endpoint: data.endpoint,
                    expirationTime: data.expirationTime || null,
                    lang: (data.lang || 'de').slice(0, 2).toLowerCase(),
                    keys: {
                        p256dh: data.keys.p256dh,
                        auth: data.keys.auth
                    }
                };

                const existingIdx = subscribers.findIndex(s => s.endpoint === cleanSub.endpoint);
                if (existingIdx >= 0) {
                    if (subscribers[existingIdx].lang !== cleanSub.lang || 
                        subscribers[existingIdx].keys.p256dh !== cleanSub.keys.p256dh ||
                        subscribers[existingIdx].keys.auth !== cleanSub.keys.auth) {
                        subscribers[existingIdx] = cleanSub;
                        updatedCount++;
                    }
                } else {
                    subscribers.push(cleanSub);
                    addedCount++;
                    console.log(`✨ [Auto-Register] Ingested subscriber from queue: ${cleanSub.endpoint.substring(0, 45)}... [Lang: ${cleanSub.lang}]`);
                    try {
                        await sendWelcomePush(cleanSub);
                    } catch (err) {
                        console.warn(`Welcome push failed for new subscriber: ${err.message}`);
                    }
                }
            } catch (err) {
                // Ignore individual line malformation
            }
        }

        if (addedCount > 0 || updatedCount > 0) {
            saveSubscribers(subscribers);
            console.log(`✅ Queue sync complete: Added ${addedCount}, updated ${updatedCount}. Total active subscribers: ${subscribers.length}`);
        } else {
            console.log(`Queue sync complete: All ${lines.length} items already up to date.`);
        }
    } catch (e) {
        console.warn('Queue sync check warning:', e.message);
    }
}

async function sendPushToAll(payload) {
    let subscribers = loadSubscribers();
    if (subscribers.length === 0) {
        console.log('No registered push subscribers found in data/subscribers.json.');
        return;
    }

    console.log(`Sending Web Push to ${subscribers.length} subscriber(s)...`);
    const expiredEndpoints = new Set();

    const sendPromises = subscribers.map(async (sub) => {
        try {
            const subLang = (sub.lang || 'de').slice(0, 2).toLowerCase();
            let title = payload.title || '⚠️ Gamingpig System-Status';
            let body = payload.body || 'Status-Änderung festgestellt.';

            if (payload.translations && payload.translations[subLang]) {
                title = payload.translations[subLang].title || title;
                body = payload.translations[subLang].body || body;
            }

            const payloadString = JSON.stringify({
                broadcastId: payload.broadcastId || ('gp_' + (payload.timestamp || Date.now())),
                title: title,
                body: body,
                translations: payload.translations || {},
                url: payload.url || 'https://gamingpig.github.io/About-Gamingpig/status.html',
                timestamp: payload.timestamp || Date.now()
            });

            await webPush.sendNotification(sub, payloadString, {
                TTL: 86400, // 24h
                urgency: 'high'
            });
            console.log(`✅ Push delivered successfully to ${sub.endpoint.substring(0, 45)}... [Lang: ${subLang}]`);
        } catch (err) {
            console.warn(`❌ Push failed for ${sub.endpoint.substring(0, 45)}... [${err.statusCode || err.message}]`);
            // If subscription is expired/unregistered (HTTP 404 or 410 Gone)
            if (err.statusCode === 404 || err.statusCode === 410) {
                expiredEndpoints.add(sub.endpoint);
            }
        }
    });

    await Promise.all(sendPromises);

    if (expiredEndpoints.size > 0) {
        subscribers = subscribers.filter(s => !expiredEndpoints.has(s.endpoint));
        saveSubscribers(subscribers);
        console.log(`Pruned ${expiredEndpoints.size} expired subscription(s).`);
    }
}

const STATE_FILE = path.join(__dirname, '..', 'data', 'status_state.json');

function loadState() {
    try {
        if (!fs.existsSync(STATE_FILE)) return { lastFailures: [], lastChecked: 0 };
        return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8') || '{}');
    } catch (e) {
        return { lastFailures: [], lastChecked: 0 };
    }
}

function saveState(state) {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), 'utf8');
    } catch (e) {
        console.error('Failed to save state:', e.message);
    }
}

function formatFailures(failedItems, lang = 'de') {
    const list = failedItems.map(item => {
        if (item.id === 'pi_offline') {
            const track = item.track || 'Track';
            const dev = item.device || 'Spotify';
            switch (lang) {
                case 'en': return `Raspberry Pi Offline (Track '${track}' is playing on ${dev}, but Pi is not sending telemetry)`;
                case 'es': return `Raspberry Pi Desconectada (Pista '${track}' suena en ${dev}, pero la Pi no envía datos)`;
                case 'fr': return `Raspberry Pi Hors Ligne (Titre '${track}' en lecture sur ${dev}, mais le Pi n'envoie pas de données)`;
                case 'pt': return `Raspberry Pi Desconectada (Faixa '${track}' tocando no ${dev}, mas a Pi não envia dados)`;
                case 'tr': return `Raspberry Pi Çevrimdışı ('${track}' parçası ${dev} üzerinde çalıyor, ancak Pi telemetri göndermiyor)`;
                default: return `Raspberry Pi Offline (Musik '${track}' läuft auf ${dev}, aber Pi sendet keine Telemetrie-Daten)`;
            }
        }
        if (item.errorType === 'Timeout') {
            switch (lang) {
                case 'en': return `${item.name} (Timeout)`;
                case 'es': return `${item.name} (Tiempo de espera)`;
                case 'fr': return `${item.name} (Délai dépassé)`;
                case 'pt': return `${item.name} (Tempo limite)`;
                case 'tr': return `${item.name} (Zaman aşımı)`;
                default: return `${item.name} (Zeitüberschreitung)`;
            }
        }
        if (item.errorType === 'Offline') {
            switch (lang) {
                case 'en': return `${item.name} (Offline)`;
                case 'es': return `${item.name} (Fuera de línea)`;
                case 'fr': return `${item.name} (Hors ligne)`;
                case 'pt': return `${item.name} (Offline)`;
                case 'tr': return `${item.name} (Çevrimdışı)`;
                default: return `${item.name} (Offline)`;
            }
        }
        return `${item.name} (HTTP ${item.status || 'Error'})`;
    });
    return list.join(', ');
}

async function resilientFetch(url, timeoutMs = 10000, maxRetries = 2) {
    let lastErr = null;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const res = await fetch(url, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; GamingpigStatusMonitor/24.138; +https://gamingpig.github.io/About-Gamingpig/)',
                    'Accept': 'application/json, text/plain, */*'
                }
            });
            clearTimeout(timeout);
            return { ok: true, status: res.status, res };
        } catch (e) {
            clearTimeout(timeout);
            lastErr = e;
            if (attempt < maxRetries) {
                // Short wait before retry (1.2s)
                await new Promise(r => setTimeout(r, 1200));
            }
        }
    }
    return { ok: false, error: lastErr, errorType: (lastErr && lastErr.name === 'AbortError') ? 'Timeout' : 'Offline' };
}

async function checkEndpoints() {
    const endpoints = [
        { 
            id: 'statsfm', 
            name: 'stats.fm API', 
            url: 'https://api.stats.fm/api/v1/users/gamingpig/streams/current',
            fallbackUrl: 'https://api.stats.fm/api/v1/users/gamingpig',
            okStatuses: [200, 204, 404, 429]
        },
        { 
            id: 'npc', 
            name: 'Spotify / NPC API', 
            url: 'https://npc-api.aikins.xyz/v1/users/gamingpig/now', 
            okStatuses: [200, 204, 429] 
        },
        { 
            id: 'lyrics', 
            name: 'LrcLib Lyrics', 
            url: 'https://lrclib.net/api/get?track_name=test&artist_name=test', 
            okStatuses: [200, 404, 429] 
        },
        { 
            id: 'discord', 
            name: 'Discord API', 
            url: 'https://discord.com/api/v10/invites/E8BS9BDAst?with_counts=true', 
            okStatuses: [200, 429] 
        },
        { 
            id: 'apple_cdn', 
            name: 'Apple CDN', 
            url: 'https://is1-ssl.mzstatic.com/image/thumb/Music/v4/00/00/00/000000.jpg/100x100bb.jpg', 
            okStatuses: [200, 404] 
        }
    ];

    const failed = [];
    let statsData = null;
    let npcData = null;

    for (const ep of endpoints) {
        // Generous 12s timeout with 2 attempts
        const fetchRes = await resilientFetch(ep.url, 12000, 2);

        if (fetchRes.ok) {
            if (ep.id === 'statsfm' && fetchRes.status === 200 && fetchRes.res) {
                try { statsData = await fetchRes.res.json(); } catch (e) {}
            }
            if (ep.id === 'npc' && fetchRes.status === 200 && fetchRes.res) {
                try { npcData = await fetchRes.res.json(); } catch (e) {}
            }

            if (!ep.okStatuses.includes(fetchRes.status)) {
                failed.push({ id: ep.id, name: ep.name, status: fetchRes.status });
            }
        } else {
            // If primary failed for statsfm, test fallback profile endpoint before flagging failure
            if (ep.fallbackUrl) {
                console.log(`[HealthCheck] Primary ${ep.name} check had slow response, verifying fallback endpoint...`);
                const fallbackRes = await resilientFetch(ep.fallbackUrl, 10000, 2);
                if (fallbackRes.ok && ep.okStatuses.includes(fallbackRes.status)) {
                    console.log(`[HealthCheck] Fallback for ${ep.name} succeeded (Status: ${fallbackRes.status}). Service is operational.`);
                    continue; // stats.fm is fine!
                }
            }
            failed.push({ id: ep.id, name: ep.name, errorType: fetchRes.errorType || 'Timeout' });
        }
    }

    // Raspberry Pi Live Feed Discrepancy Check:
    // HINWEIS: Wenn stats.fm live Musik liefert, ist das Nutzer-Erlebnis nahtlos gesichert.
    // Daher wird kein störender Ausfall-Alarm mehr per Web-Push an alle Abonnenten geschickt.
    const isSpotifyPlaying = !!(statsData && statsData.item && statsData.item.isPlaying);
    const trackName = (statsData && statsData.item && statsData.item.track) ? statsData.item.track.name : '';

    if (isSpotifyPlaying && !npcData) {
        console.log(`[HealthCheck] Info: Musik läuft ('${trackName}'), stats.fm übernimmt Fallback nahtlos (Pi-Telemetrie pausiert).`);
    }

    return failed;
}

async function main() {
    const mode = process.argv[2] || 'check';

    // 1. Automatische Synchronisation aller neuen Abonnenten aus der Server-Queue
    await syncPendingSubscribersFromQueue();

    if (mode === 'sync' || mode === 'sync-subscribers') {
        console.log('✅ Abonnenten-Synchronisation erfolgreich beendet.');
        return;
    }

    if (mode === 'send' || mode === 'custom' || mode === 'broadcast' || mode === 'manual-push' || mode === 'maintenance') {
        const title = process.argv[3] || process.env.PUSH_TITLE || '⚠️ Gamingpig Status-Alarm';
        const body = process.argv[4] || process.env.PUSH_BODY || 'Status-Aktualisierung.';
        const targetUrl = process.argv[5] || process.env.PUSH_URL || 'https://gamingpig.github.io/About-Gamingpig/status.html';
        console.log(`Triggering broadcast push [mode: ${mode}]: "${title}" - "${body}" -> ${targetUrl}`);
        await sendPushToAll({
            title: title,
            body: body,
            translations: {
                de: { title: title, body: body },
                en: { title: title, body: body },
                es: { title: title, body: body },
                fr: { title: title, body: body },
                pt: { title: title, body: body },
                tr: { title: title, body: body }
            },
            url: targetUrl
        });
        return;
    }

    if (mode === 'update') {
        const customMsg = process.argv[3] || 'Ein neues PWA-Update mit Optimierungen und neuen Features ist online!';
        console.log(`Triggering release update push: "${customMsg}"`);
        await sendPushToAll({
            title: '🚀 Neues Update – Gamingpig Portfolio',
            body: customMsg,
            translations: {
                de: {
                    title: '🚀 Neues Update – Gamingpig Portfolio',
                    body: customMsg
                },
                en: {
                    title: '🚀 New Update – Gamingpig Portfolio',
                    body: 'A fresh update with new features and improvements is now live!'
                },
                es: {
                    title: '🚀 Nueva Actualización – Gamingpig Portfolio',
                    body: '¡Hay una nueva actualización con mejoras y funciones disponibles!'
                },
                fr: {
                    title: '🚀 Nouvelle Mise à Jour – Gamingpig Portfolio',
                    body: 'Une nouvelle mise à jour avec des améliorations est disponible !'
                },
                pt: {
                    title: '🚀 Nova Atualização – Gamingpig Portfolio',
                    body: 'Uma nova atualização com melhorias e novidades está disponível!'
                },
                tr: {
                    title: '🚀 Yeni Güncelleme – Gamingpig Portfolio',
                    body: 'Yeni özellikler ve iyileştirmeler içeren güncelleme yayınlandı!'
                }
            },
            url: 'https://gamingpig.github.io/About-Gamingpig/release-v24-115.html'
        });
        return;
    }

    if (mode === 'register') {
        const raw = process.argv[3] || process.env.NEW_SUBSCRIPTION;
        if (!raw) {
            console.error('No subscription JSON provided.');
            process.exit(1);
        }
        try {
            let parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            let newSub = parsed.subscription || parsed;
            const subLang = (parsed.lang || newSub.lang || 'de').slice(0, 2).toLowerCase();
            if (typeof newSub === 'string') newSub = JSON.parse(newSub);
            if (!newSub.endpoint || !newSub.keys) {
                throw new Error('Invalid subscription format.');
            }
            newSub.lang = subLang;
            const subscribers = loadSubscribers();
            const existingIdx = subscribers.findIndex(s => s.endpoint === newSub.endpoint);
            if (existingIdx >= 0) {
                subscribers[existingIdx] = newSub; // Update
                console.log(`Updated existing subscription with language: ${subLang}`);
            } else {
                subscribers.push(newSub); // Add
                console.log(`Added new subscription with language: ${subLang}`);
            }
            saveSubscribers(subscribers);

            // Send confirmation welcome push with 6-language translations!
            const welcomePayload = {
                title: '🔔 Gamingpig Störungs-Alarm aktiv',
                body: 'Dein Gerät empfängt ab sofort alle Alarme & Entwarnungen vollautomatisch!',
                translations: {
                    de: {
                        title: '🔔 Gamingpig Störungs-Alarm aktiv',
                        body: 'Dein Gerät empfängt ab sofort alle Alarme & Entwarnungen vollautomatisch!'
                    },
                    en: {
                        title: '🔔 Gamingpig Outage Alerts Active',
                        body: 'Your device will now receive outage & recovery notifications automatically!'
                    },
                    es: {
                        title: '🔔 Alertas del sistema Gamingpig activadas',
                        body: '¡Tu dispositivo recibirá alertas de fallos y recuperaciones automáticamente!'
                    },
                    fr: {
                        title: '🔔 Alertes système Gamingpig activées',
                        body: 'Votre appareil recevra désormais toutes les alertes et retours en ligne automatiquement !'
                    },
                    pt: {
                        title: '🔔 Alertas de sistema Gamingpig ativados',
                        body: 'Seu dispositivo agora receberá todos os alertas e recuperações automaticamente!'
                    },
                    tr: {
                        title: '🔔 Gamingpig Sistem Bildirimleri Aktif',
                        body: 'Cihazınız artık tüm kesinti ve kurtarma bildirimlerini otomatik olarak alacak!'
                    }
                },
                url: 'https://gamingpig.github.io/About-Gamingpig/status.html'
            };

            let welcomeTitle = welcomePayload.title;
            let welcomeBody = welcomePayload.body;
            if (welcomePayload.translations[subLang]) {
                welcomeTitle = welcomePayload.translations[subLang].title;
                welcomeBody = welcomePayload.translations[subLang].body;
            }

            await webPush.sendNotification(newSub, JSON.stringify({
                title: welcomeTitle,
                body: welcomeBody,
                translations: welcomePayload.translations,
                url: welcomePayload.url
            }));
            console.log(`Welcome push sent successfully in [${subLang}]!`);
        } catch (e) {
            console.error('Failed to register subscription:', e.message);
            process.exit(1);
        }
        return;
    }

    // 0. Check for pending manual broadcast push from admin panel
    const PENDING_FILE = path.join(__dirname, '..', 'data', 'pending_push.json');
    if (fs.existsSync(PENDING_FILE)) {
        try {
            const pendingData = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8') || '{}');
            const state = loadState();
            const lastSentBroadcastId = state.lastBroadcastId || '';

            if (pendingData && pendingData.pending === true) {
                const bId = pendingData.broadcastId || ('bcast_' + (pendingData.requestedAt || Date.now()));
                
                if (bId !== lastSentBroadcastId) {
                    console.log(`🚀 Found pending manual broadcast push [ID: ${bId}]: "${pendingData.title}" - "${pendingData.body}"`);
                    
                    // Mark as delivered in state and file IMMEDIATELY before sending to lock out parallel action runners
                    pendingData.pending = false;
                    pendingData.deliveredAt = Date.now();
                    fs.writeFileSync(PENDING_FILE, JSON.stringify(pendingData, null, 2), 'utf8');

                    state.lastBroadcastId = bId;
                    state.lastBroadcastTime = Date.now();
                    saveState(state);

                    await sendPushToAll({
                        broadcastId: bId,
                        title: pendingData.title || '⚠️ Gamingpig Status-Alarm',
                        body: pendingData.body || 'Status-Aktualisierung.',
                        translations: pendingData.translations || {
                            de: { title: pendingData.title, body: pendingData.body },
                            en: { title: pendingData.title, body: pendingData.body },
                            es: { title: pendingData.title, body: pendingData.body },
                            fr: { title: pendingData.title, body: pendingData.body },
                            pt: { title: pendingData.title, body: pendingData.body },
                            tr: { title: pendingData.title, body: pendingData.body }
                        },
                        url: pendingData.url || 'https://gamingpig.github.io/About-Gamingpig/status.html'
                    });
                    console.log('✅ Pending manual broadcast marked as delivered.');
                } else {
                    console.log(`Skipping already processed broadcast [ID: ${bId}].`);
                    pendingData.pending = false;
                    fs.writeFileSync(PENDING_FILE, JSON.stringify(pendingData, null, 2), 'utf8');
                }
            }
        } catch (e) {
            console.warn('Could not process pending push:', e.message);
        }
    }

    // Default: Check mode with state-aware deduplication and recovery push
    console.log('Checking health of monitored services...');
    const state = loadState();
    const lastFailures = state.lastFailures || [];
    const failures = await checkEndpoints();

    const failureSig = failures.map(f => (typeof f === 'object' ? f.id + (f.status || f.errorType || '') : f)).sort().join('|');
    const lastFailureSig = lastFailures.map(f => (typeof f === 'object' ? f.id + (f.status || f.errorType || '') : f)).sort().join('|');

    if (failures.length > 0) {
        console.warn('Failures detected:', JSON.stringify(failures));
        if (failureSig !== lastFailureSig) {
            await sendPushToAll({
                title: '🔴 Störung festgestellt – Gamingpig Portfolio',
                body: `Folgende Dienste antworten nicht: ${formatFailures(failures, 'de')}. Tippe hier für Sofort-Hilfen.`,
                translations: {
                    de: {
                        title: '🔴 Störung festgestellt – Gamingpig Portfolio',
                        body: `Folgende Dienste antworten nicht: ${formatFailures(failures, 'de')}. Tippe hier für Sofort-Hilfen.`
                    },
                    en: {
                        title: '🔴 Incident Detected – Gamingpig Portfolio',
                        body: `The following services are unreachable: ${formatFailures(failures, 'en')}. Tap here for troubleshooting.`
                    },
                    es: {
                        title: '🔴 Incidencia Detectada – Gamingpig Portfolio',
                        body: `Los siguientes servicios no responden: ${formatFailures(failures, 'es')}. Toca aquí para ver soluciones.`
                    },
                    fr: {
                        title: '🔴 Incident Détecté – Gamingpig Portfolio',
                        body: `Les services suivants sont indisponibles: ${formatFailures(failures, 'fr')}. Appuyez ici pour le dépannage.`
                    },
                    pt: {
                        title: '🔴 Falha Detectada – Gamingpig Portfolio',
                        body: `Os seguintes serviços não estão respondendo: ${formatFailures(failures, 'pt')}. Toque aqui para soluções.`
                    },
                    tr: {
                        title: '🔴 Sistem Kesintisi – Gamingpig Portfolio',
                        body: `Aşağıdaki servisler yanıt vermiyor: ${formatFailures(failures, 'tr')}. Çözüm için buraya dokunun.`
                    }
                },
                url: 'https://gamingpig.github.io/About-Gamingpig/status.html'
            });
        } else {
            console.log('Failure state unchanged from previous check. Skipping duplicate push notification.');
        }
    } else {
        // FIX: Prevent false recovery push when music is simply paused.
        // A recovery alert is ONLY sent if actual infrastructure endpoints (APIs) were previously down and have recovered.
        const realPreviousFailures = lastFailures.filter(f => (typeof f === 'object' ? f.id !== 'pi_offline' : f !== 'pi_offline'));
        const hadRealFailures = realPreviousFailures.length > 0;

        if (hadRealFailures) {
            console.log('🟢 Genuine API recovery detected! Sending recovery push notification...');
            await sendPushToAll({
                title: '🟢 Entwarnung – Alle Systeme wieder online',
                body: 'Spotify, stats.fm, Songtexte, Discord und CDNs laufen wieder im einwandfreien Normalbetrieb!',
                translations: {
                    de: {
                        title: '🟢 Entwarnung – Alle Systeme wieder online',
                        body: 'Spotify, stats.fm, Songtexte, Discord und CDNs laufen wieder im einwandfreien Normalbetrieb!'
                    },
                    en: {
                        title: '🟢 All Systems Operational – Gamingpig Portfolio',
                        body: 'Spotify, stats.fm, Lyrics, Discord, and CDNs have fully recovered and are running smoothly!'
                    },
                    es: {
                        title: '🟢 Todos los sistemas operativos – Gamingpig Portfolio',
                        body: '¡Spotify, stats.fm, letras y Discord han vuelto al funcionamiento normal!'
                    },
                    fr: {
                        title: '🟢 Tous les systèmes sont opérationnels – Gamingpig Portfolio',
                        body: 'Spotify, stats.fm, paroles, Discord et CDNs fonctionnent à nouveau normalement !'
                    },
                    pt: {
                        title: '🟢 Todos os sistemas operacionais – Gamingpig Portfolio',
                        body: 'Spotify, stats.fm, letras e Discord voltaram a funcionar normalmente!'
                    },
                    tr: {
                        title: '🟢 Tüm Sistemler Tekrar Çevrimiçi – Gamingpig Portfolio',
                        body: 'Spotify, stats.fm, şarkı sözleri ve Discord sorunsuz bir şekilde çalışıyor!'
                    }
                },
                url: 'https://gamingpig.github.io/About-Gamingpig/status.html'
            });
        } else {
            console.log('✅ All services operational. (No previous API outages to recover from).');
        }
    }

    saveState({
        lastFailures: failures,
        lastChecked: Date.now(),
        lastStatus: failures.length === 0 ? 'operational' : 'degraded'
    });
}

main().catch(err => {
    console.error('Fatal error in push-monitor:', err);
    process.exit(1);
});
