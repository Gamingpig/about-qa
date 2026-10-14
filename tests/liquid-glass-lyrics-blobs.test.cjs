/**
 * Unit & Integration Test Suite: Liquid-Glass Background Persistence & GPU Relief during Lyrics
 *
 * Requirements:
 * - R1: Preserve #liquid-blobs wallpaper background in Liquid-Glass mode when lyrics are open
 * - R1: Relieve GPU by pausing / hiding compute-heavy animations (.blob-container, .blob, .mesh-gradient, #particles-container, #ambilight-glow)
 * - R2: Consistent behavior across standard and Apple Music lyrics styles
 * - R2: Seamless restore upon closing without flickering or visual artifacts
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const indexPath = path.join(__dirname, '../index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');

describe('Liquid Glass & Lyrics Background Persistence (R1 & R2)', () => {

    describe('CSS Rule Contract Verification', () => {
        it('T1.1: #liquid-blobs is NOT targeted by display:none !important in lyrics-open rules', () => {
            // Find the lyrics-open performance rule block in index.html
            const perfRuleMatch = indexHtml.match(/#main-music-card\.lyrics-open #particles-container[\s\S]*?\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?\}/);
            assert.ok(perfRuleMatch, 'Performance rule block must exist in index.html');
            const perfRule = perfRuleMatch[0];

            // Ensure #liquid-blobs is NOT in the selector list
            assert.ok(!perfRule.includes('#liquid-blobs'), '#liquid-blobs must NOT be hidden with display:none !important in lyrics rules');
        });

        it('T1.2: Compute-heavy animation elements ARE hidden with display:none !important when lyrics are open', () => {
            const perfRuleMatch = indexHtml.match(/#main-music-card\.lyrics-open #particles-container[\s\S]*?\{[\s\S]*?display:\s*none\s*!important;[\s\S]*?\}/);
            assert.ok(perfRuleMatch);
            const perfRule = perfRuleMatch[0];

            assert.ok(perfRule.includes('.blob-container'), '.blob-container must be hidden during lyrics');
            assert.ok(perfRule.includes('.blob'), '.blob must be hidden during lyrics');
            assert.ok(perfRule.includes('.mesh-gradient'), '.mesh-gradient must be hidden during lyrics');
            assert.ok(perfRule.includes('#particles-container'), '#particles-container must be hidden during lyrics');
            assert.ok(perfRule.includes('#ambilight-glow'), '#ambilight-glow must be hidden during lyrics');
            assert.ok(perfRule.includes('#ambient-bg'), '#ambient-bg must be hidden during lyrics');
        });

        it('T1.3: Blobs are included in animation-play-state: paused !important rules during lyrics', () => {
            const pauseRuleMatch = indexHtml.match(/body:has\(#main-music-card\.lyrics-open\)\s*\.blob-container[\s\S]*?animation-play-state:\s*paused\s*!important;/);
            assert.ok(pauseRuleMatch, 'Blob container must be paused via CSS when lyrics are open');
        });

        it('T1.4: Explicit guard rule guarantees display: block !important for #liquid-blobs when liquid-glass is active with lyrics open', () => {
            const guardRuleMatch = indexHtml.match(/body\.liquid-glass-active[\s\S]*?#liquid-blobs\s*\{[\s\S]*?display:\s*block\s*!important;[\s\S]*?\}/);
            assert.ok(guardRuleMatch, 'Explicit liquid-glass lyrics guard rule must be defined');
        });
    });

    describe('R1: Liquid Glass Wallpaper Persistence', () => {
        it('T2.1: #liquid-blobs is display:none when liquid-glass mode is inactive', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            assert.ok(liquidBlobs);

            const style = dom.window.getComputedStyle(liquidBlobs);
            assert.equal(style.display, 'none', '#liquid-blobs should be hidden when liquid-glass mode is off');
        });

        it('T2.2: #liquid-blobs is display:block when liquid-glass mode is active', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            assert.ok(liquidBlobs);

            doc.body.classList.add('liquid-glass-active');
            const style = dom.window.getComputedStyle(liquidBlobs);
            assert.equal(style.display, 'block', '#liquid-blobs should be display:block when liquid-glass is active');
        });

        it('T2.3: #liquid-blobs remains display:block when lyrics are open in liquid-glass mode', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            const mainMusicCard = doc.getElementById('main-music-card');
            assert.ok(liquidBlobs);
            assert.ok(mainMusicCard);

            doc.body.classList.add('liquid-glass-active');
            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');

            const style = dom.window.getComputedStyle(liquidBlobs);
            assert.notEqual(style.display, 'none', '#liquid-blobs must NOT be display:none when lyrics are open');
            assert.equal(style.display, 'block', '#liquid-blobs must be display:block when lyrics are open in liquid-glass mode');
        });

        it('T2.4: Cover-art background-image is preserved when lyrics open and close', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            const mainMusicCard = doc.getElementById('main-music-card');

            doc.body.classList.add('liquid-glass-active');
            const coverUrl = 'url("https://i.scdn.co/image/ab67616d0000b273d4c6d66e5f3")';
            liquidBlobs.style.setProperty('background-image', coverUrl, 'important');
            liquidBlobs.style.setProperty('background-size', 'cover', 'important');

            // Initial check
            assert.equal(liquidBlobs.style.getPropertyValue('background-image'), coverUrl);

            // Open lyrics
            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');

            // Verify background-image remains intact
            assert.equal(liquidBlobs.style.getPropertyValue('background-image'), coverUrl);
            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block');

            // Close lyrics
            mainMusicCard.classList.remove('lyrics-open');
            doc.body.classList.remove('lyrics-mode-active');

            // Verify background-image still intact
            assert.equal(liquidBlobs.style.getPropertyValue('background-image'), coverUrl);
            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block');
        });

        it('T2.5: Either lyrics-open or lyrics-mode-active alone keeps #liquid-blobs visible in liquid-glass mode', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            const mainMusicCard = doc.getElementById('main-music-card');

            doc.body.classList.add('liquid-glass-active');

            // Only lyrics-open on main-music-card
            mainMusicCard.classList.add('lyrics-open');
            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block');
            mainMusicCard.classList.remove('lyrics-open');

            // Only lyrics-mode-active on body
            doc.body.classList.add('lyrics-mode-active');
            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block');
            doc.body.classList.remove('lyrics-mode-active');
        });
    });

    describe('R1: GPU Relief & Intensive Animation Suppression', () => {
        it('T3.1: .blob-container is hidden (display: none) when lyrics are open', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const blobContainer = doc.querySelector('.blob-container');
            const mainMusicCard = doc.getElementById('main-music-card');
            assert.ok(blobContainer);

            doc.body.classList.add('liquid-glass-active');
            assert.notEqual(dom.window.getComputedStyle(blobContainer).display, 'none');

            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');
            assert.equal(dom.window.getComputedStyle(blobContainer).display, 'none');
        });

        it('T3.2: .blob is hidden (display: none) when lyrics are open', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const blob = doc.querySelector('.blob');
            const mainMusicCard = doc.getElementById('main-music-card');
            assert.ok(blob);

            doc.body.classList.add('liquid-glass-active');
            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');
            assert.equal(dom.window.getComputedStyle(blob).display, 'none');
        });

        it('T3.3: .mesh-gradient is hidden (display: none) when lyrics are open', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const mesh = doc.querySelector('.mesh-gradient');
            const mainMusicCard = doc.getElementById('main-music-card');
            assert.ok(mesh);

            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');
            assert.equal(dom.window.getComputedStyle(mesh).display, 'none');
        });

        it('T3.4: Closing lyrics restores .blob-container to display: block', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const blobContainer = doc.querySelector('.blob-container');
            const mainMusicCard = doc.getElementById('main-music-card');

            doc.body.classList.add('liquid-glass-active');
            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');
            assert.equal(dom.window.getComputedStyle(blobContainer).display, 'none');

            // Close
            mainMusicCard.classList.remove('lyrics-open');
            doc.body.classList.remove('lyrics-mode-active');
            assert.equal(dom.window.getComputedStyle(blobContainer).display, 'block');
        });

        it('T3.5: All suppressed GPU layers (particles, ambilight, ambient, mesh) restore display:block when lyrics close', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const mainMusicCard = doc.getElementById('main-music-card');
            const particles = doc.getElementById('particles-container');
            const glow = doc.getElementById('ambilight-glow');
            const ambient = doc.getElementById('ambient-bg');
            const mesh = doc.querySelector('.mesh-gradient');

            doc.body.classList.add('liquid-glass-active');
            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');

            assert.equal(dom.window.getComputedStyle(particles).display, 'none');
            assert.equal(dom.window.getComputedStyle(glow).display, 'none');
            assert.equal(dom.window.getComputedStyle(ambient).display, 'none');
            assert.equal(dom.window.getComputedStyle(mesh).display, 'none');

            // Close lyrics
            mainMusicCard.classList.remove('lyrics-open');
            doc.body.classList.remove('lyrics-mode-active');

            assert.equal(dom.window.getComputedStyle(particles).display, 'block');
            assert.equal(dom.window.getComputedStyle(glow).display, 'block');
            assert.equal(dom.window.getComputedStyle(ambient).display, 'block');
            assert.equal(dom.window.getComputedStyle(mesh).display, 'block');
        });
    });

    describe('R2: Consistent Behavior across Styles and State Cycles', () => {
        it('T4.1: Apple Music style (apple-ambient-active) preserves #liquid-blobs display and cover art', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            const mainMusicCard = doc.getElementById('main-music-card');
            const lyricsOverlay = doc.getElementById('lyrics-overlay');

            doc.body.classList.add('liquid-glass-active');
            const coverUrl = 'url("https://example.com/album.png")';
            liquidBlobs.style.setProperty('background-image', coverUrl, 'important');

            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');
            if (lyricsOverlay) lyricsOverlay.classList.add('apple-ambient-active');

            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block');
            assert.equal(liquidBlobs.style.getPropertyValue('background-image'), coverUrl);
        });

        it('T4.2: Mobile/Android environment preserves #liquid-blobs display with static background', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            const mainMusicCard = doc.getElementById('main-music-card');

            doc.documentElement.classList.add('gp-android');
            doc.body.classList.add('liquid-glass-active');

            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');

            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block');
            assert.notEqual(dom.window.getComputedStyle(liquidBlobs).display, 'none');
        });

        it('T4.3: Inactive liquid-glass mode does not leak #liquid-blobs during lyrics open', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            const mainMusicCard = doc.getElementById('main-music-card');

            // liquid-glass-active NOT set
            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');

            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'none');
        });

        it('T4.4: Multi-cycle rapid open/close sequence preserves wallpaper and toggles animation suppression cleanly', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            const mainMusicCard = doc.getElementById('main-music-card');
            const blobContainer = doc.querySelector('.blob-container');
            const coverUrl = 'url("https://example.com/cover-cycle.jpg")';

            doc.body.classList.add('liquid-glass-active');
            liquidBlobs.style.setProperty('background-image', coverUrl, 'important');

            for (let i = 0; i < 5; i++) {
                // Open
                mainMusicCard.classList.add('lyrics-open');
                doc.body.classList.add('lyrics-mode-active');
                assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block', `Cycle ${i}: display should be block when open`);
                assert.equal(liquidBlobs.style.getPropertyValue('background-image'), coverUrl, `Cycle ${i}: bg image preserved`);
                assert.equal(dom.window.getComputedStyle(blobContainer).display, 'none', `Cycle ${i}: blobs hidden when open`);

                // Closing
                mainMusicCard.classList.remove('lyrics-open');
                mainMusicCard.classList.add('lyrics-closing-state');
                doc.body.classList.remove('lyrics-mode-active');
                assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block', `Cycle ${i}: display should remain block during closing`);

                // Fully closed
                mainMusicCard.classList.remove('lyrics-closing-state');
                assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block', `Cycle ${i}: display should be block when closed`);
                assert.equal(dom.window.getComputedStyle(blobContainer).display, 'block', `Cycle ${i}: blobs restored when closed`);
            }
        });

        it('T4.5: Intermediate lyrics-closing-state keeps #liquid-blobs visible without flicker', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            const mainMusicCard = doc.getElementById('main-music-card');

            doc.body.classList.add('liquid-glass-active');
            mainMusicCard.classList.add('lyrics-closing-state');

            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block');
        });

        it('T4.6: Background-image update while lyrics are active seamlessly updates wallpaper', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            const mainMusicCard = doc.getElementById('main-music-card');

            doc.body.classList.add('liquid-glass-active');
            const initialCover = 'url("https://example.com/song-a.jpg")';
            const nextCover = 'url("https://example.com/song-b.jpg")';

            liquidBlobs.style.setProperty('background-image', initialCover, 'important');
            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');

            assert.equal(liquidBlobs.style.getPropertyValue('background-image'), initialCover);
            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block');

            // Dynamic live track switch during active lyrics view
            liquidBlobs.style.setProperty('background-image', nextCover, 'important');
            assert.equal(liquidBlobs.style.getPropertyValue('background-image'), nextCover);
            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block');
        });

        it('T4.7: Both dark and light mode maintain wallpaper visibility during lyrics open', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            const mainMusicCard = doc.getElementById('main-music-card');

            doc.body.classList.add('liquid-glass-active');
            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');

            // Light mode
            doc.documentElement.classList.remove('dark');
            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block');

            // Dark mode
            doc.documentElement.classList.add('dark');
            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block');
        });

        it('T4.8: Low-end mode suppresses #liquid-blobs (display: none) even if lyrics are open', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            const mainMusicCard = doc.getElementById('main-music-card');

            doc.body.classList.add('liquid-glass-active', 'low-end');
            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');

            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'none');
        });

        it('T4.9: Mobile/Android environment preserves inline cover art and keeps .blob-container suppressed after lyrics close', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            const mainMusicCard = doc.getElementById('main-music-card');
            const blobContainer = doc.querySelector('.blob-container');
            const coverUrl = 'url("https://example.com/mobile-cover.jpg")';

            doc.documentElement.classList.add('gp-android');
            doc.body.classList.add('liquid-glass-active');
            liquidBlobs.style.setProperty('background-image', coverUrl, 'important');

            // Open lyrics
            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');

            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block');
            assert.equal(liquidBlobs.style.getPropertyValue('background-image'), coverUrl);
            assert.equal(dom.window.getComputedStyle(blobContainer).display, 'none');

            // Close lyrics on mobile
            mainMusicCard.classList.remove('lyrics-open');
            doc.body.classList.remove('lyrics-mode-active');

            // #liquid-blobs remains visible with cover art, and .blob-container must remain suppressed on mobile
            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block');
            assert.equal(liquidBlobs.style.getPropertyValue('background-image'), coverUrl);
            assert.equal(dom.window.getComputedStyle(blobContainer).display, 'none');
        });

        it('T4.10: Exhaustive multi-style switching during active lyrics mode preserves wallpaper display', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            const mainMusicCard = doc.getElementById('main-music-card');
            const lyricsOverlay = doc.getElementById('lyrics-overlay');
            const lyricsContainer = doc.getElementById('lyrics-container');
            const coverUrl = 'url("https://example.com/multi-style.jpg")';

            doc.body.classList.add('liquid-glass-active');
            liquidBlobs.style.setProperty('background-image', coverUrl, 'important');
            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');

            const styles = ['standard', 'applemusic', 'applemusicpro', 'bounce', 'fill', 'blur', 'wave', 'neon', 'glitch', 'liquid'];
            for (const style of styles) {
                if (lyricsContainer) lyricsContainer.className = `lyrics-style-${style}`;
                const isApple = style === 'applemusic' || style === 'applemusicpro';
                if (lyricsOverlay) lyricsOverlay.classList.toggle('apple-ambient-active', isApple);

                assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block', `Style ${style} must keep #liquid-blobs visible`);
                assert.equal(liquidBlobs.style.getPropertyValue('background-image'), coverUrl, `Style ${style} must preserve background-image`);
            }
        });

        it('T4.11: Rapid interleaved lyrics open and standby transitions preserve state consistency', () => {
            const dom = new JSDOM(indexHtml, { runScripts: 'outside-only' });
            const doc = dom.window.document;
            const liquidBlobs = doc.getElementById('liquid-blobs');
            const mainMusicCard = doc.getElementById('main-music-card');
            const blobContainer = doc.querySelector('.blob-container');

            doc.body.classList.add('liquid-glass-active');

            // Open lyrics
            mainMusicCard.classList.add('lyrics-open');
            doc.body.classList.add('lyrics-mode-active');
            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block');
            assert.equal(dom.window.getComputedStyle(blobContainer).display, 'none');

            // Close lyrics
            mainMusicCard.classList.remove('lyrics-open');
            doc.body.classList.remove('lyrics-mode-active');
            assert.equal(dom.window.getComputedStyle(liquidBlobs).display, 'block');
            assert.equal(dom.window.getComputedStyle(blobContainer).display, 'block');
        });
    });
});

