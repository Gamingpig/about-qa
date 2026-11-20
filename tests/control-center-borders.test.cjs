/**
 * Test Suite: Control Center Button Borders & Automatic Update Check Verification
 *
 * Requirements:
 * - B1: #ui-controls-items provides vertical and horizontal padding when open to prevent clipping of button rings
 * - B2: Buttons in #ui-controls enforce inset ring styling (--tw-ring-inset: inset) on hover and active states
 * - B3: Automatic background update checking on boot (1.5s delay) and on tab focus is active
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

describe('Control Center Button Borders & Automatic Update Verification', () => {
    it('B1: #ui-controls-items provides padding when open in CSS', () => {
        // Assert open state rules contain padding
        const openMatch = indexHtml.match(/#ui-controls\.is-open #ui-controls-items,\s*#ui-controls\.ui-controls-open #ui-controls-items\s*\{([\s\S]*?)\}/);
        assert.ok(openMatch, 'Open rule for #ui-controls-items must exist');
        const openCss = openMatch[1];
        assert.ok(openCss.includes('padding-left: 6px') || openCss.includes('padding:'), 'Open state must have horizontal padding');
        assert.ok(openCss.includes('padding-top: 5px') || openCss.includes('padding:'), 'Open state must have vertical padding');
    });

    it('B2: CSS enforces inset rings for #ui-controls buttons on hover and active', () => {
        const insetMatch = indexHtml.match(/#ui-controls button:hover,\s*#ui-controls button:focus-visible,\s*#ui-controls button\.ring-2,\s*#ui-controls button\[class\*="ring-2"\]\s*\{([\s\S]*?)\}/);
        assert.ok(insetMatch, 'CSS rule for inset ring on #ui-controls button must exist');
        assert.ok(insetMatch[1].includes('--tw-ring-inset: inset !important'), 'Rule must enforce --tw-ring-inset: inset !important');
    });

    it('B3: Automatic update checking is enabled on startup and focus', () => {
        assert.ok(indexHtml.includes("setTimeout(() => {"), 'Startup check timer must exist');
        assert.ok(indexHtml.includes("manualCheckForUpdates(false)"), 'Startup must call manualCheckForUpdates(false)');
        assert.ok(indexHtml.includes("window.addEventListener('focus'"), 'Focus listener for updates must exist');
        assert.ok(indexHtml.includes("document.addEventListener('visibilitychange'"), 'Visibility change listener must exist');
    });
});
