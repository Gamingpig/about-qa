const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const indexPath = path.resolve(__dirname, '../index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf-8');

test('StandBy Pixel Shift Anti-Burn-In Protection (No Screen Overflow)', async (t) => {
    await t.test('S1: #standby-overlay enforces overflow: hidden and strict containment', () => {
        assert.match(indexHtml, /#standby-overlay\s*\{[^}]*overflow:\s*hidden\s*!important/s);
        assert.match(indexHtml, /#standby-overlay\s*\{[^}]*contain:\s*strict\s*!important/s);
    });

    await t.test('S2: #standby-shift-wrapper has padding and containment styling', () => {
        assert.match(indexHtml, /#standby-shift-wrapper\s*\{[^}]*padding:\s*0\s+12px;/s);
    });

    await t.test('S3: #standby-nowplaying enforces max-width calc(100vw - 28px)', () => {
        assert.match(indexHtml, /#standby-nowplaying\s*\{[^}]*max-width:\s*calc\(100vw\s*-\s*28px\)\s*!important/s);
    });

    await t.test('S4: shiftStandbyContent dynamically clamps coordinates within viewport bounds', () => {
        assert.match(indexHtml, /function shiftStandbyContent\(\)\s*\{[^}]*clampedX[^}]*getBoundingClientRect/s);
        assert.match(indexHtml, /document\.documentElement\.style\.setProperty\('--standby-shift-x',\s*clampedX\s*\+\s*'px'\)/);
        assert.match(indexHtml, /document\.documentElement\.style\.setProperty\('--standby-shift-y',\s*clampedY\s*\+\s*'px'\)/);
    });

    await t.test('S5: fitStandbyToScreen reserves safety buffer of at least 40px', () => {
        assert.match(indexHtml, /availW\s*=\s*Math\.max\(180,\s*overlay\.clientWidth\s*-\s*40\)/);
    });
});

test('iOS Dynamic Island Collision & Tap Handling', async (t) => {
    await t.test('D1: DOM contains safe-area-top-probe for accurate notch/island measuring', () => {
        assert.match(indexHtml, /id="safe-area-top-probe"/);
    });

    await t.test('D2: positionDynamicIsland uses probe element to measure safe area', () => {
        assert.match(indexHtml, /const probe = document\.getElementById\('safe-area-top-probe'\);/);
        assert.match(indexHtml, /if \(pRect\.top > 0\) safeAreaTop = pRect\.top;/);
    });

    await t.test('D3: Mobile main-content clearance protects against header collision', () => {
        assert.match(indexHtml, /@media\s*\(max-width:\s*639px\)\s*\{\s*#main-content\s*\{[^}]*padding-top:\s*max\(7\.5rem/s);
    });

    await t.test('D4: initIslandGestures uses 16px tap tolerance and handles tap on touch end', () => {
        assert.match(indexHtml, /const TAP_TOLERANCE = 16;/);
        assert.match(indexHtml, /else if \(!islandDragMoved \|\| Math\.abs\(delta\) <= TAP_TOLERANCE\)\s*\{\s*handleIslandTap\(\);/s);
    });
});

test('Liquid Glass Transparency Harmonization', async (t) => {
    await t.test('L1: Dark mode liquid glass uses unified rich opacity across cards and surfaces', () => {
        assert.match(indexHtml, /\.dark body\.liquid-glass-active :is\([^)]*\.glass-card[^)]*#header-section[^)]*#footer-expandable-menu[^)]*\)\s*\{[^}]*rgba\(30,\s*41,\s*59,\s*0\.82\)/s);
        assert.match(indexHtml, /\.dark body\.liquid-glass-active :is\([^)]*#main-music-card[^)]*\)\s*\{[^}]*rgba\(30,\s*41,\s*59,\s*0\.82\)/s);
    });

    await t.test('L2: Light mode liquid glass uses unified opacity across cards and surfaces', () => {
        assert.match(indexHtml, /body\.liquid-glass-active :is\([^)]*\.glass-card[^)]*#header-section[^)]*#footer-expandable-menu[^)]*\)\s*\{[^}]*rgba\(255,\s*255,\s*255,\s*0\.84\)/s);
        assert.match(indexHtml, /body\.liquid-glass-active :is\([^)]*#main-music-card[^)]*\)\s*\{[^}]*rgba\(255,\s*255,\s*255,\s*0\.84\)/s);
    });
});

test('Liquid Glass Normal Lyrics Backdrop Contrast', async (t) => {
    await t.test('Y1: Normal lyrics animation styles have high-contrast protective dark glass backdrop', () => {
        assert.match(indexHtml, /body\.liquid-glass-active #main-music-card\.lyrics-open #lyrics-overlay:not\(\.apple-ambient-active\)\s*\{[^}]*rgba\(15,\s*23,\s*42,\s*0\.94\)/s);
    });

    await t.test('Y2: Apple Ambient mode maintains transparent lyrics overlay', () => {
        assert.match(indexHtml, /body\.liquid-glass-active #main-music-card\.lyrics-open #lyrics-overlay\s*\{[^}]*background:\s*transparent\s*!important/s);
    });
});
