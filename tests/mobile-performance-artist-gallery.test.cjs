const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const appHtml = fs.readFileSync(path.join(__dirname, '../app.html'), 'utf8');
const artistFetch = appHtml.slice(appHtml.indexOf('async function fetchArtistDetails'), appHtml.indexOf('function applyArtistData'));
const artistSlideshow = appHtml.slice(appHtml.indexOf('function renderArtistSlideshow'), appHtml.indexOf('async function fetchArtistDetails'));
const imageExtractorSource = appHtml.match(/function extractSpotifyArtistProfileImages\(source(?:,\s*spotifyArtistId)?\) \{[\s\S]*?\r?\n        \}/)?.[0];
const pathfinderSource = appHtml.match(/async function fetchSpotifyPathfinderArtistOverview\(spotifyArtistId\) \{[\s\S]*?\r?\n        \}/)?.[0];
const profileFetcherSource = appHtml.match(/function fetchSpotifyArtistProfileImages\(spotifyArtistId\) \{[\s\S]*?\r?\n          \}/)?.[0];
const extractSpotifyArtistProfileImages = vm.runInNewContext(`(${imageExtractorSource.trim()})`);

describe('Mobile lyrics performance and Spotify artist gallery', () => {
    it('defaults to Apple Music Pro unless low-end mode is enabled, preserving saved styles including fill', () => {
        assert.match(appHtml, /const savedLyricsStyle = AppStorage\.getItem\('lyricsStyle'\);/);
        const migrationStart = appHtml.indexOf("const isLowEndLyricsMode = document.body.classList.contains('low-end');");
        const migrationEnd = appHtml.indexOf('function runPerfSelfTest()', migrationStart);
        const migrationSource = appHtml.slice(migrationStart, migrationEnd);
        const initializeStyle = (savedStyle, lowEnd) => {
            const storage = new Map();
            if (savedStyle) storage.set('lyricsStyle', savedStyle);
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
        assert.deepEqual(initializeStyle('fill', false), { style: 'fill', saved: 'fill' });
        assert.deepEqual(initializeStyle('bounce', false), { style: 'bounce', saved: 'bounce' });
        const fillRule = appHtml.match(/\.lyrics-style-fill \.lyric-word \{([^}]+)\}/)?.[1] || '';
        assert.match(fillRule, /linear-gradient\(to right, #ffffff var\(--fill-percent, 0%\), rgba\(255,\s*255,\s*255,\s*0\.2\) var\(--fill-percent, 0%\)\)/);
    });

    it('detects song changes reliably even if a provider carries a stale spotifyId', () => {
        const normSource = appHtml.match(/function normLyricsStr\(s\) \{[\s\S]*?\r?\n        \}/)?.[0];
        const sameSongSource = appHtml.match(/function isSameSongTrack\(titleA, artistA, idA, titleB, artistB, idB\) \{[\s\S]*?\r?\n        \}/)?.[0];
        const isSameSongTrack = vm.runInNewContext(`(() => { ${normSource}; ${sameSongSource}; return isSameSongTrack; })()`);

        assert.equal(isSameSongTrack('I Never Lose', 'ILKO', 'sp123', 'Faster Than Light', 'ILKO', 'sp123'), false);
        assert.equal(isSameSongTrack('I Never Lose', 'ILKO', 'sp123', 'I Never Lose - Single Version', 'ILKO', 'sp123'), true);
        const fetchMusicSource = appHtml.slice(appHtml.indexOf('async function fetchMusicData()'), appHtml.indexOf('// FIX v24.68'));
        assert.doesNotMatch(fetchMusicSource, /const merged = \{ \.\.\.npcData[^\n]*\r?\n\s*if \(statsFmData\?\.track\?\.spotifyId\) merged\.track\.spotifyId = statsFmData\.track\.spotifyId/);
    });

    it('schedules touch/low-end lyrics updates at 30fps and cancels pending work', () => {
        assert.match(appHtml, /function requestLyricFrame\(\)[\s\S]*?\(pointer: coarse\)[\s\S]*?1000\s*\/\s*30/);
        assert.match(appHtml, /function cancelLyricFrame\(\)[\s\S]*?cancelAnimationFrame\(lyricAnimFrame\)[\s\S]*?clearTimeout\(lyricFrameTimeout\)/);
        assert.match(appHtml, /function stopProgressTracking\(\)[\s\S]*?cancelLyricFrame\(\)/);
    });

    it('uses artist profile image URLs in the gallery and loads additional Spotify profile images', () => {
        assert.match(artistFetch, /Array\.isArray\(match\.images\)/);
        assert.match(artistFetch, /extractSpotifyArtistProfileImages\(profileImageSources\.join/);
        assert.ok(artistFetch.indexOf('await statsFmPromise') < artistFetch.indexOf('await Promise.allSettled([wikiPromise, itunesPromise])'));
        assert.match(artistFetch, /loadAdditionalSpotifyArtistImages\(artistData, cleanKey, requestId\)/);
        assert.match(artistFetch, /bundledData\.images\.filter\(Boolean\)/);
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

    it('preloads each slide and fades it in after decode with smooth transition', async () => {
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
            currentArtistSlideImages: ['https://i.scdn.co/image/ab67616100005174' + 'a'.repeat(24)],
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
        assert.match(appHtml, /#artist-gallery-img\.artist-slide-animate \{\s*animation:\s*none\s*!important;/);
    });

    it('extracts official Spotify About section gallery photos exclusively and falls back to avatars if none exist, strictly excluding release/album covers and Fans Also Like strangers', () => {
        const photoIds = Array.from({ length: 16 }, (_, index) => index.toString(16).padStart(24, '0'));
        const profileMarkupWithAbout = [
            ...photoIds.flatMap(id => [
                `https://i.scdn.co/image/ab67616100005174${id}`,
                `https://i.scdn.co/image/ab6761610000939b${id}`,
                `https://i.scdn.co/image/ab6761610000e5eb${id}`
            ]),
            `https://i.scdn.co/image/ab6761670000ecd4${'a'.repeat(24)}`,
            `https://i.scdn.co/image/ab6761670000ecd4${'d'.repeat(24)}`,
            `https://i.scdn.co/image/ab67618600001016${'b'.repeat(24)}`,
            `https://i.scdn.co/image/ab67616d00001e02${'c'.repeat(24)}`,
            '## [Fans also like](https://open.spotify.com/artist/xyz/related)',
            `https://i.scdn.co/image/ab6761670000ecd4${'e'.repeat(24)}`,
            `https://i.scdn.co/image/ab6761610000e5eb${'f'.repeat(24)}`
        ].join('\n');
        const aboutPhotos = extractSpotifyArtistProfileImages(profileMarkupWithAbout);

        // When About section photos are present, take all of them without duplicates and without header/album covers/avatars
        assert.equal(aboutPhotos.length, 2);
        assert.ok(aboutPhotos.includes(`https://i.scdn.co/image/ab6761670000ecd4${'a'.repeat(24)}`));
        assert.ok(aboutPhotos.includes(`https://i.scdn.co/image/ab6761670000ecd4${'d'.repeat(24)}`));
        assert.ok(!aboutPhotos.includes(`https://i.scdn.co/image/ab67618600001016${'b'.repeat(24)}`));
        assert.ok(!aboutPhotos.includes(`https://i.scdn.co/image/ab67616d00001e02${'c'.repeat(24)}`));
        assert.ok(!aboutPhotos.includes(`https://i.scdn.co/image/ab6761670000ecd4${'e'.repeat(24)}`)); // after Fans also like

        // Fallback: If no About section photos exist, fallback to avatar photos (excluding related artists and duplicates)
        const profileMarkupWithoutAbout = [
            ...photoIds.flatMap(id => [
                `https://i.scdn.co/image/ab67616100005174${id}`,
                `https://i.scdn.co/image/ab6761610000939b${id}`,
                `https://i.scdn.co/image/ab6761610000e5eb${id}`
            ]),
            `https://i.scdn.co/image/ab67618600001016${'b'.repeat(24)}`,
            `https://i.scdn.co/image/ab67616d00001e02${'c'.repeat(24)}`,
            '## [Fans also like](https://open.spotify.com/artist/xyz/related)',
            `https://i.scdn.co/image/ab6761610000e5eb${'f'.repeat(24)}`
        ].join('\n');
        const fallbackPhotos = extractSpotifyArtistProfileImages(profileMarkupWithoutAbout);
        assert.equal(fallbackPhotos.length, 16);
        assert.ok(!fallbackPhotos.includes(`https://i.scdn.co/image/ab67618600001016${'b'.repeat(24)}`));
        assert.ok(!fallbackPhotos.includes(`https://i.scdn.co/image/ab67616d00001e02${'c'.repeat(24)}`));
        assert.ok(!fallbackPhotos.includes(`https://i.scdn.co/image/ab6761610000e5eb${'f'.repeat(24)}`));
    });

    it('falls back between profile proxies and caches the full image set', async () => {
        const photoIds = Array.from({ length: 16 }, (_, index) => index.toString(16).padStart(24, '0'));
        const profileMarkup = photoIds.map(id => `https://i.scdn.co/image/ab67616100005174${id}`).join('\n');
        const requests = [];
        const loadImages = vm.runInNewContext(`(() => {
            const spotifyArtistImageCache = new Map();
            const spotifyArtistImageRequests = new Map();
            const spotifyArtistBioCache = new Map();
            ${imageExtractorSource}
            ${pathfinderSource}
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

    it('restores the classic live fill gradient and avoids character timing outside character styles', () => {
        assert.match(appHtml, /lyrics-style-fill \.lyric-word \{[^}]*linear-gradient\(to right, #ffffff var\(--fill-percent, 0%\)/s);
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
    it('normalizes artist names and handles special characters, symbols, and punctuation', () => {
        const normSource = appHtml.match(/function normalizeArtistName\(name\) \{[\s\S]*?\r?\n        \}/)?.[0];
        const normalize = vm.runInNewContext(`(() => { ${normSource}; return normalizeArtistName; })()`);

        assert.equal(normalize('AC/DC'), 'ac dc');
        assert.equal(normalize('P!nk'), 'p!nk');
        assert.equal(normalize('A$AP Rocky'), 'a$ap rocky');
        assert.equal(normalize('Ke$ha'), 'ke$ha');
        assert.equal(normalize('Beyoncé'), 'beyonce');
        assert.equal(normalize('Panic! At The Disco'), 'panic! at the disco');
        assert.equal(normalize('t.A.T.u.'), 't.a.t.u.');
    });

    it('extracts primary collaborators and featuring artists from diverse query patterns', () => {
        const extractSource = appHtml.match(/function extractArtistCandidates\(rawName\) \{[\s\S]*?\r?\n        \}/)?.[0];
        const extractCandidates = vm.runInNewContext(`(() => { ${extractSource}; return extractArtistCandidates; })()`);

        const featResult = extractCandidates('David Guetta feat. Sia');
        assert.ok(featResult.includes('David Guetta feat. Sia'));
        assert.ok(featResult.includes('David Guetta'));

        const ftResult = extractCandidates('Calvin Harris ft. Ellie Goulding');
        assert.ok(ftResult.includes('Calvin Harris ft. Ellie Goulding'));
        assert.ok(ftResult.includes('Calvin Harris'));

        const withResult = extractCandidates('Post Malone with Swae Lee');
        assert.ok(withResult.includes('Post Malone with Swae Lee'));
        assert.ok(withResult.includes('Post Malone'));

        const xResult = extractCandidates('Marshmello x Khalid');
        assert.ok(xResult.includes('Marshmello x Khalid'));
        assert.ok(xResult.includes('Marshmello'));

        const ampResult = extractCandidates('Alan Walker & Ava Max');
        assert.ok(ampResult.includes('Alan Walker & Ava Max'));
        assert.ok(ampResult.includes('Alan Walker'));

        const commaResult = extractCandidates('Barun Kumar Pal, Sunni Holden');
        assert.ok(commaResult.includes('Barun Kumar Pal, Sunni Holden'));
        assert.ok(commaResult.includes('Barun Kumar Pal'));

        const duoResult = extractCandidates('Marcus & Martinus');
        assert.equal(duoResult[0], 'Marcus & Martinus');
    });

    it('ranks multiple returned artists by exact match and popularity score rather than blind index [0]', () => {
        const normSource = appHtml.match(/function normalizeArtistName\(name\) \{[\s\S]*?\r?\n        \}/)?.[0];
        const rankSource = appHtml.match(/function rankArtistSearchResults\(artists, targetName\) \{[\s\S]*?\r?\n        \}/)?.[0];
        const rankArtists = vm.runInNewContext(`(() => { ${normSource}; ${rankSource}; return rankArtistSearchResults; })()`);

        const returnedMockArtists = [
            { id: '1', name: 'Alan Walker Fan Club', followers: 250, image: null },
            { id: '2', name: 'Alan Walker', followers: 42500000, verified: true, image: 'https://i.scdn.co/image/ab6761610000e5eb1' },
            { id: '3', name: 'Alan', followers: 12000, image: 'https://i.scdn.co/image/ab6761610000e5eb2' }
        ];

        const winner = rankArtists(returnedMockArtists, 'Alan Walker');
        assert.equal(winner.id, '2');
        assert.equal(winner.name, 'Alan Walker');

        // Ambiguous artist with punctuation/accents
        const ambiguousMockArtists = [
            { id: '10', name: 'Beyonce Tribute', followers: 500 },
            { id: '20', name: 'Beyoncé', followers: 35000000, verified: true, image: 'https://i.scdn.co/image/ab6761610000e5eb3' }
        ];
        const beyonceWinner = rankArtists(ambiguousMockArtists, 'Beyonce');
        assert.equal(beyonceWinner.id, '20');
    });

    it('retries failed network calls with exponential backoff on transient errors', async () => {
        const retrySource = appHtml.match(/async function fetchArtistWithRetry\(url[\s\S]*?\r?\n        \}/)?.[0];
        let callCount = 0;
        const mockFetch = async () => {
            callCount++;
            if (callCount < 2) {
                return { ok: false, status: 503 };
            }
            return { ok: true, json: async () => ({ success: true }) };
        };

        const fetchWithRetry = vm.runInNewContext(`(() => { ${retrySource}; return fetchArtistWithRetry; })()`, {
            fetch: mockFetch,
            AbortController,
            setTimeout,
            clearTimeout
        });

        const res = await fetchWithRetry('https://api.stats.fm/api/v1/search?query=test', 2000, 2, [10, 20]);
        assert.ok(res.ok);
        assert.equal(callCount, 2);
    });

    it('provides graceful fallback rendering when an artist has no valid image URL returned', async () => {
        const fallbackSource = appHtml.match(/const ARTIST_PROFILE_FALLBACK_SVG = "[^"]+";/)?.[0] || 'const ARTIST_PROFILE_FALLBACK_SVG = "fallback.svg";';
        const makeElement = () => {
            const classes = new Set();
            return {
                src: '',
                innerText: '',
                innerHTML: '',
                style: { opacity: '1' },
                classList: {
                    add: (...names) => names.forEach(name => classes.add(name)),
                    remove: (...names) => names.forEach(name => classes.delete(name)),
                    contains: name => classes.has(name)
                }
            };
        };
        const foreground = makeElement();
        const background = makeElement();
        const counter = makeElement();
        const dots = makeElement();
        const skeleton = makeElement();
        const elements = new Map([
            ['artist-gallery-img', foreground],
            ['artist-gallery-bg', background],
            ['artist-slide-counter', counter],
            ['artist-gallery-dots', dots],
            ['artist-gallery-skeleton', skeleton]
        ]);

        const render = vm.runInNewContext(`(() => { ${artistSlideshow}; return renderArtistSlideshow; })()`, {
            currentArtistSlideImages: [],
            currentArtistSlideIndex: 0,
            artistSlideRenderId: 0,
            document: {
                getElementById: id => elements.get(id),
                createElement: () => makeElement()
            },
            Image: class {},
            requestAnimationFrame: cb => cb(),
            goToArtistSlide() {}
        });

        render();
        await new Promise(resolve => setImmediate(resolve));

        assert.ok(foreground.src.includes('data:image/svg+xml') || foreground.src.includes('fallback'));
        assert.equal(foreground.classList.contains('opacity-100'), true);
        assert.equal(foreground.classList.contains('opacity-0'), false);
        assert.equal(skeleton.style.opacity, '0');
    });
});
