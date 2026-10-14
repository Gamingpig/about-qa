/**
 * Test Suite: Lyrics Dashboard Settings Menu Optimization (#lyrics-settings-menu)
 *
 * Requirements:
 * - R1: Uninterrupted lyrics animation while lyrics settings menu is open
 * - R2: Stabilized menu buttons (no jittery translateY, scale, or spring deformation)
 * - R3: Direct numeric offset input (Desktop Enter/change/blur, Mobile button, bidirectional sync, Re-Sync reset)
 * - R4: Removal of redundant UI animation select from lyrics menu, link to website settings preserved
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const indexPath = path.join(__dirname, '../index.html');
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

describe('Lyrics Settings Menu Optimization (#lyrics-settings-menu)', () => {

    describe('R1: Uninterrupted Lyrics Animation During Open Settings', () => {
        it('T1.1: isMenuBusy in animateLoop does NOT check isLyricsSettingsOpen or lyrics-settings transitions', () => {
            const animateLoopMatch = indexHtml.match(/function animateLoop\([\s\S]*?\{([\s\S]*?)(const isMenuBusy[\s\S]*?)(if\s*\(isMenuBusy\)\s*\{[\s\S]*?\})/);
            assert.ok(animateLoopMatch, 'animateLoop must contain isMenuBusy logic');
            const menuBusyBlock = animateLoopMatch[2];
            assert.ok(!menuBusyBlock.includes('isLyricsSettingsOpen'), 'isMenuBusy must NOT include isLyricsSettingsOpen');
            assert.ok(!menuBusyBlock.includes('#lyrics-settings-menu.settings-closing'), 'isMenuBusy must NOT check #lyrics-settings-menu closing');
            assert.ok(!menuBusyBlock.includes('#lyrics-settings-menu.settings-opening'), 'isMenuBusy must NOT check #lyrics-settings-menu opening');
        });

        it('T1.2: Focus on #lyrics-style-select does not cancel lyricAnimFrame or halt animation', () => {
            const selectFocusMatch = indexHtml.match(/lyricsStyleSelectEl\.addEventListener\('focus',\s*\(\)\s*=>\s*\{([\s\S]*?)\}\);/);
            assert.ok(selectFocusMatch, 'lyricsStyleSelectEl focus listener must exist');
            const focusBody = selectFocusMatch[1];
            assert.ok(!focusBody.includes('cancelAnimationFrame'), 'Focus on lyricsStyleSelectEl must not cancel animation frame');
            assert.ok(!focusBody.includes('isAnimating = false'), 'Focus on lyricsStyleSelectEl must not set isAnimating to false');
        });

        it('T1.3: Simulated animateLoop continues running and updating UI when lyrics settings are open', () => {
            const dom = createDom();
            try {
                const { window } = dom;

                // Set up mock playing state with lyrics open
                window.trackIsPlaying = true;
                window.totalMs = 180000;
                window.serverBaseProgress = 10000;
                window.localStartTime = window.performance.now();
                window.parsedLyrics = [
                    { timeMs: 5000, text: 'Line 1' },
                    { timeMs: 10000, text: 'Line 2' },
                    { timeMs: 15000, text: 'Line 3' }
                ];

                const mainCard = window.document.getElementById('main-music-card');
                if (mainCard) mainCard.classList.add('lyrics-open');

                // Open lyrics settings
                if (typeof window.toggleLyricsSettings === 'function') {
                    window.toggleLyricsSettings();
                }
                assert.equal(window.isLyricsSettingsOpen, true, 'isLyricsSettingsOpen should be true');

                // Verify animateLoop can be called and advances without being blocked by isMenuBusy
                let progressUpdated = false;
                window.updateProgressUI = () => { progressUpdated = true; };
                let lyricsSynced = false;
                window.syncLyricsUI = () => { lyricsSynced = true; };

                // Call animateLoop directly
                window.animateLoop(window.performance.now() + 100);
                assert.equal(lyricsSynced, true, 'syncLyricsUI must be called when animateLoop runs with open lyrics settings');
                window.trackIsPlaying = false;
            } finally {
                dom.window.close();
            }
        });

        it('T1.4: Real syncLyricsUI and progress updates advance lines while lyrics settings are open', async () => {
            const dom = createDom();
            try {
                const { window } = dom;

                window.trackIsPlaying = true;
                window.totalMs = 180000;
                window.localStartTime = window.performance.now();
                window.serverBaseProgress = 2500;
                window.parsedLyrics = [
                    { timeMs: 2000, text: 'First line' },
                    { timeMs: 6000, text: 'Second line' },
                    { timeMs: 12000, text: 'Third line' }
                ];
                window.liveSyncOffset = 0;

                const lyricsContent = window.document.getElementById('lyrics-content');
                if (lyricsContent) {
                    lyricsContent.innerHTML = window.parsedLyrics.map((l, i) => `<p id="lyric-line-${i}" class="lyric-line">${l.text}</p>`).join('');
                }

                const mainCard = window.document.getElementById('main-music-card');
                if (mainCard) mainCard.classList.add('lyrics-open');

                if (typeof window.toggleLyricsSettings === 'function') {
                    window.toggleLyricsSettings();
                }
                assert.equal(window.isLyricsSettingsOpen, true);

                // Call animateLoop at time ~2500ms
                window.animateLoop(window.performance.now());
                assert.equal(window.currentLyricIndex, 0, 'First line should be active at 2500ms');
                const line0 = window.document.getElementById('lyric-line-0');
                assert.equal(line0.classList.contains('active'), true, 'First line must have active class');

                // Advance track progress and let auto-running rAF loop process frame
                window.serverBaseProgress = 7000;
                await new Promise(r => setTimeout(r, 60));

                assert.equal(window.currentLyricIndex, 1, 'Second line should be active at 7000ms');
                const line1 = window.document.getElementById('lyric-line-1');
                assert.equal(line1.classList.contains('active'), true, 'Second line must have active class');
                assert.equal(line0.classList.contains('active'), false, 'First line must no longer have active class');

                window.trackIsPlaying = false;
            } finally {
                dom.window.close();
            }
        });
    });

    describe('R2: Menu Buttons Stabilization (No translateY, scale, or deformation)', () => {
        it('T2.1: CSS rules explicitly set transform: none !important for buttons in #lyrics-settings-menu', () => {
            assert.ok(indexHtml.includes('#lyrics-settings-menu :is(button, .lyrics-dim-btn, select, input)'), 'CSS must contain stabilization rule for lyrics-settings-menu controls');
            assert.ok(indexHtml.includes('#lyrics-settings-menu :is(button, .lyrics-dim-btn):hover'), 'CSS must define stabilized hover rule');
            assert.ok(indexHtml.includes('#lyrics-settings-menu :is(button, .lyrics-dim-btn):active'), 'CSS must define stabilized active rule');

            // Check that hover rule for #lyrics-settings-menu does not have translateY
            const hoverSection = indexHtml.match(/#lyrics-settings-menu :is\(\s*button,\s*\.lyrics-dim-btn\s*\):hover\s*\{[\s\S]*?\}/);
            assert.ok(hoverSection);
            assert.ok(hoverSection[0].includes('transform: none !important;'), 'Hover state must enforce transform: none !important');
            assert.ok(!hoverSection[0].includes('translateY'), 'Hover state must NOT contain translateY');

            // Check active state
            const activeSection = indexHtml.match(/#lyrics-settings-menu :is\(button,\s*\.lyrics-dim-btn\):active\s*\{[\s\S]*?\}/);
            assert.ok(activeSection);
            assert.ok(activeSection[0].includes('transform: none !important;'), 'Active state must enforce transform: none !important');
            assert.ok(!activeSection[0].includes('scale('), 'Active state must NOT contain scale()');
        });

        it('T2.2: Buttons inside #lyrics-settings-menu do NOT carry active:scale-95 classes', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            try {
                const menu = dom.window.document.getElementById('lyrics-settings-menu');
                assert.ok(menu);

                const buttons = menu.querySelectorAll('button, .lyrics-dim-btn');
                assert.ok(buttons.length > 5, 'Should find buttons inside lyrics settings menu');

                buttons.forEach(btn => {
                    const cls = btn.className;
                    assert.ok(!cls.includes('active:scale-95'), `Button ${btn.id || btn.textContent.trim()} must not have active:scale-95 in className: "${cls}"`);
                });
            } finally {
                dom.window.close();
            }
        });

        it('T2.3: Re-Sync button does not have translateY on hover or scale on active', () => {
            const resyncMatch = indexHtml.match(/#lyrics-settings-menu #btn-resync\s*\{[\s\S]*?transform:\s*none\s*!important;[\s\S]*?\}/);
            assert.ok(resyncMatch, 'Explicit stabilization for #btn-resync must exist');
        });

        it('T2.4: setLyricsDimMode toggles active mode without injecting active:scale-95 into button className', () => {
            const dom = createDom();
            try {
                const { window } = dom;
                const softBtn = window.document.querySelector('.lyrics-dim-btn[data-dim="soft"]');
                const deepBtn = window.document.querySelector('.lyrics-dim-btn[data-dim="deep"]');
                assert.ok(softBtn && deepBtn);

                window.setLyricsDimMode('deep');
                assert.equal(deepBtn.classList.contains('active'), true);
                assert.equal(deepBtn.className.includes('active:scale-95'), false);
                assert.equal(softBtn.className.includes('active:scale-95'), false);

                window.setLyricsDimMode('soft');
                assert.equal(softBtn.classList.contains('active'), true);
                assert.equal(softBtn.className.includes('active:scale-95'), false);
            } finally {
                dom.window.close();
            }
        });
    });

    describe('R3: Direct Numeric Offset Input (Desktop & Mobile)', () => {
        it('T3.1: #sync-number-input exists with type="number" inside #lyrics-settings-menu', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            try {
                const input = dom.window.document.querySelector('#lyrics-settings-menu input#sync-number-input');
                assert.ok(input, '#sync-number-input must exist in #lyrics-settings-menu');
                assert.equal(input.type, 'number');
                assert.equal(input.getAttribute('min'), '-5000');
                assert.equal(input.getAttribute('max'), '5000');
            } finally {
                dom.window.close();
            }
        });

        it('T3.2: Confirm button #btn-sync-apply exists beside numeric input', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            try {
                const btn = dom.window.document.querySelector('#lyrics-settings-menu #btn-sync-apply');
                assert.ok(btn, '#btn-sync-apply must exist in #lyrics-settings-menu');
            } finally {
                dom.window.close();
            }
        });

        it('T3.3: Enter key on #sync-number-input applies offset, syncs slider, display, and storage', () => {
            const dom = createDom();
            try {
                const { window } = dom;

                const numInput = window.document.getElementById('sync-number-input');
                const slider = window.document.getElementById('sync-slider');
                const valueEl = window.document.getElementById('sync-value');

                assert.ok(numInput && slider && valueEl);

                numInput.value = '250';
                const enterEvent = new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
                numInput.dispatchEvent(enterEvent);

                assert.equal(window.liveSyncOffset, 250, 'liveSyncOffset should be 250');
                assert.equal(slider.value, '250', 'syncSlider.value should be 250');
                assert.equal(valueEl.innerText, '250', 'syncValueEl.innerText should be 250');
                assert.equal(window.AppStorage.getItem('userSyncOffset'), '250', 'userSyncOffset in AppStorage should be 250');
            } finally {
                dom.window.close();
            }
        });

        it('T3.4: Clicking #btn-sync-apply applies offset and updates all components', () => {
            const dom = createDom();
            try {
                const { window } = dom;

                const numInput = window.document.getElementById('sync-number-input');
                const slider = window.document.getElementById('sync-slider');
                const valueEl = window.document.getElementById('sync-value');
                const applyBtn = window.document.getElementById('btn-sync-apply');

                assert.ok(numInput && slider && valueEl && applyBtn);

                numInput.value = '-1200';
                applyBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

                assert.equal(window.liveSyncOffset, -1200);
                assert.equal(slider.value, '-1200');
                assert.equal(valueEl.innerText, '-1200');
                assert.equal(window.AppStorage.getItem('userSyncOffset'), '-1200');
            } finally {
                dom.window.close();
            }
        });

        it('T3.5: Slider input event synchronizes #sync-number-input and #sync-value in real time', () => {
            const dom = createDom();
            try {
                const { window } = dom;

                const slider = window.document.getElementById('sync-slider');
                const numInput = window.document.getElementById('sync-number-input');
                const valueEl = window.document.getElementById('sync-value');

                slider.value = '600';
                slider.dispatchEvent(new window.Event('input', { bubbles: true }));

                assert.equal(numInput.value, '600', 'Slider input event must update sync-number-input');
                assert.equal(valueEl.innerText, '600', 'Slider input event must update sync-value');

                // Slider change event commits it
                slider.dispatchEvent(new window.Event('change', { bubbles: true }));
                assert.equal(window.liveSyncOffset, 600);
                assert.equal(window.AppStorage.getItem('userSyncOffset'), '600');
            } finally {
                dom.window.close();
            }
        });

        it('T3.6: Re-Sync button resets #sync-number-input, #sync-slider, and #sync-value to default (-400)', async () => {
            const dom = createDom();
            try {
                const { window } = dom;

                // First set non-default offset
                window.applySyncOffset(800, true);
                assert.equal(window.liveSyncOffset, 800);

                // Trigger resetSyncOffset
                const resyncBtn = window.document.getElementById('btn-resync');
                assert.ok(resyncBtn);
                await window.resetSyncOffset(resyncBtn);

                const numInput = window.document.getElementById('sync-number-input');
                const slider = window.document.getElementById('sync-slider');
                const valueEl = window.document.getElementById('sync-value');

                assert.equal(window.liveSyncOffset, -400, 'Default offset should be -400');
                assert.equal(numInput.value, '-400', 'Number input should be reset to -400');
                assert.equal(slider.value, '-400', 'Slider should be reset to -400');
                assert.equal(valueEl.innerText, '-400', 'Display should be reset to -400');
                assert.equal(window.AppStorage.getItem('userSyncOffset'), null, 'userSyncOffset should be removed from storage');
            } finally {
                dom.window.close();
            }
        });

        it('T3.7: Boundary clamping enforces [-5000, 5000] range', () => {
            const dom = createDom();
            try {
                const { window } = dom;

                const numInput = window.document.getElementById('sync-number-input');
                const applyBtn = window.document.getElementById('btn-sync-apply');

                // Test high overflow
                numInput.value = '9999';
                applyBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
                assert.equal(window.liveSyncOffset, 5000);
                assert.equal(numInput.value, '5000');

                // Test low underflow
                numInput.value = '-8888';
                applyBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
                assert.equal(window.liveSyncOffset, -5000);
                assert.equal(numInput.value, '-5000');
            } finally {
                dom.window.close();
            }
        });

        it('T3.8: Non-numeric / empty / NaN input preserves existing offset and heals input value', () => {
            const dom = createDom();
            try {
                const { window } = dom;

                const numInput = window.document.getElementById('sync-number-input');
                const applyBtn = window.document.getElementById('btn-sync-apply');

                // Set a valid custom offset
                window.applySyncOffset(350, true);
                assert.equal(window.liveSyncOffset, 350);

                // User clears field or inputs invalid characters
                numInput.value = '';
                applyBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
                assert.equal(window.liveSyncOffset, 350, 'Clearing field should keep existing offset');
                assert.equal(numInput.value, '350', 'Input field should be healed to current offset');

                // Non-numeric string via applySyncOffset
                window.applySyncOffset('invalid_string', true);
                assert.equal(window.liveSyncOffset, 350);
                assert.equal(numInput.value, '350');
            } finally {
                dom.window.close();
            }
        });

        it('T3.9: Floating point inputs are cleanly rounded to integers', () => {
            const dom = createDom();
            try {
                const { window } = dom;

                window.applySyncOffset('125.7', true);
                assert.equal(window.liveSyncOffset, 126);

                const numInput = window.document.getElementById('sync-number-input');
                assert.equal(numInput.value, '126');
            } finally {
                dom.window.close();
            }
        });

        it('T3.10: Rapid consecutive clicks on #btn-sync-apply remain idempotent and stable', () => {
            const dom = createDom();
            try {
                const { window } = dom;

                const numInput = window.document.getElementById('sync-number-input');
                const applyBtn = window.document.getElementById('btn-sync-apply');
                numInput.value = '-650';

                for (let i = 0; i < 5; i++) {
                    applyBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
                }

                assert.equal(window.liveSyncOffset, -650);
                assert.equal(numInput.value, '-650');
                assert.equal(window.AppStorage.getItem('userSyncOffset'), '-650');
            } finally {
                dom.window.close();
            }
        });

        it('T3.11: Boot-time out-of-bounds AppStorage offset is clamped to [-5000, 5000] range', () => {
            const dom = new JSDOM(fs.readFileSync(indexPath, 'utf8'), {
                runScripts: 'dangerously',
                url: 'http://localhost/',
                beforeParse(window) {
                    window.AppStorage = {
                        _data: { userSyncOffset: '99999' },
                        getItem(k) { return Object.prototype.hasOwnProperty.call(this._data, k) ? this._data[k] : null; },
                        setItem(k, v) { this._data[k] = String(v); },
                        removeItem(k) { delete this._data[k]; },
                        clear() { this._data = {}; }
                    };
                    window.matchMedia = () => ({ matches: false, addListener: () => {}, removeListener: () => {} });
                    window.scrollTo = () => {};
                    window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
                    window.cancelAnimationFrame = (id) => clearTimeout(id);
                    window.IntersectionObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };
                    window.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };
                    window.fetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
                }
            });
            try {
                assert.equal(dom.window.liveSyncOffset, 5000, 'Boot-time liveSyncOffset must be clamped to 5000 max');
            } finally {
                dom.window.close();
            }
        });

        it('T3.12: Clicking #btn-sync-apply blurs #sync-number-input to dismiss mobile soft keyboard', () => {
            const dom = createDom();
            try {
                const { window } = dom;
                const numInput = window.document.getElementById('sync-number-input');
                const applyBtn = window.document.getElementById('btn-sync-apply');

                let blurred = false;
                numInput.blur = () => { blurred = true; };
                numInput.value = '300';

                applyBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
                assert.equal(blurred, true, 'Confirm button click must call blur() on numeric input');
                assert.equal(window.liveSyncOffset, 300);
            } finally {
                dom.window.close();
            }
        });

        it('T3.13: change event on #sync-number-input persists and synchronizes slider and display', () => {
            const dom = createDom();
            try {
                const { window } = dom;
                const numInput = window.document.getElementById('sync-number-input');
                const slider = window.document.getElementById('sync-slider');
                const valueEl = window.document.getElementById('sync-value');

                numInput.value = '750';
                numInput.dispatchEvent(new window.Event('change', { bubbles: true }));

                assert.equal(window.liveSyncOffset, 750);
                assert.equal(slider.value, '750');
                assert.equal(valueEl.innerText, '750');
                assert.equal(window.AppStorage.getItem('userSyncOffset'), '750');
            } finally {
                dom.window.close();
            }
        });

        it('T3.14: blur event on #sync-number-input persists and synchronizes slider and display', () => {
            const dom = createDom();
            try {
                const { window } = dom;
                const numInput = window.document.getElementById('sync-number-input');
                const slider = window.document.getElementById('sync-slider');
                const valueEl = window.document.getElementById('sync-value');

                numInput.value = '-950';
                numInput.dispatchEvent(new window.Event('blur', { bubbles: true }));

                assert.equal(window.liveSyncOffset, -950);
                assert.equal(slider.value, '-950');
                assert.equal(valueEl.innerText, '-950');
                assert.equal(window.AppStorage.getItem('userSyncOffset'), '-950');
            } finally {
                dom.window.close();
            }
        });

        it('T3.15: Out-of-bounds input via blur or change is clamped to [-5000, 5000]', () => {
            const dom = createDom();
            try {
                const { window } = dom;
                const numInput = window.document.getElementById('sync-number-input');
                const slider = window.document.getElementById('sync-slider');

                numInput.value = '12000';
                numInput.dispatchEvent(new window.Event('change', { bubbles: true }));
                assert.equal(window.liveSyncOffset, 5000);
                assert.equal(numInput.value, '5000');
                assert.equal(slider.value, '5000');

                numInput.value = '-9999';
                numInput.dispatchEvent(new window.Event('blur', { bubbles: true }));
                assert.equal(window.liveSyncOffset, -5000);
                assert.equal(numInput.value, '-5000');
                assert.equal(slider.value, '-5000');
            } finally {
                dom.window.close();
            }
        });

        it('T3.16: Input value of 0 is properly handled and stored', () => {
            const dom = createDom();
            try {
                const { window } = dom;
                const numInput = window.document.getElementById('sync-number-input');
                const slider = window.document.getElementById('sync-slider');
                const valueEl = window.document.getElementById('sync-value');

                numInput.value = '0';
                numInput.dispatchEvent(new window.Event('change', { bubbles: true }));
                assert.equal(window.liveSyncOffset, 0);
                assert.equal(slider.value, '0');
                assert.equal(valueEl.innerText, '0');
                assert.equal(window.AppStorage.getItem('userSyncOffset'), '0');
            } finally {
                dom.window.close();
            }
        });
    });

    describe('R4: Redundant Global Animation Styles Cleaned Up', () => {
        it('T4.1: #lyrics-anim-style-select dropdown is completely removed from #lyrics-settings-menu', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            try {
                const select = dom.window.document.getElementById('lyrics-anim-style-select');
                assert.equal(select, null, '#lyrics-anim-style-select must be removed from the DOM');
            } finally {
                dom.window.close();
            }
        });

        it('T4.2: Link to global website settings remains present and functional', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            try {
                const menu = dom.window.document.getElementById('lyrics-settings-menu');
                const shortcutBtn = menu.querySelector('button[onclick*="openGlobalSettingsFromLyrics"]');
                assert.ok(shortcutBtn, 'Shortcut button to website settings must remain in lyrics menu');
            } finally {
                dom.window.close();
            }
        });
    });
});
