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

test('Spotify Canvas Playback, Activation & Fallback Architecture (v24.245.99)', async (t) => {
    await t.test('C1: Version 24.245.99 is synchronized across all core files', () => {
        assert.equal(versionJson.version, '24.245.99');
        assert.match(swJs, /const SW_VERSION = "24\.245\.99";/);
        assert.match(indexHtml, /ONBOARDING_VERSION = 'v24\.245\.99 · 2026-11-23';/);
        assert.match(indexHtml, /id="footer-menu-hint"[^>]*>v24\.245\.99<\/span>/);
        assert.match(indexHtml, /id="footer-version-label"[^>]*>v24\.245\.99 \(QA Test\)<\/span>/);
        assert.match(releaseHtml, /<title>Release Notes v24\.245\.99 – Gamingpig<\/title>/);
        assert.match(indexHtml, /version:\s*"v24\.245\.99"/);
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
        // applyActiveMediaMode enforces singleActiveVideo 'none' and sets opacity-0 when currentCanvasUrl is absent
        assert.match(
            indexHtml,
            /!currentCanvasUrl[\s\S]*?enforceSingleActiveVideo\('none'\);[\s\S]*?canvasVideo\.classList\.add\('opacity-0'\)[\s\S]*?canvasMediaVideo\.classList\.add\('opacity-0'\)/,
            'applyActiveMediaMode must hide canvas videos when currentCanvasUrl is absent'
        );
        // Ensure no artificial canvas animation or fake visualizer is generated for canvas
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
});
