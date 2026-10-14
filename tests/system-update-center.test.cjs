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

test('Android-Style System-Update Center & Controlled Update Workflow (v24.215.0)', async (t) => {
    await t.test('U1: Version 24.215.0 is synchronized across all core files', () => {
        assert.equal(versionJson.version, '24.215.0');
        assert.ok(Array.isArray(versionJson.shortNotes) && versionJson.shortNotes.length > 0, 'version.json has shortNotes');
        assert.match(swJs, /const SW_VERSION = "24\.215\.0";/);
        assert.match(indexHtml, /ONBOARDING_VERSION = 'v24\.215\.0/);
        assert.match(indexHtml, /id="footer-menu-hint"[^>]*>v24\.215\.0<\/span>/);
        assert.match(indexHtml, /id="footer-version-label"[^>]*>v24\.215\.0<\/span>/);
        assert.match(releaseHtml, /<title>Release Notes v24\.215\.0 – Gamingpig<\/title>/);
        assert.match(indexHtml, /version:\s*"v24\.215\.0"/);
    });

    await t.test('U2: Android-Style Update Center DOM elements exist in website settings', () => {
        const dom = new JSDOM(indexHtml);
        const doc = dom.window.document;

        const updateCard = doc.getElementById('settings-update-card');
        assert.ok(updateCard, '#settings-update-card must exist in DOM');

        const currentVer = doc.getElementById('settings-update-current-ver');
        assert.ok(currentVer, '#settings-update-current-ver must exist');

        const statusPill = doc.getElementById('settings-update-status-pill');
        assert.ok(statusPill, '#settings-update-status-pill must exist');

        const availBox = doc.getElementById('settings-update-available-box');
        assert.ok(availBox, '#settings-update-available-box must exist');

        const newVerTitle = doc.getElementById('settings-update-new-ver-title');
        assert.ok(newVerTitle, '#settings-update-new-ver-title must exist');

        const shortNotes = doc.getElementById('settings-update-short-notes');
        assert.ok(shortNotes, '#settings-update-short-notes must exist');

        const applyBtn = doc.getElementById('btn-settings-apply-update');
        assert.ok(applyBtn, '#btn-settings-apply-update must exist');

        const checkBtn = doc.getElementById('btn-manual-update-check');
        assert.ok(checkBtn, '#btn-manual-update-check must exist');

        const spinner = doc.getElementById('manual-check-spinner');
        assert.ok(spinner, '#manual-check-spinner must exist');

        const lastChecked = doc.getElementById('settings-update-last-checked');
        assert.ok(lastChecked, '#settings-update-last-checked must exist');
    });

    await t.test('U3: Badges exist on settings entry points', () => {
        const dom = new JSDOM(indexHtml);
        const doc = dom.window.document;

        const toggleBadge = doc.getElementById('settings-toggle-badge');
        assert.ok(toggleBadge, '#settings-toggle-badge on header settings button must exist');

        const footerBadge = doc.getElementById('footer-settings-badge');
        assert.ok(footerBadge, '#footer-settings-badge on footer settings button must exist');
    });

    await t.test('U4: Update prompt banner structure & persistent Notes behavior', () => {
        // Assert showUpdatePrompt definition exists and wires up buttons
        assert.match(indexHtml, /function showUpdatePrompt\(/);
        assert.match(indexHtml, /window\.showUpdatePrompt = showUpdatePrompt;/);

        // Notes button links to release.html without dismissing or snoozing
        assert.match(indexHtml, /id="gp-update-notes-btn"/);
        assert.match(indexHtml, /href="release\.html"/);

        // Apply update triggers applyPendingUpdate
        assert.match(indexHtml, /id="gp-update-reload-btn"[^>]*onclick="applyPendingUpdate\(\)"/);

        // Dismiss button marks snooze and activates settings badge
        assert.match(indexHtml, /id="gp-update-dismiss-btn"/);
        assert.match(indexHtml, /AppStorage\.setItem\('gp_update_snoozed_'/);
        assert.match(indexHtml, /setSettingsUpdateBadge\(true\)/);
    });

    await t.test('U5: Controlled user-driven updates (no automatic skipWaiting on install)', () => {
        // applyPendingUpdate sends SKIP_WAITING and reloads
        assert.match(indexHtml, /window\.applyPendingUpdate = function\(\)/);
        assert.match(indexHtml, /swRegistration\.waiting\.postMessage\(\{\s*type:\s*'SKIP_WAITING'\s*\}\)/);

        // sw.js does not unconditionally call self.skipWaiting() on install
        assert.ok(!swJs.includes('.then(() => self.skipWaiting())'), 'sw.js install does not call skipWaiting');

        // Manual check function exists and triggers update check
        assert.match(indexHtml, /window\.manualCheckForUpdates = async function/);
    });

    await t.test('U6: Android Settings search bar, categorized layout and mobile touch sizing', () => {
        const dom = new JSDOM(indexHtml);
        const doc = dom.window.document;

        const searchInput = doc.getElementById('settings-search-input');
        assert.ok(searchInput, '#settings-search-input must exist');
        assert.equal(searchInput.getAttribute('type'), 'search');

        const searchClear = doc.getElementById('settings-search-clear');
        assert.ok(searchClear, '#settings-search-clear must exist');

        const categories = doc.querySelectorAll('#global-settings-menu .settings-category');
        assert.ok(categories.length >= 5, 'Must have at least 5 settings categories');

        assert.match(indexHtml, /window\.filterSettings = function/);
        assert.match(indexHtml, /window\.clearSettingsSearch = function/);

        // Mobile touch targets: buttons have min-h-[44px]
        const menu = doc.getElementById('global-settings-menu');
        assert.ok(menu.className.includes('w-[94vw]'), 'Settings menu is responsive for mobile');
        assert.match(indexHtml, /min-h-\[44px\]/);
    });

    await t.test('U7: Android Settings Drilldown Navigation & Combined Recovery Category', () => {
        const dom = new JSDOM(indexHtml);
        const doc = dom.window.document;

        // Categories overview list and subpages container
        const categoriesList = doc.getElementById('settings-categories-list');
        assert.ok(categoriesList, '#settings-categories-list must exist');

        const subpagesContainer = doc.getElementById('settings-subpages-container');
        assert.ok(subpagesContainer, '#settings-subpages-container must exist');

        const headerMain = doc.getElementById('settings-header-main');
        assert.ok(headerMain, '#settings-header-main must exist');

        const headerSubpage = doc.getElementById('settings-header-subpage');
        assert.ok(headerSubpage, '#settings-header-subpage must exist');

        // Combined Recovery Category contains tutorial, onboarding, and full reset
        const recoverySubpage = doc.getElementById('subpage-cat-recovery');
        assert.ok(recoverySubpage, '#subpage-cat-recovery must exist');
        assert.ok(recoverySubpage.querySelector('#btn-restart-tutorial'), 'Recovery contains tutorial restart');
        assert.ok(recoverySubpage.querySelector('#btn-reset-onboarding'), 'Recovery contains onboarding reset');
        assert.ok(recoverySubpage.querySelector('button[onclick*="resetEverythingToFirstVisit"]'), 'Recovery contains full reset button');

        // Functions defined
        assert.match(indexHtml, /window\.openSettingsCategory = function/);
        assert.match(indexHtml, /window\.closeSettingsCategory = function/);
    });

    await t.test('U8: System-Info, 7-Tap Build Number & Developer Options', () => {
        const dom = new JSDOM(indexHtml);
        const doc = dom.window.document;

        const infoSubpage = doc.getElementById('subpage-cat-info');
        assert.ok(infoSubpage, '#subpage-cat-info must exist');

        const buildRow = doc.getElementById('settings-build-number-row');
        assert.ok(buildRow, '#settings-build-number-row must exist');
        assert.match(buildRow.getAttribute('onclick'), /handleBuildNumberTap\(\)/);

        const devTile = doc.getElementById('cat-tile-developer');
        assert.ok(devTile, '#cat-tile-developer tile must exist in DOM');
        assert.ok(devTile.classList.contains('hidden'), '#cat-tile-developer is hidden by default');

        const devSubpage = doc.getElementById('subpage-cat-developer');
        assert.ok(devSubpage, '#subpage-cat-developer must exist');
        assert.ok(devSubpage.querySelector('button[onclick*="simulateMockUpdate"]'), 'Mock update button exists');
        assert.ok(devSubpage.querySelector('button[onclick*="testFeedbackAndHaptics"]'), 'Haptics test button exists');

        assert.match(indexHtml, /window\.handleBuildNumberTap = function/);
        assert.match(indexHtml, /window\.updateDeveloperCategoryVisibility = function/);
        assert.match(indexHtml, /window\.disableDeveloperMode = function/);
        assert.match(indexHtml, /window\.simulateMockUpdate = function/);
        assert.match(indexHtml, /window\.testFeedbackAndHaptics = function/);
    });

    await t.test('U9: Light Mode Contrast in Settings & Quest HUD', () => {
        // Light mode rules for global settings menu
        assert.match(indexHtml, /html:not\(\.dark\)\s+#global-settings-menu/);
        assert.match(indexHtml, /html:not\(\.dark\)\s+#global-settings-menu\s+\.settings-category-tile/);
        assert.match(indexHtml, /html:not\(\.dark\)\s+#global-settings-menu\s+\.settings-item/);
        assert.match(indexHtml, /html:not\(\.dark\)\s+#global-settings-menu\s+#settings-search-input/);
        assert.match(indexHtml, /html:not\(\.dark\)\s+#interactive-quest-hud\s+> div/);

        // Crisp dark text for white/slate elements in light mode
        assert.match(indexHtml, /html:not\(\.dark\)\s+#global-settings-menu\s+:is\([\s\S]*?\.text-slate-100[\s\S]*?color:\s*#0f172a/);
    });

    await t.test('U10: Spotlight Search Button Design Swap & Resilient Fallback', () => {
        // Normal mode has clean frosted glass with standard 1px border
        assert.match(indexHtml, /#cp-trigger\s*\{[\s\S]*?border:\s*1px solid rgba\(255, 255, 255, 0\.12\)/);

        // Liquid Glass mode has rich linear-gradient and glossy specular border
        assert.match(indexHtml, /body\.liquid-glass-active\s+#cp-trigger\s*\{[\s\S]*?background:\s*linear-gradient/);
        assert.match(indexHtml, /body\.liquid-glass-active\s+:is\([^)]*#cp-trigger[^)]*\)::after/);

        // Music fallback handles stats.fm correctly with abort signal and proper timestamps
        assert.match(indexHtml, /function normalizeStatsFmMusicData\(payload\)/);
        assert.match(indexHtml, /timestamp:\s*Date\.now\(\)/);
        assert.match(indexHtml, /data\.source\s*===\s*'statsfm'/);
        assert.match(indexHtml, /drift\s*<\s*0\s*&&\s*drift\s*>\s*-15000/);
        assert.match(indexHtml, /Math\.abs\(calculatedOffset\)\s*<\s*500\s*\?\s*0\s*:\s*calculatedOffset/);
    });
});

