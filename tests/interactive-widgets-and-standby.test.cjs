'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;

const ROOT = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appHtml = fs.readFileSync(path.join(ROOT, 'app.html'), 'utf8');
const manifestJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.json'), 'utf8'));
const roadmapMeta = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/roadmap_meta.json'), 'utf8'));
const roadmapHtml = fs.readFileSync(path.join(ROOT, 'roadmap.html'), 'utf8');
const scriptableJs = fs.readFileSync(path.join(ROOT, 'ios_scriptable_widget.js'), 'utf8');

describe('Interaktive Widgets für Homescreen & StandBy (Roadmap Card 4)', () => {
    describe('1. PWA Manifest Shortcuts', () => {
        it('W1.1: manifest.json defines shortcuts array with all required entries', () => {
            assert.ok(Array.isArray(manifestJson.shortcuts), 'manifest.json must have shortcuts array');
            assert.ok(manifestJson.shortcuts.length >= 3, 'Must have at least 3 shortcuts');

            const standbySc = manifestJson.shortcuts.find(s => s.name === 'StandBy Modus');
            assert.ok(standbySc, 'StandBy shortcut must exist');
            assert.equal(standbySc.url, './?mode=standby');

            const arcadeSc = manifestJson.shortcuts.find(s => s.name === 'Retro Arcade');
            assert.ok(arcadeSc, 'Arcade shortcut must exist');
            assert.equal(arcadeSc.url, './arcade.html');
        });
    });

    describe('2. Streamlined Settings Center Integration (index.html & app.html)', () => {
        for (const [name, html] of [['index.html', indexHtml], ['app.html', appHtml]]) {
            it(`W2.1: ${name} DOM contains clean Widgets category tile, OS tabs, APK download, Scriptable & StandBy`, () => {
                const dom = new JSDOM(html);
                const doc = dom.window.document;

                const tile = doc.querySelector('button[onclick*="openSettingsCategory(\'cat-widgets\')"]');
                assert.ok(tile, `${name} must contain category tile for cat-widgets`);

                const subpage = doc.getElementById('subpage-cat-widgets');
                assert.ok(subpage, `${name} must contain subpage #subpage-cat-widgets`);

                // OS tabs & panels
                assert.ok(doc.getElementById('tab-wos-android'), '#tab-wos-android must exist');
                assert.ok(doc.getElementById('tab-wos-ios'), '#tab-wos-ios must exist');
                assert.ok(doc.getElementById('widget-panel-android'), '#widget-panel-android must exist');
                assert.ok(doc.getElementById('widget-panel-ios'), '#widget-panel-ios must exist');

                // Primary real actions (Android APK, iOS Scriptable, StandBy Link)
                const apkBtn = doc.getElementById('btn-download-android-apk');
                assert.ok(apkBtn, '#btn-download-android-apk must exist');
                assert.equal(apkBtn.getAttribute('href'), 'downloads/GamingpigWidget.apk');

                assert.ok(doc.getElementById('btn-copy-scriptable-code'), '#btn-copy-scriptable-code must exist');
                assert.ok(doc.getElementById('btn-copy-standby-link'), '#btn-copy-standby-link must exist');

                // Unnecessary web-widget clutter must be removed
                assert.equal(doc.getElementById('widget-mode-exit-bar'), null, '#widget-mode-exit-bar must be removed');
                assert.equal(doc.getElementById('btn-launch-widget-mode'), null, '#btn-launch-widget-mode must be removed');
            });
        }

        it('W2.2: JavaScript functions for widgets are defined and exposed on window', () => {
            assert.match(indexHtml, /window\.switchWidgetOsTab\s*=/);
            assert.match(indexHtml, /window\.copyScriptableWidgetCode\s*=/);
            assert.match(indexHtml, /window\.copyStandbyShortcutLink\s*=/);
            assert.match(indexHtml, /window\.syncWidgetsSettingsUI\s*=/);
        });
    });

    describe('3. iOS Scriptable Widget Script', () => {
        it('W3.1: ios_scriptable_widget.js compiles cleanly and contains Lockscreen + Homescreen families', () => {
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            assert.doesNotThrow(() => {
                new AsyncFunction(scriptableJs);
            }, 'ios_scriptable_widget.js must compile without syntax errors');

            assert.match(scriptableJs, /family\s*===\s*"accessoryRectangular"/, 'Must handle iOS Lockscreen accessory');
            assert.match(scriptableJs, /family\s*===\s*"small"/, 'Must handle small widget');
            assert.match(scriptableJs, /family\s*===\s*"medium"/, 'Must handle medium widget');
            assert.match(scriptableJs, /WIDGET_PARAM\.includes\("oled"\)/, 'Must support OLED theme');
            assert.match(scriptableJs, /WIDGET_PARAM\.includes\("cyber"\)/, 'Must support Cyber theme');
        });
    });

    describe('4. Native Android Widget APK Project & Update Pipeline', () => {
        it('W4.1: Native Android Widget APK project, UpdateChecker & GitHub Actions build pipeline exist', () => {
            assert.ok(fs.existsSync(path.join(ROOT, 'android-widget/app/build.gradle.kts')), 'Android build.gradle.kts must exist');
            assert.ok(fs.existsSync(path.join(ROOT, 'android-widget/app/src/main/java/de/gamingpig/widget/GamingpigWidgetProvider.kt')), 'GamingpigWidgetProvider.kt must exist');
            assert.ok(fs.existsSync(path.join(ROOT, 'android-widget/app/src/main/java/de/gamingpig/widget/MainActivity.kt')), 'MainActivity.kt must exist');
            assert.ok(fs.existsSync(path.join(ROOT, 'android-widget/app/src/main/java/de/gamingpig/widget/UpdateChecker.kt')), 'UpdateChecker.kt must exist');
            assert.ok(fs.existsSync(path.join(ROOT, 'downloads/widget_version.json')), 'downloads/widget_version.json must exist');
            assert.ok(fs.existsSync(path.join(ROOT, '.github/workflows/build-android-widget.yml')), 'build-android-widget.yml must exist');
        });
    });

    describe('5. Roadmap & Metadata Status Update (Live)', () => {
        it('W5.1: data/roadmap_meta.json synchronizes Card 4 to live status', () => {
            assert.ok(roadmapMeta.items && roadmapMeta.items['4'], 'Card 4 must exist in roadmap_meta.json');
            assert.equal(roadmapMeta.items['4'].status, 'live');
            assert.equal(roadmapMeta.items['4'].target, 'Ziel: Live / Verfügbar');
            assert.match(roadmapMeta.items['4'].desc, /Einstellungs-Zentrum/);
        });

        it('W5.2: roadmap.html static fallback renders Card 4 as live with emerald neon border', () => {
            assert.match(roadmapHtml, /data-card-id="4"[^>]*data-category="live"|data-category="live"[^>]*data-card-id="4"/);
            assert.match(roadmapHtml, /data-card-id="4"[\s\S]*?border-l-emerald-500/);
            assert.match(roadmapHtml, /data-card-id="4"[\s\S]*?🚀 Live \/ Verfügbar/);
        });
    });
});
