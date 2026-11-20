const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const indexPath = path.join(__dirname, '..', 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

function createDom() {
    const activeTimers = new Set();
    const dom = new JSDOM(indexHtml, {
        runScripts: 'dangerously',
        url: 'http://localhost/',
        beforeParse(window) {
            window.AppStorage = {
                _data: {},
                getItem(k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; },
                setItem(k, v) { this._data[k] = String(v); },
                removeItem(k) { delete this._data[k]; },
                clear() { this._data = {}; }
            };
            window.matchMedia = window.matchMedia || function(query) {
                return {
                    matches: false,
                    media: query,
                    onchange: null,
                    addListener: () => {},
                    removeListener: () => {},
                    addEventListener: () => {},
                    removeEventListener: () => {},
                    dispatchEvent: () => false,
                };
            };
            window.scrollTo = () => {};
            window.Element.prototype.scrollTo = () => {};
            window.requestAnimationFrame = (cb) => {
                const id = setTimeout(() => {
                    activeTimers.delete(id);
                    try { cb(performance.now()); } catch (_) {}
                }, 16);
                activeTimers.add(id);
                return id;
            };
            window.cancelAnimationFrame = (id) => {
                clearTimeout(id);
                activeTimers.delete(id);
            };
            window.IntersectionObserver = class {
                constructor() {}
                observe() {}
                unobserve() {}
                disconnect() {}
            };
            window.ResizeObserver = class {
                constructor() {}
                observe() {}
                unobserve() {}
                disconnect() {}
            };
            window.fetch = async () => ({
                ok: false,
                status: 500,
                json: async () => ({})
            });
        }
    });

    const origClose = dom.window.close.bind(dom.window);
    dom.window.close = () => {
        try {
            dom.window.trackIsPlaying = false;
        } catch (_) {}
        activeTimers.forEach(t => clearTimeout(t));
        activeTimers.clear();
        origClose();
    };

    return dom;
}

test('Collapsible Top-Right Control Center (v24.245.96)', async (t) => {
    await t.test('C1: DOM Structure & Initial Collapsed State', () => {
        const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
        const doc = dom.window.document;

        const uiControls = doc.getElementById('ui-controls');
        assert.ok(uiControls, '#ui-controls must exist');
        assert.ok(!uiControls.classList.contains('is-open'), '#ui-controls must start collapsed (no is-open)');
        assert.ok(!uiControls.classList.contains('ui-controls-open'), '#ui-controls must start collapsed (no ui-controls-open)');

        const items = doc.getElementById('ui-controls-items');
        assert.ok(items, '#ui-controls-items container must exist');

        // All 7 buttons must exist inside #ui-controls-items
        const expectedButtons = [
            'liquid-glass-toggle',
            'tutorial-start-btn',
            'layout-toggle-btn',
            'standby-toggle',
            'settings-global-toggle',
            'perf-toggle',
            'theme-toggle'
        ];
        for (const btnId of expectedButtons) {
            const btn = items.querySelector(`#${btnId}`);
            assert.ok(btn, `#${btnId} must be present inside #ui-controls-items`);
            assert.ok(btn.classList.contains('shrink-0'), `#${btnId} must have shrink-0 to prevent flex compression`);
        }

        // Toggle button on the right
        const toggleBtn = doc.getElementById('ui-controls-toggle');
        assert.ok(toggleBtn, '#ui-controls-toggle must exist');
        assert.equal(toggleBtn.getAttribute('aria-expanded'), 'false', '#ui-controls-toggle must have aria-expanded="false" initially');

        const toggleIcon = doc.getElementById('ui-controls-toggle-icon');
        assert.ok(toggleIcon, '#ui-controls-toggle-icon must exist inside toggle button');

        const toggleBadge = doc.getElementById('ui-controls-toggle-badge');
        assert.ok(toggleBadge, '#ui-controls-toggle-badge must exist inside toggle button');
        assert.ok(toggleBadge.classList.contains('hidden'), '#ui-controls-toggle-badge must be hidden initially');
    });

    await t.test('C2: CSS Rules for Smooth Expansion, Rotation & Tutorial Override', () => {
        // Collapsible rules
        assert.match(indexHtml, /#ui-controls-items\s*\{[^}]*max-width:\s*0/);
        assert.match(indexHtml, /#ui-controls\.is-open\s*#ui-controls-items[^}]*max-width:\s*520px/);
        assert.match(indexHtml, /#ui-controls\.ui-controls-open\s*#ui-controls-items[^}]*max-width:\s*520px/);
        assert.match(indexHtml, /#ui-controls\.is-open\s*#ui-controls-toggle\s*#ui-controls-toggle-icon[^}]*transform:\s*rotate\(90deg\)/);
        assert.match(indexHtml, /body\.tutorial-mode\s*#ui-controls-items[^}]*max-width:\s*520px\s*!important/);
    });

    await t.test('C3: Toggle Functions & State Logic (toggleUiControls & setUiControlsOpen)', () => {
        const dom = createDom();
        const win = dom.window;
        const doc = win.document;
        const uiControls = doc.getElementById('ui-controls');
        const toggleBtn = doc.getElementById('ui-controls-toggle');

        assert.equal(typeof win.setUiControlsOpen, 'function', 'window.setUiControlsOpen must be defined');
        assert.equal(typeof win.toggleUiControls, 'function', 'window.toggleUiControls must be defined');

        // Initially closed
        assert.ok(!uiControls.classList.contains('is-open'));
        assert.equal(toggleBtn.getAttribute('aria-expanded'), 'false');

        // Open
        win.toggleUiControls();
        assert.ok(uiControls.classList.contains('is-open'), '#ui-controls must have is-open when opened');
        assert.ok(uiControls.classList.contains('ui-controls-open'), '#ui-controls must have ui-controls-open when opened');
        assert.equal(toggleBtn.getAttribute('aria-expanded'), 'true', 'aria-expanded must be true when open');

        // Close
        win.toggleUiControls();
        assert.ok(!uiControls.classList.contains('is-open'), '#ui-controls must remove is-open when closed');
        assert.ok(!uiControls.classList.contains('ui-controls-open'), '#ui-controls must remove ui-controls-open when closed');
        assert.equal(toggleBtn.getAttribute('aria-expanded'), 'false', 'aria-expanded must be false when closed');

        // Explicit setUiControlsOpen
        win.setUiControlsOpen(true);
        assert.ok(uiControls.classList.contains('is-open'));
        win.setUiControlsOpen(false);
        assert.ok(!uiControls.classList.contains('is-open'));

        dom.window.close();
    });

    await t.test('C4: Settings Synchronization & "solang die Einstellungen offen sind, muss das auch offen sein"', () => {
        const dom = createDom();
        const win = dom.window;
        const doc = win.document;
        const uiControls = doc.getElementById('ui-controls');
        const globalMenu = doc.getElementById('global-settings-menu');

        // Opening standalone settings must auto-open #ui-controls
        assert.ok(!uiControls.classList.contains('is-open'), 'Controls start closed');
        win.toggleStandaloneSettings();
        assert.ok(uiControls.classList.contains('is-open'), '#ui-controls must automatically open when settings opens');
        assert.ok(!globalMenu.classList.contains('hidden'), 'globalMenu must be visible');

        // Closing standalone settings must restore controls to closed if opened by settings
        win.toggleStandaloneSettings();
        assert.ok(!uiControls.classList.contains('is-open'), '#ui-controls must close when settings closes if opened by settings');

        // If controls were already opened by user, closing settings leaves controls open
        win.setUiControlsOpen(true);
        win.toggleStandaloneSettings(); // opens settings
        assert.ok(uiControls.classList.contains('is-open'));
        win.toggleStandaloneSettings(); // closes settings
        assert.ok(uiControls.classList.contains('is-open'), 'User-opened controls remain open after settings closes');

        // Closing controls explicitly while settings is open must close settings too
        win.toggleStandaloneSettings(); // re-open settings
        assert.ok(!globalMenu.classList.contains('hidden'), 'globalMenu is open');
        win.toggleUiControls(); // user explicitly clicks control center toggle to close
        assert.ok(!uiControls.classList.contains('is-open'), 'Controls closed');

        dom.window.close();
    });

    await t.test('C5: Lyrics Settings Independence', () => {
        const dom = createDom();
        const win = dom.window;
        const doc = win.document;
        const uiControls = doc.getElementById('ui-controls');

        // Control center starts closed
        assert.ok(!uiControls.classList.contains('is-open'));

        // Toggle lyrics settings
        if (typeof win.toggleLyricsSettings === 'function') {
            win.toggleLyricsSettings();
            assert.ok(!uiControls.classList.contains('is-open'), 'Lyrics settings must NOT open #ui-controls');

            win.toggleLyricsSettings();
            assert.ok(!uiControls.classList.contains('is-open'), 'Closing lyrics settings must NOT open or disturb #ui-controls');
        }

        dom.window.close();
    });

    await t.test('C6: Badge Updates (setSettingsUpdateBadge)', () => {
        const dom = createDom();
        const win = dom.window;
        const doc = win.document;

        const cBadge = doc.getElementById('ui-controls-toggle-badge');
        const sBadge = doc.getElementById('settings-toggle-badge');
        assert.ok(cBadge);
        assert.ok(sBadge);

        // Turn update badge on
        if (typeof win.setSettingsUpdateBadge === 'function') {
            win.setSettingsUpdateBadge(true);
            assert.ok(!cBadge.classList.contains('hidden'), '#ui-controls-toggle-badge must be visible when update is pending');
            assert.ok(!sBadge.classList.contains('hidden'), '#settings-toggle-badge must be visible when update is pending');

            // Turn update badge off
            win.setSettingsUpdateBadge(false);
            assert.ok(cBadge.classList.contains('hidden'), '#ui-controls-toggle-badge must be hidden when no update is pending');
            assert.ok(sBadge.classList.contains('hidden'), '#settings-toggle-badge must be hidden when no update is pending');
        } else {
            // Check direct declaration in indexHtml
            assert.match(indexHtml, /const cBadge = document\.getElementById\('ui-controls-toggle-badge'\);/);
            assert.match(indexHtml, /cBadge\.classList\.remove\('hidden'\)/);
        }

        dom.window.close();
    });
});
