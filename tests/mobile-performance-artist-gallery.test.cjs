const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appHtml = fs.readFileSync(path.join(__dirname, '../app.html'), 'utf8');
const artistFetch = appHtml.slice(appHtml.indexOf('async function fetchArtistDetails'), appHtml.indexOf('function applyArtistData'));
const imageExtractorSource = appHtml.match(/function extractSpotifyArtistProfileImages\(source\) \{[\s\S]*?\n        \}/)?.[0];
const extractSpotifyArtistProfileImages = vm.runInNewContext(`(${imageExtractorSource.trim()})`);

describe('Mobile lyrics performance and Spotify artist gallery', () => {
    it('schedules touch/low-end lyrics updates at 30fps and cancels pending work', () => {
        assert.match(appHtml, /function requestLyricFrame\(\)[\s\S]*?\(pointer: coarse\)[\s\S]*?1000\s*\/\s*30/);
        assert.match(appHtml, /function cancelLyricFrame\(\)[\s\S]*?cancelAnimationFrame\(lyricAnimFrame\)[\s\S]*?clearTimeout\(lyricFrameTimeout\)/);
        assert.match(appHtml, /function stopProgressTracking\(\)[\s\S]*?cancelLyricFrame\(\)/);
    });

    it('uses only artist profile image URLs in the gallery, without album/track caps', () => {
        assert.match(artistFetch, /Array\.isArray\(match\.images\)/);
        assert.match(artistFetch, /extractSpotifyArtistProfileImages\(profileImageSources\.join/);
        assert.match(artistFetch, /bundledData\.images\.filter/);
        assert.doesNotMatch(artistFetch, /artists\/\$\{match\.id\}\/albums/);
        assert.doesNotMatch(artistFetch, /artistData\.images\.push\((?:currentResolvedArtUrl|albImg|art|pic)\)/);
        assert.doesNotMatch(artistFetch, /artistData\.images\.length\s*<\s*12/);
    });

    it('ignores stale artist requests after another profile is opened or the modal is closed', () => {
        assert.match(artistFetch, /requestId !== artistRequestSequence/);
        assert.match(appHtml, /window\.openArtistModal = function\(customArtist\) \{\s*const requestId = \+\+artistRequestSequence/);
        assert.match(appHtml, /window\.closeArtistModal = function\(\) \{\s*artistRequestSequence\+\+/);
    });

    it('keeps every distinct Spotify profile photo above twelve and ignores album covers', () => {
        const photoIds = Array.from({ length: 16 }, (_, index) => index.toString(16).padStart(24, '0'));
        const profileMarkup = photoIds.flatMap(id => [
            `https://i.scdn.co/image/ab67616100005174${id}`,
            `https://i.scdn.co/image/ab6761610000939b${id}`
        ]).join('\n');
        const mixedMarkup = `${profileMarkup}\nhttps://i.scdn.co/image/ab67616d0000b273${'0'.repeat(24)}`;
        const photos = extractSpotifyArtistProfileImages(mixedMarkup);

        assert.equal(photos.length, 16);
        assert.ok(photos.every(url => url.includes('ab6761610000e5eb')));
        assert.equal(photos.filter(url => url.includes('ab67616d')).length, 0);
    });

    it('clamps the default fill gradient and avoids character timing outside character styles', () => {
        assert.match(appHtml, /lyrics-style-fill \.lyric-word \{[^}]*min\(calc\(var\(--fill-percent, 0%\) \+ 4%\), 95%\)/s);
        const lineCache = appHtml.slice(appHtml.indexOf('function buildLineAnimCache'), appHtml.indexOf('function animateLineWords'));
        assert.match(lineCache, /if \(lyricsDomHasCharSplit\) \{[\s\S]*?getCharWeight/);

        const makeCacheBuilder = (lyricsDomHasCharSplit, getCharWeight) => vm.runInNewContext(
            `(() => { ${lineCache}; return buildLineAnimCache; })()`,
            {
                parsedLyrics: [{ timeMs: 100, tokens: [{ cleanText: 'word,', timeMs: 100, duration: 500, isPhraseEnd: false }] }],
                lyricsDomHasCharSplit,
                getCharWeight,
                document: { getElementById: () => ({}) }
            }
        );
        const wordModeCache = makeCacheBuilder(false, () => { throw new Error('word-only style calculated character weights'); })(0);
        const charModeCache = makeCacheBuilder(true, char => char === ',' ? 0 : 1)(0);

        assert.equal(wordModeCache.words[0].chars.length, 0);
        assert.ok(Math.abs(charModeCache.words[0].chars.at(-1).endRatio - 1) < 1e-12);
    });
});