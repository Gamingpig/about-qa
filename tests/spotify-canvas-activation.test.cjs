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

test('Spotify Canvas Playback, Bounded Storage & Desktop Architecture (v24.245.102)', async (t) => {
    await t.test('C1: Version 24.245.102 is synchronized across all core files', () => {
        assert.equal(versionJson.version, '24.245.102');
        assert.match(swJs, /const SW_VERSION = "24\.245\.102";/);
        assert.match(indexHtml, /ONBOARDING_VERSION = 'v24\.245\.102 · 2026-11-24';/);
        assert.match(indexHtml, /id="footer-menu-hint"[^>]*>v24\.245\.102<\/span>/);
        assert.match(indexHtml, /id="footer-version-label"[^>]*>v24\.245\.102 \(QA Test\)<\/span>/);
        assert.match(releaseHtml, /<title>Release Notes v24\.245\.102/);
        assert.match(indexHtml, /version:\s*"v24\.245\.102"/);
    });

    await t.test('C2: toggleDashboard invokes applyActiveMediaMode on open and close', () => {
        assert.match(
            indexHtml,
            /window\.toggleDashboard\s*=\s*function\(\)\s*\{[\s\S]*?if\s*\(isDashboardOpen\)\s*\{[\s\S]*?applyActiveMediaMode\(\)/,
            'toggleDashboard must call applyActiveMediaMode when opening'
        );
        assert.match(
            indexHtml,
            /window\.toggleDashboard\s*=\s*function\(\)\s*\{[\s\S]*?\}\s*else\s*\{[\s\S]*?applyActiveMediaMode\(\)/,
            'toggleDashboard must call applyActiveMediaMode when closing'
        );
        assert.match(
            indexHtml,
            /if\s*\(isDashboardOpen\)\s*\{[\s\S]*?isMusicCardInViewport\s*=\s*true;/,
            'toggleDashboard must reset isMusicCardInViewport to true on open'
        );
    });

    await t.test('C3: Startup layout detection is executed on initial page load', () => {
        assert.match(
            indexHtml,
            /document\.addEventListener\('DOMContentLoaded',\s*\(\)\s*=>\s*\{[\s\S]*?detectAndApplyLayoutMode\(\);[\s\S]*?\}\s*\)\s*;\s*\}\s*else\s*\{[\s\S]*?detectAndApplyLayoutMode\(\);/,
            'detectAndApplyLayoutMode must be executed on DOMContentLoaded or immediate readyState'
        );
    });

    await t.test('C4: enforceSingleActiveVideo manages dashboard and cinema video playback including cinema glow', () => {
        assert.match(
            indexHtml,
            /mode\s*===\s*'cinema'[\s\S]*?if\s*\(cinemaGlowVideo\s*&&[\s\S]*?cinemaGlowVideo\.play\(\)/,
            'enforceSingleActiveVideo in cinema mode must play cinemaGlowVideo when active'
        );
        assert.match(
            indexHtml,
            /mode\s*===\s*'dashboard'[\s\S]*?cVideo\.play\(\)[\s\S]*?mVideo\.play\(\)/,
            'enforceSingleActiveVideo in dashboard mode must play cVideo and mVideo'
        );
    });

    await t.test('C5: Graceful fallback strictly preserves album cover artwork without artificial visualizers', () => {
        assert.match(
            indexHtml,
            /!currentCanvasUrl[\s\S]*?enforceSingleActiveVideo\('none'\);[\s\S]*?canvasVideo\.classList\.add\('opacity-0'\)[\s\S]*?canvasMediaVideo\.classList\.add\('opacity-0'\)/,
            'applyActiveMediaMode must hide canvas videos when currentCanvasUrl is absent'
        );
        assert.doesNotMatch(indexHtml, /function createArtificialCanvas/, 'No fake canvas generation function allowed');
        assert.doesNotMatch(indexHtml, /function generateProceduralCanvas/, 'No procedural fake visualizer allowed');
    });

    await t.test('C6: resolveSpotifyCanvas supports custom proxy and detects disabled deployments', () => {
        assert.match(
            indexHtml,
            /gp_custom_canvas_proxy[\s\S]*?primaryTargets\.push\(customTarget\)/,
            'resolveSpotifyCanvas must support custom canvas proxy'
        );
        assert.match(
            indexHtml,
            /txt\.includes\('DEPLOYMENT_DISABLED'\)\s*\|\|\s*txt\.includes\('Payment Required'\)/,
            'resolveSpotifyCanvas must fast-fail on disabled/payment-required Vercel deployments'
        );
    });

    await t.test('C7: DOM contains all 5 Spotify Canvas video locations with correct IDs', () => {
        const dom = new JSDOM(indexHtml);
        const doc = dom.window.document;
        assert.ok(doc.getElementById('canvas-media-video'), 'Cover canvas media video must exist');
        assert.ok(doc.getElementById('canvas-video'), 'Background canvas video must exist');
        assert.ok(doc.getElementById('canvas-glow-video'), 'Ambilight glow canvas video must exist');
        assert.ok(doc.getElementById('lyrics-canvas-video'), 'Lyrics background canvas video must exist');
        assert.ok(doc.getElementById('canvas-cinema-video'), 'Cinema modal video must exist');
        assert.ok(doc.getElementById('canvas-cinema-glow-video'), 'Cinema modal glow video must exist');
    });

    await t.test('C8: First Move (Lily Ward, 7F1lGSxfmWzayn8Y8GJr4P) is bundled with official Spotify Canvas URL', () => {
        assert.match(
            indexHtml,
            /"7F1lGSxfmWzayn8Y8GJr4P":\s*"https:\/\/canvaz\.scdn\.co\/upload\/artist\/1kYMGmkw8ta4nvMiK0pcdF\/video\/d44ae7d4d9e04409be4faca2a93d7b65\.cnvs\.mp4"/,
            'BUNDLED_CANVAS_DB must contain official canvas for 7F1lGSxfmWzayn8Y8GJr4P'
        );
        assert.match(
            indexHtml,
            /"7f1lgsxfmwzayn8y8gjr4p":\s*"https:\/\/canvaz\.scdn\.co\/upload\/artist\/1kYMGmkw8ta4nvMiK0pcdF\/video\/d44ae7d4d9e04409be4faca2a93d7b65\.cnvs\.mp4"/,
            'BUNDLED_CANVAS_DB must contain lowercase key for 7f1lgsxfmwzayn8y8gjr4p'
        );
    });

    await t.test('C9: Universal live resolver and Settings proxy input are wired in DOM and JS', () => {
        assert.match(
            indexHtml,
            /primaryTargets\.push\(`https:\/\/r\.jina\.ai\/https:\/\/canvasdownloader\.com\/canvas\?link=https:\/\/open\.spotify\.com\/track\/\$\{encodeURIComponent\(cleanId\)\}`\)/,
            'resolveSpotifyCanvas must query universal live resolver via Jina Reader'
        );
        const dom = new JSDOM(indexHtml);
        const doc = dom.window.document;
        assert.ok(doc.getElementById('settings-canvas-proxy-input'), '#settings-canvas-proxy-input must exist in settings');
        assert.ok(doc.getElementById('btn-settings-toggle-canvas'), '#btn-settings-toggle-canvas must exist in settings');
    });

    await t.test('C10: Bounded cache management limits memory usage across in-memory caches', () => {
        assert.match(indexHtml, /function setBoundedMap\(/, 'setBoundedMap helper must exist');
        assert.match(indexHtml, /setBoundedMap\(trackCanvasMemoryCache,\s*[^,]+,\s*[^,]+,\s*30\)/, 'trackCanvasMemoryCache must be bounded to 30 items');
        assert.match(indexHtml, /setBoundedMap\(trackCanvasNegativeCache,\s*cleanId,\s*\{[\s\S]*?\},\s*50\)/, 'trackCanvasNegativeCache must be bounded to 50 items');
        assert.match(indexHtml, /setBoundedMap\(canvasIdSearchCache,\s*key,\s*\{[\s\S]*?\},\s*50\)/, 'canvasIdSearchCache must be bounded to 50 items');
        assert.match(indexHtml, /setBoundedMap\(lyricsMemoryCache,\s*cacheKey,\s*\{[\s\S]*?\},\s*20\)/, 'lyricsMemoryCache must be bounded to 20 items');
    });

    await t.test('C11: Desktop layout enforces containment and compositor layer isolation', () => {
        assert.match(indexHtml, /html\.gp-desktop #desktop-sidebar-col\s*\{[\s\S]*?contain:\s*layout style !important;/);
        assert.match(indexHtml, /html\.gp-desktop #desktop-sidebar-col #header-section\s*\{[\s\S]*?contain:\s*layout paint style !important;[\s\S]*?isolation:\s*isolate !important;[\s\S]*?transform:\s*translate3d\(0,\s*0,\s*0\) !important;/);
        assert.match(indexHtml, /html\.gp-desktop #desktop-content-col\s*\{[\s\S]*?contain:\s*layout style !important;/);
        assert.match(indexHtml, /resizeLayoutRaf\s*=\s*requestAnimationFrame/, 'Window resize must be debounced via RAF');
    });

    await t.test('C12: Service worker fetch ignores media/video streams and bounds runtime caches', () => {
        assert.match(swJs, /\.endsWith\("\.mp4"\)\s*\|\|\s*url\.pathname\.endsWith\("\.cnvs\.mp4"\)/, 'SW fetch must bypass videos');
        assert.match(swJs, /runtime\.length - 25/, 'SW runtime cache must be bounded to 25 items');
    });

    await t.test('C13: Settings UI contains cache cleanup tool (#btn-clear-temp-cache)', () => {
        const dom = new JSDOM(indexHtml);
        const doc = dom.window.document;
        assert.ok(doc.getElementById('btn-clear-temp-cache'), '#btn-clear-temp-cache button must exist in settings');
        assert.match(indexHtml, /window\.clearTempStorageAndCaches\s*=\s*async function/, 'clearTempStorageAndCaches function must exist');
    });

    await t.test('C14: Album art square (#canvas-media-video) has sync, readyState protection and 3D parity', () => {
        assert.match(
            indexHtml,
            /if\s*\(mVideo\s*&&\s*canvasEnabled\s*&&\s*isPlaying\s*&&\s*currentCanvasUrl\)\s*\{[\s\S]*?mVideo\.src\s*!==\s*currentCanvasUrl[\s\S]*?mVideo\.play\(\)/,
            'enforceSingleActiveVideo dashboard must self-heal mVideo.src and play'
        );
        assert.match(
            indexHtml,
            /function\s*lockVideoPair[\s\S]*?if\s*\(slave\.readyState\s*<\s*2\)\s*return;/,
            'lockVideoPair must guard timeupdate seek against slave.readyState < 2'
        );
        assert.match(
            indexHtml,
            /body\.tilt-active\s*#media-container\s*#canvas-media-video/,
            'body.tilt-active selector must include #canvas-media-video for 3D Z parity'
        );
        assert.match(
            indexHtml,
            /id="canvas-media-video"[^>]*style="[^"]*contain:\s*strict;[^"]*will-change:\s*opacity,\s*transform;[^"]*"/,
            'canvas-media-video must have strict containment and will-change attributes'
        );
    });
});
