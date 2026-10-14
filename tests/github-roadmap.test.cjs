const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../js/github-roadmap.js'), 'utf8');

function harness({ fail = false, hidden = false, storageThrows = false, cached = null } = {}) {
    const nodes = new Map();
    function element() {
        const classes = new Set();
        return {
            value: '', textContent: '', children: [], dataset: {}, events: {},
            classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name) },
            addEventListener(name, fn) { this.events[name] = fn; },
            append(...items) { this.children.push(...items); }, appendChild(item) { this.children.push(item); },
            replaceChildren(...items) { this.children = items; }
        };
    }
    const get = id => { if (!nodes.has(id)) nodes.set(id, element()); return nodes.get(id); };
    get('lang-select').value = 'de';
    const counts = Array.from({ length: 6 }, (_, n) => Object.assign(element(), { dataset: { featureId: String(n + 1) } }));
    const buttons = counts.map(element);
    let now = 1800000000000;
    let broken = fail;
    const timers = new Map();
    let timerId = 0;
    const store = new Map();
    if (cached) store.set('gp_github_roadmap_v1:Gamingpig/About-Gamingpig', JSON.stringify(cached));
    const features = counts.map((_, n) => ({ number: n + 10, title: `[Roadmap #${n + 1}] Test`, reactions: { '+1': n + 2 } }));
    const wishes = [{ number: 100, title: '<img src=x onerror=alert(1)>', body: '<script>bad()</script>', user: { login: 'user' }, created_at: '2026-09-08T12:00:00Z', state: 'open', reactions: { '+1': 3 } }];
    const calls = [], opened = [], toasts = [];
    const window = { events: {}, addEventListener(name, fn) { this.events[name] = fn; }, open(...args) { opened.push(args); }, showToast(...args) { toasts.push(args); } };
    const document = { hidden, events: {}, getElementById: get, createElement: element,
        querySelector: () => get('form'), querySelectorAll: sel => sel === '.vote-btn' ? buttons : counts,
        addEventListener(name, fn) { this.events[name] = fn; } };
    class Clock extends Date { static now() { return now; } }
    const context = { window, document, navigator: { onLine: true }, URL, AbortController, Date: Clock,
        setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; }, clearTimeout: id => timers.delete(id),
        localStorage: { getItem(k) { if (storageThrows) throw Error('blocked'); return store.get(k) || null; }, setItem(k, v) { if (storageThrows) throw Error('blocked'); store.set(k, v); } },
        async fetch(url, options) {
            calls.push({ url, options });
            return { ok: !broken, status: broken ? 429 : 200,
                headers: { get: name => broken && name === 'retry-after' ? '600' : null },
                json: async () => url.includes('roadmap-feature') ? features : wishes };
        }
    };
    vm.runInNewContext(source, context);
    const flush = () => new Promise(resolve => setImmediate(resolve));
    return { window, document, counts, get, calls, opened, toasts, store, timers, features, wishes, flush,
        advance(ms) { now += ms; }, fail(value) { broken = value; } };
}

test('shared counts load without a token; votes open canonical GitHub issue without fabricating a vote', async () => {
    const h = harness(); h.window.GitHubRoadmap.init(); await h.flush();
    assert.equal(h.calls.length, 2);
    assert.equal(h.counts[0].textContent, '2');
    h.window.voteFeature(1);
    assert.equal(h.opened[0][0], 'https://github.com/Gamingpig/About-Gamingpig/issues/10');
    assert.equal(h.counts[0].textContent, '2');
    assert.equal(h.store.has('gp_roadmap_voted_1'), false);
    assert.equal(h.calls[0].options.headers.Authorization, undefined);
});

test('community content is rendered as text, not HTML; PRs are excluded', async () => {
    const h = harness();
    h.wishes.push({ ...h.wishes[0], pull_request: {} });
    h.window.GitHubRoadmap.init(); await h.flush();
    const list = h.get('user-wishes-list');
    assert.equal(list.children.length, 1);
    assert.equal(list.children[0].children[0].textContent, '<img src=x onerror=alert(1)>');
    assert.equal(list.children[0].children[2].textContent, '<script>bad()</script>');
    assert.equal(list.children[0].innerHTML, undefined);
});

test('wish submission encodes content, uses template and preserves fields without claiming success', async () => {
    const h = harness();
    h.get('wish-author').value = 'A & B'; h.get('wish-category').value = 'Easter Egg';
    h.get('wish-title').value = 'Übung & #1'; h.get('wish-desc').value = 'Hello\n?labels=other';
    let prevented = false;
    h.window.submitWish({ preventDefault() { prevented = true; } });
    const url = new URL(h.opened[0][0]);
    assert.equal(prevented, true);
    assert.equal(url.searchParams.get('template'), 'community-wish.md');
    assert.equal(url.searchParams.get('title'), '[Wunsch] Übung & #1');
    assert.match(url.searchParams.get('body'), /A & B/);
    assert.equal(url.searchParams.has('labels'), false);
    assert.equal(h.get('wish-title').value, 'Übung & #1');
    assert.match(h.toasts[0][0], /erst dann/);
    assert.equal(h.calls.length, 0);
});

