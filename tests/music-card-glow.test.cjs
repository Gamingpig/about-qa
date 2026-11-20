const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const indexPath = path.join(__dirname, '..', 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

test('Enhanced Static Image Ambilight Glow (#ambilight-glow)', async (t) => {
    await t.test('G1: Element Structure & Hardware Layer Attributes', () => {
        const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
        const doc = dom.window.document;

        const mainCard = doc.getElementById('main-music-card');
        assert.ok(mainCard, '#main-music-card must exist');

        const glow = doc.getElementById('ambilight-glow');
        assert.ok(glow, '#ambilight-glow must exist inside DOM');
        assert.equal(glow.parentElement, mainCard, '#ambilight-glow must be a child of #main-music-card');
    });

    await t.test('G2: Responsive Spread & Blur Filter Hierarchy', () => {
        // Base mobile filter & spread
        assert.match(indexHtml, /#ambilight-glow\s*\{[^}]*inset:\s*-42px/);
        assert.match(indexHtml, /#ambilight-glow\s*\{[^}]*filter:\s*blur\(48px\)\s*saturate\(2\.8\)\s*brightness\(1\.3\)/);

        // Tablet / desktop breakpoint (min-width: 640px)
        assert.match(indexHtml, /@media\s*\(min-width:\s*640px\)\s*\{\s*#ambilight-glow\s*\{[^}]*inset:\s*-75px/);
        assert.match(indexHtml, /@media\s*\(min-width:\s*640px\)\s*\{\s*#ambilight-glow\s*\{[^}]*filter:\s*blur\(75px\)\s*saturate\(3\.0\)\s*brightness\(1\.35\)/);

        // Widescreen desktop breakpoint (min-width: 1024px)
        assert.match(indexHtml, /@media\s*\(min-width:\s*1024px\)\s*\{\s*#ambilight-glow\s*\{[^}]*inset:\s*-95px/);
        assert.match(indexHtml, /@media\s*\(min-width:\s*1024px\)\s*\{\s*#ambilight-glow\s*\{[^}]*filter:\s*blur\(88px\)\s*saturate\(3\.2\)\s*brightness\(1\.38\)/);

        // Liquid glass mode does NOT cap blur to 28px
        assert.doesNotMatch(indexHtml, /body\.liquid-glass-active\s*#main-music-card:not\(\.canvas-active\)\.playing\s*#ambilight-glow\s*\{[^}]*blur\(28px\)/);
        assert.match(indexHtml, /body\.liquid-glass-active\s*#main-music-card:not\(\.canvas-active\)\.playing\s*#ambilight-glow\s*\{[^}]*filter:\s*blur\(48px\)/);
    });

    await t.test('G3: Infinite Breathing Compositor Animation & Pause Dimming', () => {
        // Infinite alternate pulse
        assert.match(indexHtml, /\.playing\s*#ambilight-glow\s*\{[^}]*animation:\s*ambilight-pulse\s*8s\s*ease-in-out\s*infinite\s*alternate/);

        // GPU compositor transforms in @keyframes
        assert.match(indexHtml, /@keyframes\s*ambilight-pulse\s*\{[\s\S]*?transform:\s*scale\(1\.02\)\s*translate3d\(0,\s*0,\s*0\)[\s\S]*?transform:\s*scale\(1\.08\)\s*translate3d\(0,\s*0,\s*0\)/);

        // Paused state dims gracefully instead of hard clipping
        assert.match(indexHtml, /#main-music-card\.paused\s*#ambilight-glow\s*\{[^}]*opacity:\s*0\.38\s*!important/);
        assert.match(indexHtml, /#main-music-card\.paused\s*#ambilight-glow\s*\{[^}]*animation-play-state:\s*paused\s*!important/);
    });

    await t.test('G4: Mobile Thermal Guard Balance', () => {
        // Ensures mobile has ample 32px spread and 36px blur (not clamped to 15px/20px)
        assert.match(indexHtml, /:is\(html\.gp-android,\s*html\.gp-mobile,\s*html\.gp-pixel\)\s*#ambilight-glow\s*\{[^}]*filter:\s*blur\(36px\)/);
        assert.match(indexHtml, /:is\(html\.gp-android,\s*html\.gp-mobile,\s*html\.gp-pixel\)\s*#ambilight-glow\s*\{[^}]*inset:\s*-32px\s*!important/);
    });

    await t.test('G5: Dynamic Dominant Color Extraction', () => {
        // syncAllCoverConsumers extracts dominant color into --track-dominant-color
        assert.match(indexHtml, /card\.style\.setProperty\('--track-dominant-color'/);
    });
});
