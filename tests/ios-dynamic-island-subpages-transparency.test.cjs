const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.resolve(__dirname, '../index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf-8');

const privacyPath = path.resolve(__dirname, '../privacy.html');
const privacyHtml = fs.readFileSync(privacyPath, 'utf-8');

const impressumPath = path.resolve(__dirname, '../impressum.html');
const impressumHtml = fs.readFileSync(impressumPath, 'utf-8');

const releasePath = path.resolve(__dirname, '../release.html');
const releaseHtml = fs.readFileSync(releasePath, 'utf-8');

const statusPath = path.resolve(__dirname, '../status.html');
const statusHtml = fs.readFileSync(statusPath, 'utf-8');

const roadmapPath = path.resolve(__dirname, '../roadmap.html');
const roadmapHtml = fs.readFileSync(roadmapPath, 'utf-8');

const arcadePath = path.resolve(__dirname, '../arcade.html');
const arcadeHtml = fs.readFileSync(arcadePath, 'utf-8');

const communityGlassPath = path.resolve(__dirname, '../assets/community-glass.20260910.css');
const communityGlassCss = fs.readFileSync(communityGlassPath, 'utf-8');

const versionJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../version.json'), 'utf-8'));
const swJs = fs.readFileSync(path.resolve(__dirname, '../sw.js'), 'utf-8');

test('Issue 1: iOS Dynamic Island Open & Tap Reliability', async (t) => {
    await t.test('I1: #dynamic-island has explicit onclick and tap interaction handler', () => {
        assert.match(indexHtml, /id="dynamic-island"[^>]*onclick="handleIslandTap\(event\)"/);
        assert.match(indexHtml, /function handleIslandTap\(e\)/);
    });

    await t.test('I2: window scroll listener guards against micro-scroll and rubber-band collapsing', () => {
        assert.match(indexHtml, /if\s*\(Date\.now\(\)\s*-\s*lastIslandInteractionTime\s*<\s*800\)\s*return;/);
        assert.match(indexHtml, /if\s*\(scrollDelta\s*<\s*25\)\s*return;/);
    });

    await t.test('I3: initIslandGestures sets touch-action manipulation and debounces double-tap', () => {
        assert.match(indexHtml, /island\.style\.touchAction\s*=\s*'manipulation'/);
        assert.match(indexHtml, /const now = Date\.now\(\);/);
        assert.match(indexHtml, /if \(now - lastIslandTapTime < 350\) return;/);
    });
});