test('return from GitHub refreshes shared data, duplicate focus events are throttled, hidden tabs stop', async () => {
    const h = harness(); h.window.GitHubRoadmap.init(); await h.flush();
    h.window.events.focus(); h.window.events.focus(); await h.flush();
    assert.equal(h.calls.length, 2);
    assert.ok([...h.timers.values()].some(t => t.ms <= 60000));
    h.advance(61000); h.features[0].reactions['+1'] = 9;
    h.window.events.focus(); await h.flush();
    assert.equal(h.calls.length, 4); assert.equal(h.counts[0].textContent, '9');
    h.document.hidden = true; h.document.events.visibilitychange();
    assert.equal(h.timers.size, 0);
    h.advance(600000); h.window.events.focus(); await h.flush();
    assert.equal(h.calls.length, 4);
});

test('failed read retains last confirmed state and respects GitHub retry limits', async () => {
    const h = harness(); h.window.GitHubRoadmap.init(); await h.flush();
    h.fail(true); h.advance(61000); h.window.events.focus(); await h.flush();
    assert.equal(h.counts[0].textContent, '2');
    assert.match(h.get('github-sync-status').textContent, /nicht erreichbar/);
    h.advance(61000); h.window.events.focus(); await h.flush();
    assert.equal(h.calls.length, 4);
    assert.ok([...h.timers.values()].some(t => t.ms >= 539000));
});

test('blocked localStorage does not prevent shared reads', async () => {
    const h = harness({ storageThrows: true }); h.window.GitHubRoadmap.init(); await h.flush();
    assert.equal(h.counts[0].textContent, '2');
    assert.match(h.get('github-sync-status').textContent, /abgeglichen/);
});

test('missing setup is visible and does not navigate to an invented issue', async () => {
    const h = harness(); h.features.length = 0; h.window.GitHubRoadmap.init(); await h.flush();
    h.window.voteFeature(1);
    assert.equal(h.opened.length, 0);
    assert.equal(h.counts[0].textContent, '–');
    assert.match(h.get('github-sync-status').textContent, /eingerichtet/);
});

test('setup is idempotent and preserves existing reactions and feature issues', async () => {
    const setup = require('../scripts/setup-roadmap.cjs');
    const labels = new Set(), issues = [];
    const github = { rest: { issues: {
        async getLabel({ name }) { if (!labels.has(name)) throw Object.assign(Error(), { status: 404 }); },
        async createLabel({ name }) { labels.add(name); },
        listForRepo() {}, async create(issue) { issues.push(issue); }
    } }, paginate: async () => issues };
    const context = { repo: { owner: 'Gamingpig', repo: 'About-Gamingpig' } };
    await setup({ github, context }); await setup({ github, context });
    assert.equal(issues.length, 6); assert.equal(labels.size, 2);
    assert.match(issues[0].body, /ersten Beitrag/);
});

test('all HTML inline scripts compile', () => {
    for (const name of ['index.html', 'roadmap.html', 'privacy.html']) {
        const html = fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
        for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
            if (/src=|application\/ld\+json/.test(match[1])) continue;
            new vm.Script(match[2], { filename: name });
        }
    }
});

test('privacy update notifies returning visitors once and stays out of onboarding', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    const version = html.match(/const PRIVACY_POLICY_VERSION = '[^']+';/)[0];
    const check = html.match(/function checkPrivacyPolicyUpdate\(\) \{[\s\S]*?\n        \}/)[0];
    let accepted = '2026-09-04';
    let shown = 0;
    let refreshed = 0;
    let onboarding = false;
    const context = {
        window: { OnboardingCoordinator: { isOnboarding: false } },
        document: {
            documentElement: { classList: { contains: () => onboarding } },
            getElementById: () => ({ classList: { remove() { shown++; }, add() {} } })
        },
        AppStorage: { getItem: () => accepted },
        updatePrivacyModalUI() { refreshed++; }
    };
    vm.createContext(context);
    vm.runInContext(version + '\n' + check, context);
    context.checkPrivacyPolicyUpdate();
    assert.equal(shown, 1); assert.equal(refreshed, 1);
    accepted = '2026-09-08-security-v3';
    context.checkPrivacyPolicyUpdate();
    assert.equal(shown, 1);
    accepted = null; onboarding = true;
    context.checkPrivacyPolicyUpdate();
    assert.equal(shown, 1);
});
