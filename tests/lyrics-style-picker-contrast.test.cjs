/**
 * Test Suite: Lyrics Style Dropdown Panel Opaque Background & High-Contrast Readability
 *
 * Requirements:
 * - P1: #lyrics-style-custom-panel has an explicit 100% opaque, solid background in both dark and light modes
 * - P2: z-index is set to 100 (or higher) to cleanly layer above all siblings (live preview, offset, dimming buttons)
 * - P3: Dropdown items (.lyrics-style-item-btn) and category headers (.lyrics-style-header) have dedicated high-contrast styles
 * - P4: updateLyricsStyleCustomUI populates proper classes and states
 * - P5: Closing lyrics settings menu automatically closes the dropdown panel
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const indexPath = path.join(__dirname, '../index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

function createDom() {
    return new JSDOM(indexHtml, {
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
            window.requestAnimationFrame = (cb) => setTimeout(cb, 16);
            window.cancelAnimationFrame = (id) => clearTimeout(id);
            window.IntersectionObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };
            window.ResizeObserver = class { constructor() {} observe() {} unobserve() {} disconnect() {} };
        }
    });
}

describe('Lyrics Style Picker Contrast & Opaque Dropdown Panel', () => {
    it('P1 & P2: #lyrics-style-custom-panel has solid opaque background and high z-index in CSS', () => {
        // Dark mode CSS
        assert.ok(
            indexHtml.includes('#lyrics-settings-menu #lyrics-style-custom-panel'),
            'CSS must target #lyrics-settings-menu #lyrics-style-custom-panel'
        );
        const darkPanelMatch = indexHtml.match(/#lyrics-settings-menu #lyrics-style-custom-panel\s*\{([\s\S]*?)\}/);
        assert.ok(darkPanelMatch, 'Dark mode CSS block for panel must exist');
        const darkCss = darkPanelMatch[1];
        assert.ok(darkCss.includes('background-color: #0b1120 !important'), 'Dark mode must use solid dark background #0b1120');
        assert.ok(darkCss.includes('opacity: 1 !important'), 'Dark mode must enforce opacity: 1');
        assert.ok(darkCss.includes('z-index: 100 !important'), 'Dark mode must enforce z-index: 100');
        assert.ok(darkCss.includes('border: 1px solid'), 'Dark mode must define high-contrast border');

        // Light mode CSS
        const lightPanelMatch = indexHtml.match(/html:not\(\.dark\) #lyrics-settings-menu #lyrics-style-custom-panel\s*\{([\s\S]*?)\}/);
        assert.ok(lightPanelMatch, 'Light mode CSS block for panel must exist');
        const lightCss = lightPanelMatch[1];
        assert.ok(lightCss.includes('background-color: #ffffff !important'), 'Light mode must use solid white background #ffffff');
        assert.ok(lightCss.includes('opacity: 1 !important'), 'Light mode must enforce opacity: 1');
    });

    it('P3: Dropdown items and headers have dedicated high-contrast rules', () => {
        // Headers
        assert.ok(
            indexHtml.includes('#lyrics-settings-menu #lyrics-style-custom-panel .lyrics-style-header'),
            'CSS must define styles for .lyrics-style-header'
        );
        assert.ok(
            indexHtml.includes('html:not(.dark) #lyrics-settings-menu #lyrics-style-custom-panel .lyrics-style-header'),
            'Light mode header styles must exist'
        );

        // Buttons
        assert.ok(
            indexHtml.includes('#lyrics-settings-menu #lyrics-style-custom-panel button.lyrics-style-item-btn'),
            'CSS must define styles for button.lyrics-style-item-btn'
        );
        assert.ok(
            indexHtml.includes('#lyrics-settings-menu #lyrics-style-custom-panel button.lyrics-style-item-btn.active'),
            'CSS must define styles for active button state'
        );
        assert.ok(
            indexHtml.includes('html:not(.dark) #lyrics-settings-menu #lyrics-style-custom-panel button.lyrics-style-item-btn'),
            'Light mode item button styles must exist'
        );
    });

    it('P4: HTML markup contains inline opaque fallback and proper classes', () => {
        const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
        try {
            const panel = dom.window.document.getElementById('lyrics-style-custom-panel');
            assert.ok(panel, '#lyrics-style-custom-panel must exist');
            const inlineStyle = panel.getAttribute('style') || '';
            assert.ok(inlineStyle.includes('background-color: #0b1120'), 'Inline style must have opaque #0b1120 fallback');
            assert.ok(inlineStyle.includes('opacity: 1'), 'Inline style must have opacity: 1');
            assert.ok(inlineStyle.includes('z-index: 100'), 'Inline style must have z-index: 100');
            assert.ok(!panel.className.includes('bg-slate-900/98'), 'Broken fractional class bg-slate-900/98 must not be used');
        } finally {
            dom.window.close();
        }
    });

    it('P5: updateLyricsStyleCustomUI renders header and button items with proper classes', () => {
        const dom = createDom();
        try {
            const { window } = dom;
            const panel = window.document.getElementById('lyrics-style-custom-panel');
            assert.ok(panel);

            window.updateLyricsStyleCustomUI('applemusicpro');

            const headers = panel.querySelectorAll('.lyrics-style-header');
            assert.ok(headers.length > 0, 'Must have rendered at least one .lyrics-style-header');

            const buttons = panel.querySelectorAll('button.lyrics-style-item-btn');
            assert.ok(buttons.length > 5, 'Must have rendered style buttons with .lyrics-style-item-btn');

            const activeBtn = panel.querySelector('button.lyrics-style-item-btn.active');
            assert.ok(activeBtn, 'Must have an active style button');
            assert.ok(activeBtn.textContent.includes('✓'), 'Active button must have checkmark');
        } finally {
            dom.window.close();
        }
    });

    it('P6: Closing lyrics settings menu automatically resets the dropdown panel', () => {
        const dom = createDom();
        try {
            const { window } = dom;
            const panel = window.document.getElementById('lyrics-style-custom-panel');
            assert.ok(panel);

            // Open panel
            panel.classList.remove('hidden');
            assert.equal(panel.classList.contains('hidden'), false);

            // Close lyrics settings menu
            window.isLyricsSettingsOpen = true;
            window.toggleLyricsSettings();

            assert.equal(panel.classList.contains('hidden'), true, 'Panel must be hidden when lyrics settings closes');
        } finally {
            dom.window.close();
        }
    });
});
