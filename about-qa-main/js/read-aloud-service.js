/**
 * Universal ReadAloudService (Singleton)
 * Web Speech API wrapper with robust language matching, phonetic processing,
 * chunking for Chrome/WebKit stability, voice fallback, and event dispatching.
 */
(function(window) {
    'use strict';

    class ReadAloudServiceSingleton {
        constructor() {
            this.synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
            this.voices = [];
            this.voicesLoaded = false;
            this.isSpeaking = false;
            this.isPaused = false;
            this.currentQueue = [];
            this.currentChunkIndex = 0;
            this.activeUtterance = null;
            this.currentCallbacks = null;
            this.activeLocale = 'de-DE';
            this.activeVoice = null;
            this.speed = 1.0;

            this.BCP47_MAP = {
                de: 'de-DE',
                en: 'en-US',
                es: 'es-ES',
                fr: 'fr-FR',
                pt: 'pt-BR',
                tr: 'tr-TR'
            };

            this.init();
        }

        init() {
            try {
                const savedSpeed = localStorage.getItem('gp_tts_speed');
                if (savedSpeed) this.speed = parseFloat(savedSpeed) || 1.0;
            } catch (e) {}

            if (this.synth) {
                this.loadVoices();
                if (typeof this.synth.addEventListener === 'function') {
                    this.synth.addEventListener('voiceschanged', () => this.loadVoices());
                } else {
                    this.synth.onvoiceschanged = () => this.loadVoices();
                }
            }
        }

        loadVoices() {
            if (!this.synth) return [];
            try {
                this.voices = this.synth.getVoices() || [];
                if (this.voices.length > 0) {
                    this.voicesLoaded = true;
                }
            } catch (e) {
                this.voices = [];
            }
            return this.voices;
        }

        async ensureVoices() {
            if (!this.synth) return [];
            if (this.voicesLoaded && this.voices.length > 0) return this.voices;
            
            const existing = this.loadVoices();
            if (existing.length > 0) return existing;

            return new Promise((resolve) => {
                let done = false;
                const handler = () => {
                    if (done) return;
                    done = true;
                    resolve(this.loadVoices());
                };

                if (typeof this.synth.addEventListener === 'function') {
                    this.synth.addEventListener('voiceschanged', handler, { once: true });
                } else {
                    this.synth.onvoiceschanged = handler;
                }

                setTimeout(() => {
                    if (!done) {
                        done = true;
                        resolve(this.loadVoices());
                    }
                }, 1000);
            });
        }

        getBcp47(langCode) {
            const key = (langCode || 'de').toLowerCase().slice(0, 2);
            return this.BCP47_MAP[key] || 'de-DE';
        }

        getBestVoice(bcp47Locale) {
            if (!this.voices || this.voices.length === 0) {
                this.loadVoices();
            }
            const targetLocale = (bcp47Locale || 'de-DE').toLowerCase();
            const langPrefix = targetLocale.split('-')[0];

            let matched = this.voices.find(v => v.lang && v.lang.toLowerCase().replace('_', '-') === targetLocale);
            if (matched) return matched;

            matched = this.voices.find(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix) && (v.localService || v.default));
            if (matched) return matched;

            matched = this.voices.find(v => v.lang && v.lang.toLowerCase().startsWith(langPrefix));
            if (matched) return matched;

            matched = this.voices.find(v => v.default);
            return matched || this.voices[0] || null;
        }

        cleanText(input) {
            if (!input) return '';
            let text = input;
            if (typeof input === 'object' && input !== null && input.nodeType) {
                const clone = input.cloneNode(true);
                const scripts = clone.querySelectorAll('script, style, noscript, svg, button');
                scripts.forEach(s => s.remove());
                text = clone.innerText || clone.textContent || '';
            } else if (typeof input === 'string') {
                if (/<[a-z][sS]*>/i.test(text)) {
                    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                               .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
                               .replace(/<[^>]+>/g, ' ');
                }
            }

            return text
                .replace(/\s+/g, ' ')
                .replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi, (email) => email.replace(/gamingpig/gi, 'gaming-pigg'))
                .replace(/gaming[\s\-_]*pigs?\b/gi, 'Gaming Pigg')
                .replace(/gaming[\s\-_]*pig/gi, 'Gaming Pigg')
                .trim();
        }

        splitIntoChunks(text, maxLen = 180) {
            if (!text) return [];
            const sentences = text.match(/[^.!?\n]+[.!?\n]*/g) || [text];
            const chunks = [];
            for (const sentence of sentences) {
                const trimmed = sentence.trim();
                if (!trimmed) continue;
                if (trimmed.length <= maxLen) {
                    chunks.push(trimmed);
                    continue;
                }
                let rest = trimmed;
                while (rest.length > maxLen) {
                    let cut = rest.lastIndexOf(' ', maxLen);
                    if (cut <= 0) cut = maxLen;
                    const part = rest.slice(0, cut).trim();
                    if (part) chunks.push(part);
                    rest = rest.slice(cut).trim();
                }
                if (rest) chunks.push(rest);
            }
            return chunks;
        }

        setSpeed(speed) {
            this.speed = parseFloat(speed) || 1.0;
            try {
                localStorage.setItem('gp_tts_speed', this.speed.toString());
            } catch (e) {}
            window.dispatchEvent(new CustomEvent('tts:speedChange', { detail: { speed: this.speed } }));
        }

        getSpeed() {
            return this.speed;
        }

        isPlaying() {
            return this.isSpeaking;
        }

        stop() {
            this.isSpeaking = false;
            this.isPaused = false;
            this.currentQueue = [];
            this.currentChunkIndex = 0;
            if (this.activeUtterance) {
                this.activeUtterance.onend = null;
                this.activeUtterance.onerror = null;
                this.activeUtterance = null;
            }
            if (this.synth) {
                this.synth.cancel();
            }
            if (this.currentCallbacks && typeof this.currentCallbacks.onEnd === 'function') {
                this.currentCallbacks.onEnd();
            }
            this.currentCallbacks = null;
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('tts:stateChange', { detail: { state: 'idle' } }));
            }
        }

        pause() {
            if (this.synth && this.isSpeaking && !this.isPaused) {
                this.synth.pause();
                this.isPaused = true;
                window.dispatchEvent(new CustomEvent('tts:stateChange', { detail: { state: 'paused' } }));
            }
        }

        resume() {
            if (this.synth && this.isSpeaking && this.isPaused) {
                this.synth.resume();
                this.isPaused = false;
                window.dispatchEvent(new CustomEvent('tts:stateChange', { detail: { state: 'speaking' } }));
            }
        }

        async speak(content, langCode = 'de', callbacks = {}) {
            if (!this.synth) {
                console.warn('[ReadAloudService] SpeechSynthesis not supported in this environment.');
                if (callbacks.onError) callbacks.onError(new Error('SpeechSynthesis not supported'));
                return;
            }

            this.stop();
            await this.ensureVoices();

            const cleaned = this.cleanText(content);
            if (!cleaned) {
                if (callbacks.onEnd) callbacks.onEnd();
                return;
            }

            const bcp47 = this.getBcp47(langCode);
            this.activeLocale = bcp47;
            this.activeVoice = this.getBestVoice(bcp47);
            this.currentQueue = this.splitIntoChunks(cleaned);
            this.currentChunkIndex = 0;
            this.currentCallbacks = callbacks;
            this.isSpeaking = true;
            this.isPaused = false;

            window.dispatchEvent(new CustomEvent('tts:stateChange', {
                detail: { state: 'speaking', locale: bcp47, queueLength: this.currentQueue.length }
            }));

            if (callbacks.onStart) {
                callbacks.onStart({ locale: bcp47, chunksCount: this.currentQueue.length });
            }

            this._playNextChunk();
        }

        _playNextChunk() {
            if (!this.isSpeaking) return;

            if (this.currentChunkIndex >= this.currentQueue.length) {
                const cb = this.currentCallbacks;
                this.stop();
                if (cb && typeof cb.onEnd === 'function') cb.onEnd();
                return;
            }

            const chunk = this.currentQueue[this.currentChunkIndex];
            this.currentChunkIndex++;

            const utterance = new SpeechSynthesisUtterance(chunk);
            utterance.lang = this.activeLocale;
            if (this.activeVoice) utterance.voice = this.activeVoice;
            utterance.rate = this.speed;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            this.activeUtterance = utterance;

            utterance.onend = () => {
                if (!this.isSpeaking) return;
                if (this.activeUtterance === utterance) this.activeUtterance = null;
                if (this.currentCallbacks && typeof this.currentCallbacks.onChunk === 'function') {
                    this.currentCallbacks.onChunk(this.currentChunkIndex, this.currentQueue.length);
                }
                this._playNextChunk();
            };

            utterance.onerror = (err) => {
                if (!this.isSpeaking) return;
                if (err.error === 'interrupted' || err.error === 'canceled') return;
                console.warn('[ReadAloudService] Chunk playback error:', err);
                if (this.activeUtterance === utterance) this.activeUtterance = null;
                this._playNextChunk();
            };

            if (this.synth.paused) {
                this.synth.resume();
            }
            this.synth.speak(utterance);
        }
    }

    window.ReadAloudService = new ReadAloudServiceSingleton();
})(typeof window !== 'undefined' ? window : globalThis);
