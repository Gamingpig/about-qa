const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

describe('Playback Pause/Stop Wallpaper Fade, Synchronized TTS & Lyrics Freeze (v24.209.0)', () => {
    const rootDir = path.resolve(__dirname, '..');
    const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf-8');

    it('P1.1: #liquid-blobs has smooth CSS transition for opacity and maintains display: block in Liquid Glass', () => {
        assert.match(indexHtml, /#liquid-blobs\s*\{[^}]*transition:[^;]*opacity\s+1\.5s/);
        assert.match(indexHtml, /body\.liquid-glass-active:not\(\.low-end\)\s+#liquid-blobs\s*\{[^}]*display:\s*block;/);
    });

    it('P1.2: updateMusicUI sets opacity 0 on pause and offline, opacity 1 on play', () => {
        assert.match(indexHtml, /const liquidBg = document\.getElementById\('liquid-blobs'\);\s*if \(liquidBg\) liquidBg\.style\.setProperty\('opacity',\s*'0'\);/);
        assert.match(indexHtml, /const liquidBg = document\.getElementById\('liquid-blobs'\);\s*if \(liquidBg\) liquidBg\.style\.setProperty\('opacity',\s*'1'\);/);
    });

    it('P2.1: speakLyricsSynced pauses TTS when music is paused and resumes when resumed', () => {
        assert.match(indexHtml, /while\s*\(!trackIsPlaying && ttsSyncedPlaybackActive\)\s*\{\s*if\s*\(typeof speechSynthesis !== 'undefined' && speechSynthesis\.speaking && !speechSynthesis\.paused\)\s*\{\s*speechSynthesis\.pause\(\);/);
    });

    it('P2.2: speakUtteranceAndWait actively tracks trackIsPlaying to pause and resume speechSynthesis', () => {
        assert.match(indexHtml, /!trackIsPlaying && speechSynthesis\.speaking && !speechSynthesis\.paused/);
        assert.match(indexHtml, /trackIsPlaying && speechSynthesis\.paused/);
    });

    it('P2.3: closing lyrics or going offline cancels TTS immediately', () => {
        assert.match(indexHtml, /if \(ttsSyncedPlaybackActive[^)]*\)\s*\{[^}]*speechSynthesis\.cancel\(\);/);
    });

    it('P3.1: syncLyricsUI handles freeze on pause and re-syncs accurately', () => {
        assert.match(indexHtml, /syncLyricsUI\(true,\s*true\);/);
    });
});
