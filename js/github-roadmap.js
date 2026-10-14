/* GitHub is the source of truth. No browser token, optimistic votes or local wishes. */
(function () {
    'use strict';
    const REPO = 'Gamingpig/About-Gamingpig';
    const BASE = `https://github.com/${REPO}`;
    const API = `https://api.github.com/repos/${REPO}`;
    const REFRESH_MS = 5 * 60 * 1000;
    const MIN_REFRESH_MS = 60 * 1000;
    const CACHE_KEY = `gp_github_roadmap_v1:${REPO}`;
    let features = {};
    let lastAttempt = 0;
    let lastSuccess = 0;
    let retryAt = 0;
    let timer;
    let inFlight;
    let status = 'loading';

    const copy = {
        de: {
            privacy: 'Datenschutz: GitHub-Speicherung und Übertragung ↗',
            vote: 'Zum Abstimmen auf GitHub am ersten Beitrag 👍 wählen. Dein GitHub-Konto gilt auf allen Geräten.',
            hint: 'Öffentlich auf GitHub gespeichert, sobald du dort auf „Create“ klickst. GitHub-Konto erforderlich.',
            submit: '🚀 Auf GitHub einreichen',
            sub: 'Beschreibe deine Idee. Im nächsten Schritt bestätigst du sie auf GitHub mit deinem GitHub-Konto.',
            wishes: 'Community-Wünsche (neueste 30)', all: 'Alle Wünsche auf GitHub ansehen ↗',
            loading: 'GitHub-Daten werden geladen …', ready: 'Mit GitHub abgeglichen',
            error: 'GitHub derzeit nicht erreichbar. Vorhandene Zahlen sind der letzte bekannte Stand.',
            missing: 'Voting wird eingerichtet. Die GitHub-Feature-Issues fehlen noch.',
            invalid: 'Bitte alle Felder ausfüllen.', tooLong: 'Der Wunsch ist zu lang. Bitte kürzen.',
            next: 'Auf GitHub bestätigen – erst dann ist dein Wunsch gespeichert.',
            draft: 'Noch nicht abgesendeten lokalen Wunsch wiederherstellen',
            voteTitle: 'Auf GitHub mit 👍 abstimmen oder eigene Stimme entfernen'
        },
        en: {
            privacy: 'Privacy: GitHub storage and transfers ↗',
            vote: 'Vote with 👍 on the first GitHub post. Your GitHub account works across all devices.',
            hint: 'Saved publicly on GitHub once you click “Create” there. A GitHub account is required.',
            submit: '🚀 Submit on GitHub',
            sub: 'Describe your idea, then confirm it on GitHub using your GitHub account.',
            wishes: 'Community wishes (latest 30)', all: 'View all wishes on GitHub ↗',
            loading: 'Loading GitHub data …', ready: 'Synced with GitHub',
            error: 'GitHub is currently unavailable. Existing counts show the last known state.',
            missing: 'Voting setup is pending. The GitHub feature issues are missing.',
            invalid: 'Please complete all fields.', tooLong: 'Please shorten your wish.',
            next: 'Confirm on GitHub to save your wish.',
            draft: 'Restore an old local wish that has not been submitted',
            voteTitle: 'Vote with 👍 or remove your vote on GitHub'
        },
        es: {
            privacy: 'Privacidad: almacenamiento y transferencia a GitHub ↗',
            vote: 'Vota con 👍 en el primer mensaje de GitHub. Tu cuenta funciona en todos tus dispositivos.',
            hint: 'Se publica en GitHub al pulsar «Create». Necesitas una cuenta de GitHub.',
            submit: '🚀 Enviar en GitHub', sub: 'Describe tu idea y confírmala después en GitHub.',
            wishes: 'Ideas de la comunidad (últimas 30)', all: 'Ver todas las ideas en GitHub ↗',
            loading: 'Cargando datos de GitHub …', ready: 'Sincronizado con GitHub',
            error: 'GitHub no está disponible. Se muestra el último estado conocido.',
            missing: 'La votación aún no está configurada en GitHub.',
            invalid: 'Completa todos los campos.', tooLong: 'Acorta tu propuesta.',
            next: 'Confirma en GitHub para guardar tu idea.', draft: 'Recuperar una idea local aún no enviada',
            voteTitle: 'Votar con 👍 o retirar tu voto en GitHub'
        },
        fr: {
            privacy: 'Confidentialité : stockage et transmission à GitHub ↗',
            vote: 'Vote avec 👍 sur le premier message GitHub. Ton compte fonctionne sur tous tes appareils.',
            hint: 'Publié sur GitHub après un clic sur «Create». Un compte GitHub est nécessaire.',
            submit: '🚀 Envoyer sur GitHub', sub: 'Décris ton idée, puis confirme-la sur GitHub.',
            wishes: 'Idées de la communauté (30 dernières)', all: 'Voir toutes les idées sur GitHub ↗',
            loading: 'Chargement des données GitHub …', ready: 'Synchronisé avec GitHub',
            error: 'GitHub est indisponible. Le dernier état connu est affiché.',
            missing: 'Le vote doit encore être configuré sur GitHub.',
            invalid: 'Remplis tous les champs.', tooLong: 'Raccourcis ton idée.',
            next: 'Confirme sur GitHub pour enregistrer ton idée.', draft: 'Restaurer une idée locale pas encore envoyée',
            voteTitle: 'Voter avec 👍 ou retirer ton vote sur GitHub'
        },
        pt: {
            privacy: 'Privacidade: armazenamento e transferência ao GitHub ↗',
            vote: 'Vote com 👍 na primeira mensagem do GitHub. Sua conta funciona em todos os dispositivos.',
            hint: 'Publicado no GitHub ao clicar em “Create”. É necessária uma conta do GitHub.',
            submit: '🚀 Enviar no GitHub', sub: 'Descreva sua ideia e confirme depois no GitHub.',
            wishes: 'Ideias da comunidade (30 mais recentes)', all: 'Ver todas as ideias no GitHub ↗',
            loading: 'Carregando dados do GitHub …', ready: 'Sincronizado com GitHub',
            error: 'GitHub indisponível. Exibindo o último estado conhecido.',
            missing: 'A votação ainda precisa ser configurada no GitHub.',
            invalid: 'Preencha todos os campos.', tooLong: 'Encurte sua ideia.',
            next: 'Confirme no GitHub para salvar sua ideia.', draft: 'Restaurar uma ideia local ainda não enviada',
            voteTitle: 'Votar com 👍 ou retirar seu voto no GitHub'
        },
        tr: {
            privacy: 'Gizlilik: GitHub’da saklama ve aktarım ↗',
            vote: 'GitHub’daki ilk gönderiye 👍 ile oy ver. Hesabın tüm cihazlarında geçerlidir.',
            hint: 'GitHub’da “Create” tıklandığında herkese açık kaydedilir. GitHub hesabı gerekir.',
            submit: '🚀 GitHub’da gönder', sub: 'Fikrini yaz, ardından GitHub’da onayla.',
            wishes: 'Topluluk fikirleri (son 30)', all: 'GitHub’da tüm fikirleri gör ↗',
            loading: 'GitHub verileri yükleniyor …', ready: 'GitHub ile eşitlendi',
            error: 'GitHub’a ulaşılamıyor. Son bilinen durum gösteriliyor.',
            missing: 'GitHub oylaması henüz kurulmadı.',
            invalid: 'Tüm alanları doldur.', tooLong: 'Fikrini kısalt.',
            next: 'Fikrini kaydetmek için GitHub’da onayla.', draft: 'Gönderilmemiş yerel fikri geri yükle',
            voteTitle: 'GitHub’da 👍 ile oy ver veya oyunu geri çek'
        }
    };
    function strings() {
        return copy[document.getElementById('lang-select')?.value] || copy.en;
    }
    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }
    function updateCopy() {
        const c = strings();
        for (const [id, key] of Object.entries({ 'github-vote-hint': 'vote', 'form-hint': 'hint',
            'btn-submit-wish': 'submit', 'form-subtitle': 'sub', 'user-wishes-title': 'wishes',
            'github-all-wishes': 'all', 'github-restore-draft': 'draft', 'roadmap-privacy-link': 'privacy' })) setText(id, c[key]);
        setText('github-sync-status', c[status] + (lastSuccess ? ` · ${new Date(lastSuccess).toLocaleTimeString()}` : ''));
        document.querySelectorAll('.vote-btn').forEach(btn => { btn.title = c.voteTitle; });
    }
    function issueUrl(number) {
        return `${BASE}/issues/${Number(number)}`;
    }
    function selectFeatures(issues) {
        const result = {};
        for (const issue of issues) {
            const match = /^\[Roadmap #(\d+)\]/.exec(issue.title || '');
            if (issue.pull_request || !match || !Number.isSafeInteger(issue.number)) continue;
            const id = Number(match[1]);
            if (id < 1 || id > 6 || (result[id] && result[id].number < issue.number)) continue;
            result[id] = { number: issue.number, votes: Math.max(0, Number(issue.reactions?.['+1']) || 0) };
        }
        return result;
    }
    function render(data) {
        features = data.features;
        document.querySelectorAll('[data-feature-id]').forEach(el => {
            const feature = features[el.dataset.featureId];
            el.textContent = feature ? String(feature.votes) : '–';
        });
        const list = document.getElementById('user-wishes-list');
        list.replaceChildren();
        for (const wish of data.wishes) {
            const item = document.createElement('a');
            item.href = issueUrl(wish.number);
            item.target = '_blank';
            item.rel = 'noopener noreferrer';
            item.className = 'block p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-500/50';
            const heading = document.createElement('div');
            heading.className = 'font-bold text-sm text-white truncate';
            heading.textContent = wish.title;
            const meta = document.createElement('div');
            meta.className = 'text-xs text-slate-400 mt-1';
            meta.textContent = `@${wish.author} · ${new Date(wish.date).toLocaleDateString()} · ${wish.state} · 👍 ${wish.votes}`;
            const body = document.createElement('div');
            body.className = 'text-xs text-slate-400 mt-1 line-clamp-2 whitespace-pre-line';
            body.textContent = wish.body;
            if (wish.parentWishTitle || wish.parentWishId) {
                const badge = document.createElement('div');
                badge.className = 'sub-badge inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono font-bold mb-1.5';
                badge.textContent = `↳ Ergänzung zu: ${wish.parentWishTitle || wish.parentWishId}`;
                item.append(badge, heading, meta, body);
            } else {
                item.append(heading, meta, body);
            }
            list.appendChild(item);
        }
        const optWishes = document.getElementById('optgroup-community-wishes');
        if (optWishes && typeof optWishes.replaceChildren === 'function') {
            const options = [];
            for (const wish of data.wishes) {
                const opt = document.createElement('option');
                opt.value = wish.id || String(wish.number);
                opt.textContent = wish.title;
                opt.dataset.title = wish.title;
                options.push(opt);
            }
            optWishes.replaceChildren(...options);
        }
        populateRoadmapCards();
        document.getElementById('community-wishes-container').classList.toggle('hidden', data.wishes.length === 0);
    }
    function populateRoadmapCards() {
        const optCards = document.getElementById('optgroup-roadmap-cards');
        if (!optCards || typeof optCards.replaceChildren !== 'function') return;
        const options = [];
        for (let i = 1; i <= 6; i++) {
            const titleEl = document.getElementById(`card-${i}-title`);
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
            options.push(opt);
        }
        optCards.replaceChildren(...options);
    }
    async function getIssues(label, count, direction) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
            const response = await fetch(`${API}/issues?state=all&labels=${label}&per_page=${count}&sort=created&direction=${direction}`, {
                headers: { Accept: 'application/vnd.github+json' }, cache: 'no-cache', signal: controller.signal
            });
            if (!response.ok) {
                const reset = Number(response.headers.get('x-ratelimit-reset')) * 1000;
                const retry = Number(response.headers.get('retry-after')) * 1000;
                if (response.status === 403 || response.status === 429) {
                    retryAt = Math.max(retryAt, Date.now() + REFRESH_MS, reset || 0, Date.now() + (retry || 0));
                }
                throw new Error(`GitHub ${response.status}`);
            }
            const issues = await response.json();
            if (!Array.isArray(issues)) throw new Error('Invalid GitHub response');
            return issues;
        } finally { clearTimeout(timeout); }
    }
    function schedule(delay = REFRESH_MS) {
        clearTimeout(timer);
        if (!document.hidden) timer = setTimeout(sync, Math.max(delay, retryAt - Date.now()));
    }
    function sync() {
        if (document.hidden || inFlight) return inFlight;
        if (navigator.onLine === false) { status = 'error'; updateCopy(); return; }
        if (Date.now() < retryAt || Date.now() - lastAttempt < MIN_REFRESH_MS) {
            schedule(Math.max(1, MIN_REFRESH_MS - (Date.now() - lastAttempt))); return;
        }
        lastAttempt = Date.now();
        inFlight = (async () => {
            try {
                const results = await Promise.allSettled([
                    getIssues('roadmap-feature', 100, 'asc'), getIssues('community-wish', 30, 'desc')
                ]);
                if (results.some(result => result.status === 'rejected')) throw new Error('GitHub sync failed');
                const data = {
                    features: selectFeatures(results[0].value),
                    wishes: results[1].value.filter(issue => !issue.pull_request).map(issue => ({
                        number: issue.number, title: issue.title, author: issue.user?.login || 'GitHub',
                        body: (issue.body || '').slice(0, 1500), date: issue.created_at,
                        state: issue.state, votes: Math.max(0, Number(issue.reactions?.['+1']) || 0)
                    })), time: Date.now()
                };
                render(data);
                lastSuccess = data.time;
                status = Object.keys(features).length === 6 ? 'ready' : 'missing';
                try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (_) { /* Storage is optional. */ }
            } catch (_) { status = 'error'; }
            finally { inFlight = null; updateCopy(); schedule(); }
        })();
        return inFlight;
    }
    function voteFeature(id) {
        const feature = features[id];
        if (!feature) { window.showToast(strings().missing, '⚠️'); sync(); return; }
        window.open(issueUrl(feature.number), '_blank', 'noopener,noreferrer');
    }
    function submitWish(event) {
        event.preventDefault();
        const author = document.getElementById('wish-author').value.trim();
        const category = document.getElementById('wish-category').value;
        const title = document.getElementById('wish-title').value.trim();
        const desc = document.getElementById('wish-desc').value.trim();
        if (!author || !title || !desc) { window.showToast(strings().invalid, '⚠️'); return; }
        const isReply = Boolean(document.getElementById('wish-type-reply')?.checked);
        const parentSelect = document.getElementById('parent-wish-select');
        let parentWishId = undefined;
        let parentWishTitle = undefined;
        if (isReply && parentSelect && parentSelect.value) {
            parentWishId = parentSelect.value.trim();
            const selectedOpt = parentSelect.options ? parentSelect.options[parentSelect.selectedIndex] : null;
            parentWishTitle = selectedOpt ? selectedOpt.textContent.trim() : parentWishId;
        }
        const url = new URL(`${BASE}/issues/new`);
        url.searchParams.set('template', 'community-wish.md');
        url.searchParams.set('title', `[Wunsch] ${title}`);
        let body = `### Name / Discord\n${author}\n\n### Kategorie\n${category}\n\n### Wunsch\n${desc}`;
        if (parentWishId) {
            body += `\n\n### Bezug\n${parentWishTitle || parentWishId}`;
        }
        url.searchParams.set('body', body);
        if (url.href.length > 7500) { window.showToast(strings().tooLong, '⚠️'); return; }
        window.open(url.href, '_blank', 'noopener,noreferrer');
        // Keep the form intact: opening GitHub does not mean the issue was submitted.
        window.showToast(strings().next, '↗️');
    }
    function init() {
        try {
            const saved = JSON.parse(localStorage.getItem(CACHE_KEY));
            if (saved && saved.features && Array.isArray(saved.wishes)) {
                render(saved); lastSuccess = saved.time; status = 'loading';
            }
        } catch (_) { /* A missing or invalid cache never prevents a network read. */ }
        const newRadio = document.getElementById('wish-type-new');
        const replyRadio = document.getElementById('wish-type-reply');
        const wrapper = document.getElementById('parent-wish-wrapper');
        if (newRadio && replyRadio && wrapper) {
            const toggle = () => {
                wrapper.style.display = replyRadio.checked ? 'block' : 'none';
            };
            newRadio.addEventListener('change', toggle);
            replyRadio.addEventListener('change', toggle);
        }
        populateRoadmapCards();
        // Preserve access to wishes left by the previous local-only implementation.
        try {
            const drafts = JSON.parse(localStorage.getItem('gp_community_wishes') || '[]');
            if (Array.isArray(drafts) && drafts.length) {
                const button = document.createElement('button');
                button.type = 'button'; button.id = 'github-restore-draft';
                button.className = 'text-xs text-purple-400 underline';
                let index = 0;
                button.addEventListener('click', () => {
                    const draft = drafts[index++ % drafts.length];
                    for (const key of ['author', 'category', 'title', 'desc']) {
                        document.getElementById(`wish-${key}`).value = String(draft[key] || '');
                    }
                });
                document.querySelector('#wish-form-section form').appendChild(button);
            }
        } catch (_) { /* Legacy storage is optional. */ }
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) clearTimeout(timer); else sync();
        });
        window.addEventListener('focus', sync);
        window.addEventListener('online', sync);
        document.getElementById('lang-select').addEventListener('change', updateCopy);
        updateCopy();
        sync();
    }
    window.voteFeature = voteFeature;
    window.submitWish = submitWish;
    window.GitHubRoadmap = { init, updateCopy };
})();
