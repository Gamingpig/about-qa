const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const ROOT = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const versionJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
const swJs = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const releaseHtml = fs.readFileSync(path.join(ROOT, 'release.html'), 'utf8');

test(`Liquid Glass Card Transparency Unification (v${versionJson.version})`, async (t) => {
    await t.test(`LG1: Version ${versionJson.version} is synchronized across core files`, () => {
        const versionPattern = versionJson.version.replace(/\./g, '\\.');
        assert.match(swJs, new RegExp(`const SW_VERSION = "${versionPattern}";`));
        assert.match(indexHtml, new RegExp(`ONBOARDING_VERSION = 'v${versionPattern}`));
        assert.match(indexHtml, new RegExp(`id="footer-menu-hint"[^>]*>v${versionPattern}[^<]*<\\/span>`));
        assert.match(indexHtml, new RegExp(`id="footer-version-label"[^>]*>v${versionPattern}[^<]*<\\/span>`));
        assert.match(indexHtml, new RegExp(`version:\\s*"v${versionPattern}"`));
        assert.match(releaseHtml, /<title>Release Notes v\d+\.\d+\.\d+ – Gamingpig<\/title>/);
    });

    await t.test('LG2: Desktop Dark Mode — all cards have identical background in Liquid Glass', () => {
        const dom = new JSDOM(indexHtml);
        const doc = dom.window.document;
        doc.documentElement.classList.add('dark');
        doc.body.classList.add('liquid-glass-active');

        const header = dom.window.getComputedStyle(doc.getElementById('header-section')).background;
        const mainMusic = dom.window.getComputedStyle(doc.getElementById('main-music-card')).background;
        const miniPlayer = dom.window.getComputedStyle(doc.getElementById('mini-player-toggle')).background;
        const kartMini = dom.window.getComputedStyle(doc.getElementById('kart-mini-toggle')).background;
        const footerBubble = dom.window.getComputedStyle(doc.getElementById('footer-bubble')).background;
        const footerMenu = dom.window.getComputedStyle(doc.getElementById('footer-expandable-menu')).background;
        const backToTop = dom.window.getComputedStyle(doc.getElementById('back-to-top')).background;
        const socialsCard = dom.window.getComputedStyle(doc.querySelector('#socials-section .glass-card')).background;

        assert.ok(header, 'Header must have background');
        assert.equal(mainMusic, header, '#main-music-card must match header');
        assert.equal(miniPlayer, header, '#mini-player-toggle must match header');
        assert.equal(kartMini, header, '#kart-mini-toggle must match header');
        assert.equal(footerBubble, header, '#footer-bubble must match header');
        assert.equal(footerMenu, header, '#footer-expandable-menu must match header');
        assert.equal(backToTop, header, '#back-to-top must match header');
        assert.equal(socialsCard, header, 'Socials card must match header');

        // Confirm #main-music-card is NOT locked to rgba(15, 23, 42, 0.4)
        assert.doesNotMatch(mainMusic, /rgba\(15,\s*23,\s*42,\s*0\.4\)\s*$/);
    });

    await t.test('LG3: Desktop Light Mode — all cards have identical background in Liquid Glass', () => {
        const dom = new JSDOM(indexHtml);
        const doc = dom.window.document;
        doc.documentElement.classList.remove('dark');
        doc.body.classList.add('liquid-glass-active');

        const header = dom.window.getComputedStyle(doc.getElementById('header-section')).background;
        const mainMusic = dom.window.getComputedStyle(doc.getElementById('main-music-card')).background;
        const miniPlayer = dom.window.getComputedStyle(doc.getElementById('mini-player-toggle')).background;
        const kartMini = dom.window.getComputedStyle(doc.getElementById('kart-mini-toggle')).background;
        const footerBubble = dom.window.getComputedStyle(doc.getElementById('footer-bubble')).background;
        const footerMenu = dom.window.getComputedStyle(doc.getElementById('footer-expandable-menu')).background;
        const backToTop = dom.window.getComputedStyle(doc.getElementById('back-to-top')).background;
        const socialsCard = dom.window.getComputedStyle(doc.querySelector('#socials-section .glass-card')).background;

        assert.ok(header, 'Header must have background');
        assert.equal(mainMusic, header, '#main-music-card must match header');
        assert.equal(miniPlayer, header, '#mini-player-toggle must match header');
        assert.equal(kartMini, header, '#kart-mini-toggle must match header');
        assert.equal(footerBubble, header, '#footer-bubble must match header');
        assert.equal(footerMenu, header, '#footer-expandable-menu must match header');
        assert.equal(backToTop, header, '#back-to-top must match header');
        assert.equal(socialsCard, header, 'Socials card must match header');
    });

    await t.test('LG4: Mobile Mode — all cards have identical background in Liquid Glass', () => {
        const dom = new JSDOM(indexHtml);
        const doc = dom.window.document;
        doc.documentElement.classList.add('gp-mobile');
        doc.documentElement.classList.add('dark');
        doc.body.classList.add('liquid-glass-active');

        const header = dom.window.getComputedStyle(doc.getElementById('header-section')).background;
        const mainMusic = dom.window.getComputedStyle(doc.getElementById('main-music-card')).background;
        const footerBubble = dom.window.getComputedStyle(doc.getElementById('footer-bubble')).background;
        const backToTop = dom.window.getComputedStyle(doc.getElementById('back-to-top')).background;

        assert.ok(header, 'Mobile header must have background');
        assert.equal(mainMusic, header, 'Mobile #main-music-card must match header');
        assert.equal(footerBubble, header, 'Mobile #footer-bubble must match header');
        assert.equal(backToTop, header, 'Mobile #back-to-top must match header');
    });

    await t.test('LG5: Standard mode without liquid-glass-active retains separate styling', () => {
        const dom = new JSDOM(indexHtml);
        const doc = dom.window.document;
        doc.documentElement.classList.add('dark');

        const mainMusic = dom.window.getComputedStyle(doc.getElementById('main-music-card')).background;
        assert.match(mainMusic, /rgba\(15,\s*23,\s*42,\s*0\.4\)/, 'Main music card retains standard background in normal mode');
    });

    await t.test('LG6: Desktop Hover in Liquid Glass mode retains solid opacity and avoids jarring transparency drops', () => {
        // Assert no hover rule drops the glass card to 0.28 or 0.01 opacity in Liquid Glass
        assert.doesNotMatch(indexHtml, /\.dark\s+body\.liquid-glass-active\s+\.glass-card[^{]*\{[^}]*rgba\(15,\s*23,\s*42,\s*0\.28\)/);
        assert.match(indexHtml, /\.dark\s+body\.liquid-glass-active\s+\.glass-card:not\(#main-music-card\):not\(#mini-player-toggle\):not\(#back-to-top\):hover/);
    });
});
