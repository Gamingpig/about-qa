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

            const widgetSc = manifestJson.shortcuts.find(s => s.name === 'Now-Playing Widget');
            assert.ok(widgetSc, 'Widget shortcut must exist');
            assert.equal(widgetSc.url, './?mode=widget');

            const arcadeSc = manifestJson.shortcuts.find(s => s.name === 'Retro Arcade');
            assert.ok(arcadeSc, 'Arcade shortcut must exist');
            assert.equal(arcadeSc.url, './arcade.html');
        });
    });

    describe('2. Settings Center Integration (index.html & app.html)', () => {
        for (const [name, html] of [['index.html', indexHtml], ['app.html', appHtml]]) {
            it(`W2.1: ${name} DOM contains Widgets category tile and subpage`, () => {
                const dom = new JSDOM(html);
                const doc = dom.window.document;

                const tile = doc.querySelector('button[onclick*="openSettingsCategory(\'cat-widgets\')"]');
                assert.ok(tile, `${name} must contain category tile for cat-widgets`);

                const subpage = doc.getElementById('subpage-cat-widgets');
                assert.ok(subpage, `${name} must contain subpage #subpage-cat-widgets`);

                // Live preview replica
                assert.ok(doc.getElementById('widget-live-replica'), '#widget-live-replica must exist');
                assert.ok(doc.getElementById('widget-replica-dot'), '#widget-replica-dot must exist');
                assert.ok(doc.getElementById('widget-replica-status'), '#widget-replica-status must exist');
                assert.ok(doc.getElementById('widget-replica-title'), '#widget-replica-title must exist');
                assert.ok(doc.getElementById('widget-replica-artist'), '#widget-replica-artist must exist');
                assert.ok(doc.getElementById('widget-replica-art'), '#widget-replica-art must exist');

                // Scriptable & shortcut action buttons
                assert.ok(doc.getElementById('btn-copy-scriptable-code'), '#btn-copy-scriptable-code must exist');
                assert.ok(doc.getElementById('btn-copy-standby-link'), '#btn-copy-standby-link must exist');
                assert.ok(doc.getElementById('btn-launch-widget-mode'), '#btn-launch-widget-mode must exist');
                assert.ok(doc.getElementById('btn-toggle-live-activity'), '#btn-toggle-live-activity must exist');

                // Exit bar
                assert.ok(doc.getElementById('widget-mode-exit-bar'), '#widget-mode-exit-bar must exist');
            });
        }

        it('W2.2: JavaScript functions for widgets are defined and exposed on window', () => {
            assert.match(indexHtml, /window\.activateWidgetMode\s*=/);
            assert.match(indexHtml, /window\.copyScriptableWidgetCode\s*=/);
            assert.match(indexHtml, /window\.copyStandbyShortcutLink\s*=/);
            assert.match(indexHtml, /window\.copyWidgetShortcutLink\s*=/);
            assert.match(indexHtml, /window\.setWidgetTheme\s*=/);
            assert.match(indexHtml, /window\.toggleLockscreenLiveActivity\s*=/);
            assert.match(indexHtml, /window\.syncMediaSessionMetadata\s*=/);
            assert.match(indexHtml, /window\.updateWidgetLiveReplica\s*=/);
            assert.match(indexHtml, /window\.syncWidgetsSettingsUI\s*=/);
        });
    });

    describe('3. Widget Mode CSS & Layout', () => {
        it('W3.1: CSS defines .widget-mode with layout isolation and element suppression', () => {
            assert.match(indexHtml, /body\.widget-mode\s*\{/);
            assert.match(indexHtml, /body\.widget-mode\s+#header-section/);
            assert.match(indexHtml, /body\.widget-mode\s+#main-music-card/);
        });

        it('W3.2: Startup script checks URL parameters for ?mode=standby and ?mode=widget', () => {
            assert.match(indexHtml, /_urlMode\s*===\s*'standby'/);
            assert.match(indexHtml, /_urlMode\s*===\s*'widget'/);
        });
    });

    describe('4. iOS Scriptable Widget Script', () => {
        it('W4.1: ios_scriptable_widget.js compiles cleanly and contains Lockscreen + Homescreen families', () => {
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
