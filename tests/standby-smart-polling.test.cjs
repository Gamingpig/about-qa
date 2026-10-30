const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('Intelligent Adaptive StandBy & Music Polling (v24.216.0)', () => {
    const rootDir = path.resolve(__dirname, '..');
    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');

    it('S1: getAdaptiveMusicPollDelay and scheduleNextMusicPoll are exposed and defined', () => {
        assert.match(indexHtml, /function getAdaptiveMusicPollDelay\(\)/);
        assert.match(indexHtml, /function scheduleNextMusicPoll\(customDelay\)/);
        assert.match(indexHtml, /window\.getAdaptiveMusicPollDelay\s*=\s*getAdaptiveMusicPollDelay;/);
        assert.match(indexHtml, /window\.scheduleNextMusicPoll\s*=\s*scheduleNextMusicPoll;/);
    });

    it('S2: 5s fast-poll frequency is used during song end transition (isHuntingForNextTrack)', () => {
        assert.match(indexHtml, /if\s*\(isHuntingForNextTrack\)[\s\S]*?return 5000;/);
    });

    it('S3: Active playback uses the current 5s polling interval to limit drift and rate-limit pressure', () => {
        assert.match(indexHtml, /if \(trackIsPlaying && totalMs > 0\) \{[\s\S]*?return 5000;/);
    });

    it('S4: Idle or paused playback uses the current 8s polling interval', () => {
        assert.match(indexHtml, /\/\/ Wenn pausiert oder Idle: 8s[\s\S]*?return 8000;/);
    });

    it('S5: checkSongEndTrigger fires immediate fetchMusicData on currentMs >= totalMs without waiting', () => {
        assert.match(indexHtml, /function checkSongEndTrigger\(\)\s*\{/);
        assert.match(indexHtml, /if\s*\(currentMs >= totalMs\)\s*\{\s*if\s*\(!hasTriggeredSongEndFetch\)\s*\{\s*hasTriggeredSongEndFetch = true;\s*isHuntingForNextTrack = true;/);
        assert.match(indexHtml, /fetchMusicData\(\)\.finally/);
    });

    it('S6: Watchdog actively monitors and recovers StandBy sessions instead of skipping standByActive', () => {
        // Must NOT have `if (standByActive || shouldPauseBackgroundWork() || !trackIsPlaying) return;`
        assert.doesNotMatch(indexHtml, /if \(standByActive \|\| shouldPauseBackgroundWork\(\) \|\| !trackIsPlaying\) return;/);
        assert.match(indexHtml, /const needsActiveMonitoring = trackIsPlaying \|\| isHuntingForNextTrack;/);
        assert.match(indexHtml, /\} else if \(standByActive\) \{\s*const silentForMs = Date\.now\(\) - lastSuccessfulFetchAt;\s*if \(silentForMs > 60000\) \{/);
    });

    it('S7: updateWakeLockForPlaybackState maintains screen wake lock during isHuntingForNextTrack in StandBy', () => {
        assert.match(indexHtml, /const isTransitioning = typeof isHuntingForNextTrack !== 'undefined' && isHuntingForNextTrack && \(Date\.now\(\) - songTransitionStartedAt < 35000\);/);
        assert.match(indexHtml, /if \(trackIsPlaying \|\| isTransitioning\) requestStandbyWakeLock\(\);/);
    });

    it('S8: toggleStandBy immediately triggers fetchMusicData on StandBy activation', () => {
        assert.match(indexHtml, /\/\/ Frische Musikdaten beim Aktivieren von StandBy sofort abrufen\s*if \(typeof fetchMusicData === 'function'\) \{\s*fetchMusicData\(\)\.finally/);
    });

    it('S9: stats.fm 429 rate limit is gracefully handled with cooldown and backoff', () => {
        assert.match(indexHtml, /if\s*\(response\.status === 429\)\s*\{\s*statsFmRateLimitedUntil = Date\.now\(\) \+ 10000;/);
        assert.match(indexHtml, /if\s*\(Date\.now\(\) < statsFmRateLimitedUntil\)\s*\{\s*return \{ status: 'rate_limited', isRateLimited: true/);
        assert.match(indexHtml, /if \(statsResult\.status === 'fulfilled' && statsResult\.value && !statsResult\.value\.isRateLimited\)/);
    });

    it('S10: A stale active-track snapshot cannot un-clamp a locally completed song', () => {
        assert.match(indexHtml, /const songEndedLocally = trackIsPlaying && totalMs > 0 && \(currentMs >= totalMs \|\| expectedLocalProgress >= totalMs\);/);
        assert.match(indexHtml, /else if \(songEndedLocally\) \{[\s\S]*?currentMs = totalMs;\s*isHuntingForNextTrack = true;/);
    });

    it('S11: Explicit repeat/seek detection resets the local end-of-song hunt', () => {
        assert.match(indexHtml, /const isLegitRepeatOrSeek = \([\s\S]*?apiWentBackward[\s\S]*?\);/);
        assert.match(indexHtml, /if \(window\.isForceMusicSync \|\| isLegitRepeatOrSeek\) \{[\s\S]*?hasTriggeredSongEndFetch = false;\s*isHuntingForNextTrack = false;/);
    });
});

