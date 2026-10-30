const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appHtml = fs.readFileSync(path.join(__dirname, '../app.html'), 'utf8');
const artistFetch = appHtml.slice(appHtml.indexOf('async function fetchArtistDetails'), appHtml.indexOf('function applyArtistData'));
const artistSlideshow = appHtml.slice(appHtml.indexOf('function renderArtistSlideshow'), appHtml.indexOf('async function fetchArtistDetails'));
const imageExtractorSource = appHtml.match(/function extractSpotifyArtistProfileImages\(source\) \{[\s\S]*?\n        \}/)?.[0];
const profileFetcherSource = appHtml.match(/function fetchSpotifyArtistProfileImages\(spotifyArtistId\) \{[\s\S]*?\n        \}/)?.[0];
const extractSpotifyArtistProfileImages = vm.runInNewContext(`(${imageExtractorSource.trim()})`);

describe('Mobile lyrics performance and Spotify artist gallery', () => {
    it('defaults to Apple Music Pro unless low-end mode is enabled, preserving saved styles', () => {
        assert.match(appHtml, /const savedLyricsStyle = AppStorage\.getItem\('lyricsStyle'\);/);
        const migrationStart = appHtml.indexOf("const lyricsStyleMigrationKey = 'lyricsStyleDefaultMigration_v24.225.38';");
        const migrationEnd = appHtml.indexOf('function runPerfSelfTest()', migrationStart);
        const migrationSource = appHtml.slice(migrationStart, migrationEnd);
        const initializeStyle = (savedStyle, lowEnd, migrated = false) => {
            const storage = new Map();
            if (savedStyle) storage.set('lyricsStyle', savedStyle);
            if (migrated) storage.set('lyricsStyleDefaultMigration_v24.225.38', 'true');
            const context = {
                savedLyricsStyle: savedStyle,
                currentLyricsStyle: savedStyle || 'fill',
                AppStorage: {
                    getItem: key => storage.get(key) || null,
                    setItem: (key, value) => storage.set(key, String(value))
                },
                document: { body: { classList: { contains: () => lowEnd } } }
            };
            vm.runInNewContext(migrationSource, context);
            return { style: context.currentLyricsStyle, saved: storage.get('lyricsStyle') };
        };

        assert.deepEqual(initializeStyle(null, false), { style: 'applemusicpro', saved: 'applemusicpro' });
        assert.deepEqual(initializeStyle(null, true), { style: 'fill', saved: 'fill' });
        assert.deepEqual(initializeStyle('fill', false), { style: 'applemusicpro', saved: 'applemusicpro' });
        assert.deepEqual(initializeStyle('bounce', false), { style: 'bounce', saved: 'bounce' });
        assert.deepEqual(initializeStyle('fill', false, true), { style: 'fill', saved: 'fill' });
        const fillRule = appHtml.match(/\.lyrics-style-fill \.lyric-word \{([^}]+)\}/)?.[1] || '';
        assert.doesNotMatch(fillRule, /#fff|255,\s*255,\s*255/);
    });

    it('schedules touch/low-end lyrics updates at 30fps and cancels pending work', () => {
        assert.match(appHtml, /function requestLyricFrame\(\)[\s\S]*?\(pointer: coarse\)[\s\S]*?1000\s*\/\s*30/);
        assert.match(appHtml, /function cancelLyricFrame\(\)[\s\S]*?cancelAnimationFrame\(lyricAnimFrame\)[\s\S]*?clearTimeout\(lyricFrameTimeout\)/);
        assert.match(appHtml, /function stopProgressTracking\(\)[\s\S]*?cancelLyricFrame\(\)/);
    });

    it('uses only artist profile image URLs in the gallery, without album/track caps', () => {
        assert.match(artistFetch, /Array\.isArray\(match\.images\)/);
        assert.match(artistFetch, /extractSpotifyArtistProfileImages\(profileImageSources\.join/);
        assert.ok(artistFetch.indexOf('await statsFmPromise') < artistFetch.indexOf('await Promise.allSettled([wikiPromise, itunesPromise])'));
        assert.match(artistFetch, /loadAdditionalSpotifyArtistImages\(artistData, cleanKey, requestId\)/);
        assert.match(artistFetch, /bundledData\.images\.filter/);
        assert.doesNotMatch(artistFetch, /artists\/\$\{match\.id\}\/albums/);
        assert.doesNotMatch(artistFetch, /artistData\.images\.push\((?:currentResolvedArtUrl|albImg|art|pic)\)/);
        assert.doesNotMatch(artistFetch, /artistData\.images\.length\s*<\s*12/);
    });

    it('renders the stats.fm avatar before waiting for optional profile metadata', () => {
        const statsReady = artistFetch.indexOf('await statsFmPromise');
        const initialGallery = artistFetch.indexOf('applyArtistData(artistData)', statsReady);
        const slowMetadataWait = artistFetch.indexOf('await Promise.allSettled([wikiPromise, itunesPromise])');

        assert.ok(statsReady >= 0);
        assert.ok(initialGallery > statsReady);
        assert.ok(slowMetadataWait > initialGallery);
        assert.match(artistFetch, /loadAdditionalSpotifyArtistImages\(artistData, cleanKey, requestId\)/);
    });

    it('ignores stale artist requests after another profile is opened or the modal is closed', () => {
        assert.match(artistFetch, /requestId !== artistRequestSequence/);
        assert.match(appHtml, /window\.openArtistModal = function\(customArtist\) \{\s*const requestId = \+\+artistRequestSequence/);
        assert.match(appHtml, /window\.closeArtistModal = function\(\) \{\s*artistRequestSequence\+\+/);
    });

    it('animates gallery slides only after their replacement image is decoded', () => {
        assert.match(artistSlideshow, /const renderId = \+\+artistSlideRenderId/);
        assert.match(artistSlideshow, /const preloadedImage = new Image\(\)/);
        assert.match(artistSlideshow, /preloadedImage\.onload = \(\) =>/);
        assert.match(artistSlideshow, /preloadedImage\.decode\(\)\.then\(revealImage, revealImage\)/);
        assert.match(artistSlideshow, /requestAnimationFrame\(\(\) => \{\s*if \(renderId !== artistSlideRenderId\) return;/);
    });

    it('preloads each slide and fades it in after decode', async () => {
        const makeElement = () => {
            const classes = new Set();
            return {
                src: '',
                innerText: '',
                innerHTML: '',
                classList: {
                    add: (...names) => names.forEach(name => classes.add(name)),
                    remove: (...names) => names.forEach(name => classes.delete(name)),
                    contains: name => classes.has(name)
                },
                removeAttribute(name) { if (name === 'src') this.src = ''; }
            };
        };
        const foreground = makeElement();
        const background = makeElement();
        const counter = makeElement();
        const dots = makeElement();
        const elements = new Map([
            ['artist-gallery-img', foreground],
            ['artist-gallery-bg', background],
            ['artist-slide-counter', counter],
            ['artist-gallery-dots', dots]
        ]);
        class PreloadedImage {
            set src(url) { this.url = url; this.onload(); }
            decode() { return Promise.resolve(); }
        }
        const render = vm.runInNewContext(`(() => { ${artistSlideshow}; return renderArtistSlideshow; })()`, {
            currentArtistSlideImages: ['https://i.scdn.co/image/ab67616100005174' + 'a'.repeat(32)],
            currentArtistSlideIndex: 0,
            artistSlideRenderId: 0,
            document: {
                getElementById: id => elements.get(id),
                createElement: () => makeElement()
            },
            Image: PreloadedImage,
            requestAnimationFrame: callback => callback(),
            goToArtistSlide() {}
        });

        render();
        await new Promise(resolve => setImmediate(resolve));

        assert.equal(foreground.src, background.src);
        assert.equal(foreground.classList.contains('opacity-100'), true);
        assert.equal(foreground.classList.contains('opacity-0'), false);
        assert.equal(counter.innerText, '1 / 1');
    });

    it('keeps every distinct Spotify profile photo above twelve and ignores album covers', () => {
        const photoIds = Array.from({ length: 16 }, (_, index) => index.toString(16).padStart(24, '0'));
        const profileMarkup = photoIds.flatMap(id => [
            `https://i.scdn.co/image/ab67616100005174${id}`,
            `https://i.scdn.co/image/ab6761610000939b${id}`,
            `https://i.scdn.co/image/ab6761610000e5eb${id}`
        ]).join('\n');
        const mixedMarkup = `${profileMarkup}\nhttps://i.scdn.co/image/ab67616d0000b273${'0'.repeat(24)}`;
        const photos = extractSpotifyArtistProfileImages(mixedMarkup);

        assert.equal(photos.length, 16);
        assert.ok(photos.every(url => url.includes('ab6761610000e5eb')));
        assert.equal(photos.filter(url => url.includes('ab67616d')).length, 0);
    });

    it('falls back between profile proxies and caches the full image set', async () => {
        const photoIds = Array.from({ length: 16 }, (_, index) => index.toString(16).padStart(24, '0'));
        const profileMarkup = photoIds.map(id => `https://i.scdn.co/image/ab67616100005174${id}`).join('\n');
        const requests = [];
        const loadImages = vm.runInNewContext(`(() => {
            const spotifyArtistImageCache = new Map();
            const spotifyArtistImageRequests = new Map();
            ${imageExtractorSource}
            ${profileFetcherSource}
            return fetchSpotifyArtistProfileImages;
        })()`, {
            fetch: async url => {
                requests.push(url);
                if (url.includes('r.jina.ai')) return { ok: false, status: 503 };
                return { ok: true, text: async () => profileMarkup };
            },
            AbortController,
            setTimeout,
            clearTimeout,
            console: { info() {} }
        });

        const photos = await loadImages('spotify-artist-id');
        const firstRequestCount = requests.length;
        const cachedPhotos = await loadImages('spotify-artist-id');

        assert.equal(photos.length, 16);
        assert.deepEqual(cachedPhotos, photos);
        assert.equal(requests.length, firstRequestCount);
        assert.ok(firstRequestCount > 1);
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