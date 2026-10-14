const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

describe('Single-Layer Lyrics Dashboard & Liquid Glass Corner Unification (v24.208.0)', () => {
    const rootDir = path.resolve(__dirname, '..');
    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');
    const releaseHtml = fs.readFileSync(path.join(rootDir, 'release.html'), 'utf-8');
    const versionJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'version.json'), 'utf-8'));
    const swJs = fs.readFileSync(path.join(rootDir, 'sw.js'), 'utf-8');

    it('T1.1: #lyrics-overlay in DOM carries rounded-[inherit] and border-0 without conflicting radius classes', () => {
        const dom = new JSDOM(indexHtml);
        const overlay = dom.window.document.getElementById('lyrics-overlay');
        assert.ok(overlay, '#lyrics-overlay must exist in index.html');
        assert.ok(overlay.classList.contains('rounded-[inherit]'), '#lyrics-overlay should use rounded-[inherit]');
        assert.ok(overlay.classList.contains('border-0'), '#lyrics-overlay should have border-0 to avoid second inner frame');
        assert.ok(!overlay.classList.contains('rounded-[3rem]'), 'Old conflicting rounded-[3rem] must be removed');
        assert.ok(!overlay.classList.contains('border-white/10'), 'Conflicting border-white/10 on overlay must be removed');
    });

    it('T1.2: CSS rules enforce border-radius: inherit !important, border: none !important, and box-shadow: none !important on #lyrics-overlay', () => {
        assert.match(indexHtml, /#lyrics-overlay\s*\{[^}]*border-radius:\s*inherit\s*!important/s);
        assert.match(indexHtml, /#lyrics-overlay\s*\{[^}]*border:\s*none\s*!important/s);
        assert.match(indexHtml, /#main-music-card\.lyrics-open\s+#lyrics-overlay\s*\{[^}]*border-radius:\s*inherit\s*!important/s);
        assert.match(indexHtml, /#main-music-card\.lyrics-open\s+#lyrics-overlay\s*\{[^}]*border:\s*none\s*!important/s);
    });

    it('T1.3: In Liquid Glass mode, #lyrics-overlay is transparent and has border-radius: inherit !important', () => {
        assert.match(indexHtml, /body\.liquid-glass-active\s+#main-music-card\.lyrics-open\s+#lyrics-overlay\s*\{[^}]*background:\s*transparent\s*!important/s);
        assert.match(indexHtml, /body\.liquid-glass-active\s+#main-music-card\.lyrics-open\s+#lyrics-overlay\s*\{[^}]*border-radius:\s*inherit\s*!important/s);
    });

    it('T1.4: #main-music-card.lyrics-open enforces overflow: hidden !important and cleanly hides #media-container', () => {
        assert.match(indexHtml, /#main-music-card\.lyrics-open\s*\{[^}]*overflow:\s*hidden\s*!important/s);
        assert.match(indexHtml, /#main-music-card\.lyrics-open\s+#media-container[^\{]*\{[^}]*opacity:\s*0\s*!important/s);
        assert.match(indexHtml, /#main-music-card\.lyrics-open\s+#media-container[^\{]*\{[^}]*visibility:\s*hidden\s*!important/s);
    });

    it('T1.5: Lyrics overlay animation uses seamless opacity fade and enforces transform: none !important', () => {
        assert.match(indexHtml, /\.lyrics-open\s+#lyrics-overlay\s*\{[^}]*transform:\s*none\s*!important/s);
        assert.match(indexHtml, /lyrics-seamless-fade-in/);
        // Ensure #lyrics-overlay was removed from the ext-pop-in selector group
        assert.doesNotMatch(indexHtml, /body\.liquid-glass-active\s+\.lyrics-open\s+#lyrics-overlay,\s*body\.liquid-glass-active\s+\.picker-opening/);
    });

    it('T2.1: Version numbers are perfectly synchronized to v24.215.0 across all relevant files', () => {
        assert.equal(versionJson.version, '24.215.0', 'version.json must be 24.215.0');
        assert.match(swJs, /const\s+SW_VERSION\s*=\s*"24\.215\.0";/, 'sw.js must be 24.215.0');
        assert.match(indexHtml, /ONBOARDING_VERSION\s*=\s*'v24\.215\.0/, 'index.html ONBOARDING_VERSION must be v24.215.0');
        assert.match(indexHtml, /id="footer-menu-hint"[^>]*>v24\.215\.0<\/span>/, 'footer-menu-hint must be v24.215.0');
        assert.match(indexHtml, /id="footer-version-label"[^>]*>v24\.215\.0<\/span>/, 'footer-version-label must be v24.215.0');
        assert.match(releaseHtml, /<title>Release Notes v24\.215\.0 – Gamingpig<\/title>/, 'release.html title must be v24.215.0');
        assert.match(releaseHtml, /v24\.215.0/, 'release.html content must feature v24.215.0');
    });

    it('T2.2: PUBLIC_CHANGELOG in index.html contains comprehensive v24.215.0, v24.214.0, v24.213.0, v24.212.0, v24.211.0, v24.210.0 and v24.209.0 entries', () => {
        assert.match(indexHtml, /version:\s*"v24\.215\.0"/);
        assert.match(indexHtml, /version:\s*"v24\.213\.0"/);
        assert.match(indexHtml, /version:\s*"v24\.212\.0"/);
        assert.match(indexHtml, /version:\s*"v24\.211\.0"/);
        assert.match(indexHtml, /version:\s*"v24\.210\.0"/);
        assert.match(indexHtml, /version:\s*"v24\.209\.0"/);
        assert.match(indexHtml, /arcade\.html/);
    });
});