test('Issue 2: Subpage Top Bar & Back Button Tappability on iOS', async (t) => {
    await t.test('B1: privacy.html has safe-area-inset-top padding and relative z-index on header & back button', () => {
        assert.match(privacyHtml, /padding:\s*max\(20px,\s*env\(safe-area-inset-top,\s*20px\)\)/);
        assert.match(privacyHtml, /\.back-btn\s*\{[^}]*position:\s*relative;\s*z-index:\s*70;\s*cursor:\s*pointer;\s*touch-action:\s*manipulation;/s);
        assert.match(privacyHtml, /\.card\s*\{[^}]*position:\s*relative;/s);
    });

    await t.test('B2: impressum.html has safe-area-inset-top padding and relative z-index on header & back button', () => {
        assert.match(impressumHtml, /padding:\s*max\(20px,\s*env\(safe-area-inset-top,\s*20px\)\)/);
        assert.match(impressumHtml, /\.back-btn\s*\{[^}]*position:\s*relative;\s*z-index:\s*70;\s*cursor:\s*pointer;\s*touch-action:\s*manipulation;/s);
        assert.match(impressumHtml, /\.card\s*\{[^}]*position:\s*relative;/s);
    });

    await t.test('B3: release.html header includes safe-area-inset-top and back button has touch-manipulation', () => {
        assert.match(releaseHtml, /header[^>]*padding-top:\s*max\(0px,\s*env\(safe-area-inset-top,\s*0px\)\)/);
        assert.match(releaseHtml, /<a href="index\.html"[^>]*touch-manipulation/);
    });

    await t.test('B4: status.html body includes safe-area-inset-top and back button has touch-manipulation', () => {
        assert.match(statusHtml, /body[^>]*style="padding-top:\s*max\(16px,\s*env\(safe-area-inset-top,\s*16px\)\);"/);
        assert.match(statusHtml, /<a href="index\.html"[^>]*touch-manipulation/);
    });

    await t.test('B5: roadmap.html body includes safe-area-inset-top and back button has touch-manipulation', () => {
        assert.match(roadmapHtml, /body[^>]*style="padding-top:\s*max\(16px,\s*env\(safe-area-inset-top,\s*16px\)\);"/);
        assert.match(roadmapHtml, /<a href="index\.html"[^>]*touch-manipulation/);
    });

    await t.test('B6: arcade.html body includes safe-area-inset-top and return button has touch-manipulation', () => {
        assert.match(arcadeHtml, /body[^>]*style="padding-top:\s*max\(12px,\s*env\(safe-area-inset-top,\s*12px\)\);"/);
        assert.match(arcadeHtml, /\.glass-stage\s*\{[^}]*position:\s*relative;/s);
        assert.match(arcadeHtml, /<a id="btn-return"[^>]*touch-manipulation/);
    });

    await t.test('B7: community-glass CSS safeguards all subpage back buttons and cards', () => {
        assert.match(communityGlassCss, /\.back-btn,\s*#btn-return,\s*a\[href="index\.html"\]\s*\{[^}]*touch-action:\s*manipulation/s);
        assert.match(communityGlassCss, /--gp-surface:\s*rgb\(18\s*28\s*51\s*\/\s*\.82\)/);
        assert.match(communityGlassCss, /--gp-surface:\s*rgb\(255\s*255\s*255\s*\/\s*\.85\)/);
    });
});

test('Issue 3: Harmonized Liquid Glass Card Transparency', async (t) => {
    await t.test('C1: Mobile header-section matches general card opacity (0.82 / 0.90 dark)', () => {
        assert.match(indexHtml, /:is\(html\.gp-android,\s*html\.gp-mobile\)\s*#header-section\s*\{[^}]*rgba\(30,\s*41,\s*59,\s*0\.82\)[^}]*rgba\(15,\s*23,\s*42,\s*0\.90\)/s);
        assert.doesNotMatch(indexHtml, /:is\(html\.gp-android,\s*html\.gp-mobile\)\s*#header-section\s*\{[^}]*rgba\(30,\s*41,\s*59,\s*0\.58\)/s);
    });

    await t.test('C2: Mobile glass-card light mode uses unified opacity', () => {
        assert.match(indexHtml, /body\.liquid-glass-active :is\([^)]*\.glass-card[^)]*#header-section[^)]*#footer-bubble[^)]*#footer-expandable-menu[^)]*\)\s*\{[^}]*rgba\(255,\s*255,\s*255,\s*0\.84\)/s);
    });

    await t.test('C3: audience-hub glass-card does not have conflicting rainbow background gradients', () => {
        assert.doesNotMatch(indexHtml, /id="audience-hub"[^>]*>[\s\S]*?<div class="glass-card[^"]*bg-gradient-to-r/);
    });

    await t.test('C4: Version 24.215.0 is synchronized across version.json, sw.js, index.html, release.html', () => {
        assert.equal(versionJson.version, '24.215.0');
        assert.match(swJs, /const SW_VERSION = "24\.215\.0";/);
        assert.match(indexHtml, /ONBOARDING_VERSION = 'v24\.215\.0/);
        assert.match(indexHtml, /id="footer-menu-hint"[^>]*>v24\.215\.0<\/span>/);
        assert.match(indexHtml, /id="footer-version-label"[^>]*>v24\.215\.0<\/span>/);
        assert.match(releaseHtml, /<title>Release Notes v24\.215\.0 – Gamingpig<\/title>/);
    });
});
