/* Direct, account-free submissions. GitHub is durable storage; ntfy is only a queue. */
(function () {
    'use strict';
    const P = window.RoadmapProtocol;
    const DATA_URL = 'https://raw.githubusercontent.com/Gamingpig/About-Gamingpig/main/data/roadmap.json';
    const ID_KEY = 'gp_roadmap_identity_v2';
    const PENDING_KEY = 'gp_roadmap_pending_v2';
    const CACHE_KEY = 'gp_roadmap_cache_v2';
    let data = null, voter = null, status = 'loading', busy = false, inFlight = null;
    let lastAttempt = 0, timer, identityPromise;
    const copy = {"de": {"vote": "Direkt abstimmen, ohne Anmeldung. Gemeinsame Ergebnisse werden nach dem GitHub-Abgleich aktualisiert.", "hint": "Dein Wunsch wird über ntfy an das öffentliche GitHub-Repository gesendet. Bitte keine vertraulichen Daten eintragen.", "submit": "Wunsch einreichen", "sub": "Beschreibe deine Idee und sende sie direkt hier ab.", "wishes": "Community-Wünsche (neueste 30)", "all": "Alle gespeicherten Wünsche ansehen ↗", "loading": "Daten werden geladen …", "ready": "Mit GitHub abgeglichen", "error": "Abgleich derzeit nicht möglich; angezeigt wird der letzte bekannte Stand.", "invalid": "Bitte alle Felder ausfüllen.", "failed": "Übertragung nicht bestätigt. Eingabe prüfen; HTTPS, Browser-Speicher und Netzwerk müssen verfügbar sein.", "queued": "In Warteschlange – noch nicht dauerhaft auf GitHub gespeichert.", "pending": "Ausstehende Einträge", "retry": "Erneut senden", "saved": "Gespeichert auf GitHub", "voteTitle": "Abstimmen / eigene Stimme zurückziehen", "privacy": "Datenschutz: Speicherung bei ntfy und GitHub ↗", "copy": "Gerätecode kopieren", "paste": "Gerätecode einfügen", "copied": "Privater Gerätecode kopiert. Nur auf deinen eigenen Geräten verwenden.", "prompt": "Gerätecode vom anderen eigenen Gerät einfügen:", "connected": "Gerät verbunden.", "wait": "Bitte zuerst ausstehende Einträge synchronisieren.", "draft": "Lokalen Wunsch wiederherstellen"}, "en": {"vote": "Vote here without signing in. Shared results update after GitHub synchronization.", "hint": "Your wish is sent through ntfy to the public GitHub repository. Do not enter confidential data.", "submit": "Submit wish", "sub": "Describe your idea and submit it here.", "wishes": "Community wishes (latest 30)", "all": "View all saved wishes ↗", "loading": "Loading data …", "ready": "Synced with GitHub", "error": "Sync unavailable; showing the last known state.", "invalid": "Please complete all fields.", "failed": "Transfer not confirmed. Check your input; HTTPS, browser storage and network must be available.", "queued": "Queued – not yet saved permanently on GitHub.", "pending": "Pending entries", "retry": "Retry sending", "saved": "Saved on GitHub", "voteTitle": "Vote / withdraw your vote", "privacy": "Privacy: storage at ntfy and GitHub ↗", "copy": "Copy device code", "paste": "Paste device code", "copied": "Private device code copied. Use only on your own devices.", "prompt": "Paste the code from your other device:", "connected": "Device connected.", "wait": "Please sync pending entries first.", "draft": "Restore local wish"}, "es": {"vote": "Vota aquí sin registrarte. Los resultados se actualizan tras sincronizar con GitHub.", "hint": "Tu idea se envía mediante ntfy al repositorio público de GitHub. No incluyas datos confidenciales.", "submit": "Enviar idea", "sub": "Describe tu idea y envíala aquí.", "wishes": "Ideas de la comunidad (últimas 30)", "all": "Ver todas las ideas guardadas ↗", "loading": "Cargando datos …", "ready": "Sincronizado con GitHub", "error": "Sin conexión; mostrando el último estado conocido.", "invalid": "Completa todos los campos.", "failed": "Envío no confirmado. Revisa los datos, HTTPS, almacenamiento y conexión.", "queued": "En cola; aún no guardado permanentemente en GitHub.", "pending": "Entradas pendientes", "retry": "Reintentar", "saved": "Guardado en GitHub", "voteTitle": "Votar / retirar tu voto", "privacy": "Privacidad: almacenamiento en ntfy y GitHub ↗", "copy": "Copiar código de dispositivo", "paste": "Pegar código de dispositivo", "copied": "Código privado copiado. Úsalo solo en tus dispositivos.", "prompt": "Pega el código de tu otro dispositivo:", "connected": "Dispositivo conectado.", "wait": "Sincroniza primero las entradas pendientes.", "draft": "Recuperar idea local"}, "fr": {"vote": "Vote ici sans inscription. Les résultats sont actualisés après synchronisation GitHub.", "hint": "Ton idée est envoyée via ntfy au dépôt public GitHub. Ne saisis aucune donnée confidentielle.", "submit": "Envoyer une idée", "sub": "Décris ton idée et envoie-la ici.", "wishes": "Idées de la communauté (30 dernières)", "all": "Voir toutes les idées enregistrées ↗", "loading": "Chargement …", "ready": "Synchronisé avec GitHub", "error": "Synchronisation indisponible ; dernier état connu affiché.", "invalid": "Remplis tous les champs.", "failed": "Envoi non confirmé. Vérifie les données, HTTPS, le stockage et la connexion.", "queued": "En attente ; pas encore enregistré durablement sur GitHub.", "pending": "Envois en attente", "retry": "Réessayer", "saved": "Enregistré sur GitHub", "voteTitle": "Voter / retirer ton vote", "privacy": "Confidentialité : stockage chez ntfy et GitHub ↗", "copy": "Copier le code appareil", "paste": "Coller le code appareil", "copied": "Code privé copié. À utiliser uniquement sur tes appareils.", "prompt": "Colle le code de ton autre appareil :", "connected": "Appareil connecté.", "wait": "Synchronise d’abord les envois en attente.", "draft": "Restaurer une idée locale"}, "pt": {"vote": "Vote aqui sem cadastro. Os resultados atualizam após sincronizar com GitHub.", "hint": "Sua ideia é enviada pelo ntfy ao repositório público GitHub. Não inclua dados confidenciais.", "submit": "Enviar ideia", "sub": "Descreva sua ideia e envie aqui.", "wishes": "Ideias da comunidade (30 recentes)", "all": "Ver todas as ideias salvas ↗", "loading": "Carregando dados …", "ready": "Sincronizado com GitHub", "error": "Sem sincronização; exibindo o último estado conhecido.", "invalid": "Preencha todos os campos.", "failed": "Envio não confirmado. Verifique os dados, HTTPS, armazenamento e conexão.", "queued": "Na fila; ainda não salvo permanentemente no GitHub.", "pending": "Envios pendentes", "retry": "Reenviar", "saved": "Salvo no GitHub", "voteTitle": "Votar / retirar seu voto", "privacy": "Privacidade: armazenamento no ntfy e GitHub ↗", "copy": "Copiar código do dispositivo", "paste": "Colar código do dispositivo", "copied": "Código privado copiado. Use apenas nos seus dispositivos.", "prompt": "Cole o código do seu outro dispositivo:", "connected": "Dispositivo conectado.", "wait": "Sincronize primeiro os envios pendentes.", "draft": "Restaurar ideia local"}, "tr": {"vote": "Kayıt olmadan oy ver. Ortak sonuçlar GitHub eşitlemesinden sonra yenilenir.", "hint": "Fikrin ntfy üzerinden herkese açık GitHub deposuna gönderilir. Gizli veri yazma.", "submit": "Fikir gönder", "sub": "Fikrini yaz ve buradan gönder.", "wishes": "Topluluk fikirleri (son 30)", "all": "Kaydedilen tüm fikirleri gör ↗", "loading": "Veriler yükleniyor …", "ready": "GitHub ile eşitlendi", "error": "Eşitleme yok; son bilinen durum gösteriliyor.", "invalid": "Tüm alanları doldur.", "failed": "Aktarım onaylanmadı. Girişleri, HTTPS, depolama ve bağlantıyı kontrol et.", "queued": "Kuyrukta; GitHub’a henüz kalıcı kaydedilmedi.", "pending": "Bekleyen girişler", "retry": "Yeniden gönder", "saved": "GitHub’a kaydedildi", "voteTitle": "Oy ver / oyunu geri çek", "privacy": "Gizlilik: ntfy ve GitHub’da saklama ↗", "copy": "Cihaz kodunu kopyala", "paste": "Cihaz kodunu yapıştır", "copied": "Özel kod kopyalandı. Yalnızca kendi cihazlarında kullan.", "prompt": "Diğer cihazının kodunu yapıştır:", "connected": "Cihaz bağlandı.", "wait": "Önce bekleyen girişleri eşitle.", "draft": "Yerel fikri geri yükle"}};

    const el = id => document.getElementById(id);
    const strings = () => copy[el('lang-select')?.value] || copy.en;
    const text = (id, value) => { if (el(id)) el(id).textContent = value; };
    function pending() {
        const entries = JSON.parse(localStorage.getItem(PENDING_KEY) || '[]');
        if (!Array.isArray(entries)) throw new Error('Invalid pending data');
        return entries;
    }
    function writePending(entries) { localStorage.setItem(PENDING_KEY, JSON.stringify(entries)); }
    async function identity() {
        if (!identityPromise) identityPromise = (async () => {
            let keys = JSON.parse(localStorage.getItem(ID_KEY) || 'null');
            if (!keys) {
                const generated = await P.identity();
                keys = JSON.parse(localStorage.getItem(ID_KEY) || 'null') || generated;
                localStorage.setItem(ID_KEY, JSON.stringify(keys));
            }
            voter = await P.voterId(keys.publicKey);
            return keys;
        })().catch(error => { identityPromise = null; throw error; });
        return identityPromise;
    }
    function updateCopy() {
        const c = strings();
        for (const [id, key] of Object.entries({ 'github-vote-hint':'vote', 'form-hint':'hint',
            'btn-submit-wish':'submit', 'form-subtitle':'sub', 'user-wishes-title':'wishes',
            'github-all-wishes':'all', 'roadmap-privacy-link':'privacy', 'roadmap-retry':'retry',
            'roadmap-copy':'copy', 'roadmap-paste':'paste', 'github-restore-draft':'draft' })) text(id,c[key]);
        let count = 0;
        try { count = pending().length; } catch (_) {}
        text('github-sync-status', c[status] + (data?.updatedAt ? ' · ' + new Date(data.updatedAt).toLocaleString() : '') +
            (count ? ` · ${c.pending}: ${count}` : ''));
        if (el('roadmap-retry')) el('roadmap-retry').hidden = !count;
        document.querySelectorAll('.vote-btn').forEach(btn => { btn.title = c.voteTitle; });
        updateVoteStatus();
    }
    function updateVoteStatus() {
        const labels = {
            de: ['✓ Du hast abgestimmt', '⏳ Stimme ausstehend', '⏳ Rücknahme ausstehend'],
            en: ['✓ You voted', '⏳ Vote pending', '⏳ Withdrawal pending'],
            es: ['✓ Has votado', '⏳ Voto pendiente', '⏳ Retirada pendiente'],
            fr: ['✓ Tu as voté', '⏳ Vote en attente', '⏳ Retrait en attente'],
            pt: ['✓ Você votou', '⏳ Voto pendente', '⏳ Retirada pendente'],
            tr: ['✓ Oy verdin', '⏳ Oy bekliyor', '⏳ Geri çekme bekliyor']
        };
        const c = labels[el('lang-select')?.value] || labels.en;
        const confirmed = data?.voters[voter] || { revision: 0, features: [] };
        let latest = confirmed;
        try {
            for (const entry of pending()) {
                const action = JSON.parse(entry.message);
                if (action.type === 'vote' && action.revision > latest.revision) latest = action;
            }
        } catch (_) { /* Confirmed votes remain visible if local storage is unavailable. */ }
        for (let id = 1; id <= 6; id++) {
            const badge = el('vote-status-' + id);
            if (!badge) continue;
            const voted = confirmed.features.includes(id);
            const requested = latest.features.includes(id);
            const waiting = requested !== voted;
            badge.textContent = waiting ? c[requested ? 1 : 2] : voted ? c[0] : '';
            badge.hidden = !badge.textContent;
            badge.className = 'text-[10px] font-medium ' + (waiting ? 'text-amber-400' : 'text-emerald-400');
        }
    }
    function render() {
        if (!data) return;
        const confirmed = data.voters[voter]?.features || [];
        document.querySelectorAll('[data-feature-id]').forEach(node => {
            const id = Number(node.dataset.featureId);
            node.textContent = String(data.votes[id] || 0);
            const button = node.closest('button');
            button.classList.toggle('bg-purple-600', confirmed.includes(id));
            button.setAttribute('aria-pressed', String(confirmed.includes(id)));
        });
        const list = el('user-wishes-list');
        list.replaceChildren();
        for (const wish of data.wishes.slice(0,30)) {
            const item = document.createElement('div');
            item.className = 'block p-3.5 rounded-2xl bg-white/5 border border-white/10';
            if (wish.parentWishTitle || wish.parentWishId) {
                const badge = document.createElement('div');
                badge.className = 'sub-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold mb-1.5';
                badge.textContent = `↳ Ergänzung zu: ${wish.parentWishTitle || wish.parentWishId}`;
                item.appendChild(badge);
            }
            for (const [value,cls] of [
                [wish.title,'font-bold text-sm text-white'],
                [`${wish.author} · ${wish.category} · ${new Date(wish.date).toLocaleDateString()}`,'text-xs text-slate-400 mt-1'],
                [wish.desc,'text-xs text-slate-400 mt-1 whitespace-pre-line']
            ]) {
                const node = document.createElement('div'); node.className = cls; node.textContent = value; item.appendChild(node);
            }
            list.appendChild(item);
        }
        const optWishes = el('optgroup-community-wishes');
        if (optWishes) {
            optWishes.replaceChildren();
            for (const wish of data.wishes) {
                const opt = document.createElement('option');
                opt.value = wish.id;
                opt.textContent = wish.title;
                opt.dataset.title = wish.title;
                optWishes.appendChild(opt);
            }
        }
        populateRoadmapCards();
        el('community-wishes-container').classList.toggle('hidden', data.wishes.length === 0);
        updateVoteStatus();
    }
    function populateRoadmapCards() {
        const optCards = el('optgroup-roadmap-cards');
        if (!optCards) return;
        optCards.replaceChildren();
        for (let i = 1; i <= 6; i++) {
            const titleEl = el(`card-${i}-title`);
            let title = '';
            if (titleEl) {
                const icon = titleEl.previousElementSibling?.textContent?.trim() || '';
                title = (icon ? icon + ' ' : '') + titleEl.textContent.trim();
            }
            if (!title) {
                const defaults = [
                    '🏎️ Echtzeit Kartbahn Telemetrie & Live-Tracker',
                    '🎚️ KI-DJ & Nahtlose 3D Audio-Transitionen',
                    '🎮 Community Mini-Game (Retro Arcade)',
                    '📲 Interaktive Widgets für iOS & Android Homescreen',
                    '✨ Überall Liquid Glass',
                    '🎙️ Eigene KI-Stimmen für Songtext-Vorlesen'
                ];
                title = defaults[i - 1];
            }
            const opt = document.createElement('option');
            opt.value = `card-${i}`;
            opt.textContent = title;
            opt.dataset.title = title;
            optCards.appendChild(opt);
        }
    }
    function schedule(delay = 300000) {
        clearTimeout(timer);
        if (!document.hidden) timer = setTimeout(sync, delay);
    }
    async function sync() {
        if (document.hidden || busy || inFlight) return inFlight;
        if (navigator.onLine === false) { status = 'error'; updateCopy(); return; }
        if (Date.now()-lastAttempt < 60000) { schedule(60000-(Date.now()-lastAttempt)); return; }
        lastAttempt = Date.now();
        inFlight = (async () => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(),12000);
            try {
                const response = await fetch(DATA_URL + '?t=' + Math.floor(Date.now()/60000), { cache:'no-store',signal:controller.signal });
                if (!response.ok) throw new Error('Read failed');
                const next = await response.json();
                if (next.schema !== 1 || !next.votes || !next.voters || !Array.isArray(next.wishes)) throw new Error('Invalid state');
                data = next; status = 'ready';
                try {
                    const before = pending();
                    const after = before.filter(entry => {
                        const p = JSON.parse(entry.message);
                        if (p.type === 'wish') return !data.wishes.some(w => w.id === p.id);
                        return (data.voters[voter]?.revision || 0) < p.revision;
                    });
                    writePending(after);
                    if (after.length < before.length) window.showToast(strings().saved);
                    localStorage.setItem(CACHE_KEY,JSON.stringify(data));
                } catch (_) { /* The read remains valid when local storage is blocked. */ }
                render();
            } catch (_) { status = 'error'; }
            finally { clearTimeout(timeout); inFlight = null; updateCopy(); schedule(); }
        })();
        return inFlight;
    }
    async function post(entry) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(),12000);
        try {
            const body = JSON.stringify(entry);
            const response = await fetch(P.QUEUE, { method:'POST',body,signal:controller.signal });
            if (!response.ok) throw new Error('Queue rejected entry');
            const receipt = await response.json();
            if (receipt.event !== 'message' || receipt.message !== body) throw new Error('No queue receipt');
        } finally { clearTimeout(timeout); }
    }
    async function submitAction(build) {
        if (busy) return;
        busy = true;
        try {
            const run = async () => {
                const keys = await identity();
                const entries = pending();
                if (entries.length >= 20) throw new Error('Pending queue full');
                const action = build(entries);
                const duplicate = action.type === 'wish' && entries.find(entry => {
                    const p = JSON.parse(entry.message);
                    return entry.publicKey.x === keys.publicKey.x && entry.publicKey.y === keys.publicKey.y &&
                        p.type === 'wish' && ['author','category','title','desc'].every(key => p[key] === action[key]) &&
                        p.parentWishId === action.parentWishId && p.parentWishTitle === action.parentWishTitle;
                });
                if (duplicate) { await post(duplicate); window.showToast(strings().queued,'⏳'); return true; }
                const entry = await P.sign(keys,action);
                // Keep the signed payload before sending, so an uncertain response can be retried safely.
                writePending([...entries,entry]);
                updateCopy();
                await post(entry);
                window.showToast(strings().queued,'⏳');
                return true;
            };
            return navigator.locks ? await navigator.locks.request('gp-roadmap-write',run) : await run();
        } catch (_) { window.showToast(strings().failed,'⚠️'); return false; }
        finally { busy = false; updateCopy(); schedule(60000); }
    }
    async function voteFeature(id) {
        if (!data) { window.showToast(strings().error,'⚠️'); return; }
        await submitAction(entries => {
            const old = data.voters[voter] || { revision:0,features:[] };
            const latest = entries.map(e=>JSON.parse(e.message)).filter(p=>p.type==='vote')
                .reduce((a,b)=>b.revision>a.revision?b:a,old);
            const selected = new Set(latest.features);
            if (selected.has(id)) selected.delete(id); else selected.add(id);
            return { type:'vote',features:[...selected].sort(),revision:Math.max(latest.revision+1,Date.now()) };
        });
    }
    async function submitWish(event) {
        event.preventDefault();
        const fields = Object.fromEntries(['author','category','title','desc'].map(key=>[key,el('wish-'+key).value.trim()]));
        if (Object.values(fields).some(value=>!value)) { window.showToast(strings().invalid,'⚠️'); return; }
        const isReply = el('wish-type-reply')?.checked;
        const parentSelect = el('parent-wish-select');
        let parentWishId = undefined;
        let parentWishTitle = undefined;
        if (isReply && parentSelect && parentSelect.value) {
            parentWishId = parentSelect.value.trim();
            const selectedOpt = parentSelect.options ? parentSelect.options[parentSelect.selectedIndex] : null;
            parentWishTitle = selectedOpt ? selectedOpt.textContent.trim() : parentWishId;
        }
        const actionPayload = {
            type: 'wish',
            ...fields,
            ...(parentWishId ? { parentWishId, parentWishTitle } : {})
        };
        const accepted = await submitAction(()=>actionPayload);
        // Only clear unchanged input after ntfy confirms receipt. Pending status remains until GitHub confirms.
        if (accepted && Object.entries(fields).every(([key,value])=>el('wish-'+key).value.trim()===value)) {
            event.target.reset();
            if (el('wish-type-new')) el('wish-type-new').checked = true;
            if (el('parent-wish-wrapper')) el('parent-wish-wrapper').style.display = 'none';
            if (parentSelect) parentSelect.value = '';
        }
    }
    async function retryPending() {
        if (busy) return;
        busy=true;
        try {
            for (const entry of pending()) await post(entry);
            window.showToast(strings().queued,'⏳');
        } catch (_) { window.showToast(strings().failed,'⚠️'); }
        finally { busy=false; updateCopy(); schedule(60000); }
    }
    async function copyDevice() {
        try {
            if (pending().length) { window.showToast(strings().wait,'⏳'); return; }
            const code=JSON.stringify(await identity());
            await navigator.clipboard.writeText(code);
            window.showToast(strings().copied,'🔑');
        } catch (_) { window.showToast(strings().failed,'⚠️'); }
    }
    async function pasteDevice() {
        if (busy) return;
        try {
            if (pending().length) { window.showToast(strings().wait,'⏳'); return; }
            const raw=window.prompt(strings().prompt); if (!raw) return;
            const keys=JSON.parse(raw);
            const probe=await P.sign(keys,{type:'vote',revision:1,features:[]});
            if (!await P.verify(probe)) throw new Error('Invalid device code');
            localStorage.setItem(ID_KEY,JSON.stringify(keys));
            identityPromise=null; await identity(); render();
            window.showToast(strings().connected);
            lastAttempt=0; sync();
        } catch (_) { window.showToast(strings().failed,'⚠️'); }
    }
    async function init() {
        try {
            if (localStorage.getItem(ID_KEY)) await identity(); // No key generation on a read-only visit.
            const saved=JSON.parse(localStorage.getItem(CACHE_KEY)||'null');
            if (saved?.schema===1) { data=saved; render(); }
        } catch (_) {}
        el('roadmap-retry').addEventListener('click',retryPending);
        el('roadmap-copy').addEventListener('click',copyDevice);
        el('roadmap-paste').addEventListener('click',pasteDevice);
        const newRadio = el('wish-type-new');
        const replyRadio = el('wish-type-reply');
        const wrapper = el('parent-wish-wrapper');
        if (newRadio && replyRadio && wrapper) {
            const toggle = () => {
                wrapper.style.display = replyRadio.checked ? 'block' : 'none';
            };
            newRadio.addEventListener('change', toggle);
            replyRadio.addEventListener('change', toggle);
        }
        populateRoadmapCards();
        try {
            const drafts=JSON.parse(localStorage.getItem('gp_community_wishes')||'[]');
            if (Array.isArray(drafts) && drafts.length) {
                const button=document.createElement('button'); button.type='button'; button.id='github-restore-draft';
                button.className='text-xs text-purple-400 underline'; let index=0;
                button.addEventListener('click',()=>{
                    const draft=drafts[index++%drafts.length];
                    for (const key of ['author','category','title','desc']) el('wish-'+key).value=String(draft[key]||'');
                });
                document.querySelector('#wish-form-section form').appendChild(button);
            }
        } catch (_) {}
        document.addEventListener('visibilitychange',()=>{ if(document.hidden) clearTimeout(timer); else sync(); });
        window.addEventListener('focus',sync); window.addEventListener('online',sync);
        el('lang-select').addEventListener('change',updateCopy);
        updateCopy(); sync();
    }
    window.voteFeature=voteFeature; window.submitWish=submitWish;
    window.GitHubRoadmap={init,updateCopy};
})();
