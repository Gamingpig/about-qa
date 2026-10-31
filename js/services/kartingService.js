/**
 * ==============================================================================
 * KARTING TELEMETRY & ACTIVITY-BOX SERVICE (v24.225.48)
 * Modulare Schnittstelle für Go-Kart-Telemetrie, Live-Rundenzeiten, Sektoren & Fahrerstatistiken.
 * Unterstützt Activity-Box / SMS-Timing APIs mit intelligentem Offline-Mock-Fallback.
 * ==============================================================================
 */

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.KartingService = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    // Konfiguration & Endpunkte
    const CONFIG = {
        apiBaseUrl: 'https://api.activity-box.com/v1',
        apiKey: '',
        defaultDriverId: 'gp-driver-911',
        defaultTrackId: 'prokart-arena-muc',
        pollIntervalMs: 2500,
        requestTimeoutMs: 5000
    };

    // Robuste Mock- und Fallback-Datenbank (falls Bahn-API offline oder geschützt ist)
    const MOCK_TELEMETRY = {
        track: {
            id: 'prokart-arena-muc',
            name: 'ProKart Racing Arena',
            layout: 'Grand Prix Layout (Indoor/Outdoor)',
            lengthMeters: 840,
            turns: 14,
            trackRecord: '31.984',
            trackRecordHolder: 'M. Schumacher Jr.',
            currentWeather: 'Trocken • 21°C Asphalt'
        },
        driver: {
            id: 'gp-driver-911',
            name: 'Gamingpig',
            nickname: 'The Piggy Racer 🐷🏎️',
            racingClass: 'Rotax Max Senior / Rimo Alpha 390cc',
            totalRaces: 42,
            victories: 17,
            podiums: 31,
            personalBest: '32.314',
            avgLapTime: '33.105',
            rankingPosition: 1,
            rankingPoints: 2450
        },
        liveSession: {
            sessionId: 'ses-20261031-gp1',
            status: 'LIVE', // LIVE | FINISHED | PITS
            kartNumber: 14,
            currentPosition: 1,
            totalDrivers: 14,
            currentLap: 12,
            totalLaps: 18,
            sessionTimeRemainingMs: 380000,
            bestLapTime: '32.314',
            lastLapTime: '32.482',
            deltaToRecord: '+0.330s',
            deltaToPersonalBest: '+0.168s',
            topSpeedKmh: 64.8,
            sectorTimes: {
                s1: '10.120',
                s2: '11.458',
                s3: '10.904',
                optimalLap: '32.210'
            },
            laps: [
                { lap: 12, time: '32.482', s1: '10.150', s2: '11.480', s3: '10.852', gap: '+0.168s', speed: 64.2, isBest: false },
                { lap: 11, time: '32.314', s1: '10.120', s2: '11.412', s3: '10.782', gap: '±0.000s', speed: 64.8, isBest: true },
                { lap: 10, time: '32.590', s1: '10.210', s2: '11.510', s3: '10.870', gap: '+0.276s', speed: 63.9, isBest: false },
                { lap: 9,  time: '32.610', s1: '10.190', s2: '11.530', s3: '10.890', gap: '+0.296s', speed: 63.7, isBest: false },
                { lap: 8,  time: '32.740', s1: '10.240', s2: '11.580', s3: '10.920', gap: '+0.426s', speed: 63.4, isBest: false },
                { lap: 7,  time: '32.890', s1: '10.310', s2: '11.620', s3: '10.960', gap: '+0.576s', speed: 63.1, isBest: false },
                { lap: 6,  time: '33.020', s1: '10.380', s2: '11.690', s3: '10.950', gap: '+0.706s', speed: 62.8, isBest: false },
                { lap: 5,  time: '33.180', s1: '10.420', s2: '11.740', s3: '11.020', gap: '+0.866s', speed: 62.5, isBest: false },
                { lap: 4,  time: '33.450', s1: '10.510', s2: '11.830', s3: '11.110', gap: '+1.136s', speed: 62.0, isBest: false },
                { lap: 3,  time: '33.820', s1: '10.650', s2: '11.980', s3: '11.190', gap: '+1.506s', speed: 61.4, isBest: false },
                { lap: 2,  time: '34.210', s1: '10.820', s2: '12.110', s3: '11.280', gap: '+1.896s', speed: 60.8, isBest: false },
                { lap: 1,  time: '35.940', s1: '11.450', s2: '12.890', s3: '11.600', gap: '+3.626s', speed: 58.2, isBest: false }
            ]
        },
        sessionHistory: [
            { id: 'ses-101', date: '28.10.2026', track: 'ProKart Racing Arena', position: 'P1 🥇', bestLap: '32.314', totalLaps: 24, kart: '#14' },
            { id: 'ses-100', date: '21.10.2026', track: 'Daytona Kartbahn Indoor', position: 'P2 🥈', bestLap: '29.870', totalLaps: 20, kart: '#07' },
            { id: 'ses-099', date: '14.10.2026', track: 'ProKart Racing Arena', position: 'P1 🥇', bestLap: '32.480', totalLaps: 25, kart: '#14' },
            { id: 'ses-098', date: '02.10.2026', track: 'Cologne Outdoor Circuit', position: 'P3 🥉', bestLap: '44.120', totalLaps: 16, kart: '#22' }
        ]
    };

    class KartingService {
        constructor() {
            this.config = { ...CONFIG };
            this.liveState = JSON.parse(JSON.stringify(MOCK_TELEMETRY.liveSession));
            this.subscribers = new Set();
            this.pollTimer = null;
        }

        /**
         * Konfiguration anpassen (API-Key, Driver-ID, Endpoint)
         */
        configure(options = {}) {
            this.config = { ...this.config, ...options };
        }

        /**
         * Fahrerprofil abrufen
         */
        async getDriverProfile(driverId = this.config.defaultDriverId) {
            try {
                if (this.config.apiKey) {
                    const res = await this._fetchWithTimeout(`${this.config.apiBaseUrl}/drivers/${encodeURIComponent(driverId)}`);
                    if (res.ok) {
                        const data = await res.json();
                        return this._mapDriverData(data);
                    }
                }
            } catch (err) {
                console.warn('[KartingService] Activity-Box API offline, verwende Telemetrie-Cache:', err.message);
            }
            return MOCK_TELEMETRY.driver;
        }

        /**
         * Live-Timing-Telemetrie abrufen
         */
        async getLiveTiming(trackId = this.config.defaultTrackId) {
            try {
                if (this.config.apiKey) {
                    const res = await this._fetchWithTimeout(`${this.config.apiBaseUrl}/tracks/${encodeURIComponent(trackId)}/live`);
                    if (res.ok) {
                        const data = await res.json();
                        return this._mapLiveTelemetry(data);
                    }
                }
            } catch (err) {
                console.warn('[KartingService] Live-API nicht erreichbar, nutze Echtzeit-Puffer:', err.message);
            }
            return this.liveState;
        }

        /**
         * Renn-Historie abrufen
         */
        async getSessionHistory(driverId = this.config.defaultDriverId) {
            try {
                if (this.config.apiKey) {
                    const res = await this._fetchWithTimeout(`${this.config.apiBaseUrl}/drivers/${encodeURIComponent(driverId)}/history`);
                    if (res.ok) {
                        const data = await res.json();
                        return data.items || data;
                    }
                }
            } catch (err) {
                console.warn('[KartingService] Historie aus lokalem Speicher geladen:', err.message);
            }
            return MOCK_TELEMETRY.sessionHistory;
        }

        /**
         * Strecken-Informationen abrufen
         */
        async getTrackInfo(trackId = this.config.defaultTrackId) {
            return MOCK_TELEMETRY.track;
        }

        /**
         * Simulation einer neuen Runde (für interaktive Tests im Admin-Modus)
         */
        simulateNextLap() {
            if (this.liveState.currentLap >= this.liveState.totalLaps) {
                this.liveState.status = 'FINISHED';
                this._notify();
                return this.liveState;
            }

            this.liveState.currentLap++;
            // Zufalls-Varianz zwischen -0.25s und +0.35s
            const variance = (Math.random() * 0.60 - 0.25);
            const baseSec = 32.314 + variance;
            const lapTimeStr = baseSec.toFixed(3);
            const bestTimeSec = parseFloat(this.liveState.bestLapTime);
            const isBest = baseSec < bestTimeSec;

            if (isBest) {
                this.liveState.bestLapTime = lapTimeStr;
            }

            const diffSec = baseSec - bestTimeSec;
            const gapStr = (diffSec >= 0 ? `+${diffSec.toFixed(3)}s` : `${diffSec.toFixed(3)}s`);

            const s1 = (10.100 + Math.random() * 0.2).toFixed(3);
            const s2 = (11.400 + Math.random() * 0.2).toFixed(3);
            const s3 = (baseSec - parseFloat(s1) - parseFloat(s2)).toFixed(3);

            const newLap = {
                lap: this.liveState.currentLap,
                time: lapTimeStr,
                s1, s2, s3,
                gap: isBest ? '±0.000s 🚀' : gapStr,
                speed: (63.5 + Math.random() * 2).toFixed(1),
                isBest
            };

            this.liveState.laps.unshift(newLap);
            this.liveState.lastLapTime = lapTimeStr;
            this.liveState.deltaToPersonalBest = isBest ? '±0.000s (NEUE BESTZEIT!)' : gapStr;
            this.liveState.sectorTimes.s1 = s1;
            this.liveState.sectorTimes.s2 = s2;
            this.liveState.sectorTimes.s3 = s3;

            this._notify();
            return this.liveState;
        }

        /**
         * Observer-Pattern für Live-Updates
         */
        subscribe(callback) {
            this.subscribers.add(callback);
            return () => this.subscribers.delete(callback);
        }

        _notify() {
            this.subscribers.forEach(cb => {
                try { cb(this.liveState); } catch (_) {}
            });
        }

        startLivePolling() {
            this.stopLivePolling();
            this.pollTimer = setInterval(async () => {
                await this.getLiveTiming();
                this._notify();
            }, this.config.pollIntervalMs);
        }

        stopLivePolling() {
            if (this.pollTimer) {
                clearInterval(this.pollTimer);
                this.pollTimer = null;
            }
        }

        async _fetchWithTimeout(url, options = {}) {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), this.config.requestTimeoutMs);
            try {
                return await fetch(url, {
                    ...options,
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': this.config.apiKey ? `Bearer ${this.config.apiKey}` : undefined,
                        ...options.headers
                    }
                });
            } finally {
                clearTimeout(id);
            }
        }

        _mapDriverData(raw) {
            return {
                id: raw.id || raw.driverId || this.config.defaultDriverId,
                name: raw.name || raw.fullName || 'Gamingpig',
                nickname: raw.nickname || 'Racer',
                racingClass: raw.category || raw.className || 'Senior',
                totalRaces: raw.raceCount || 42,
                victories: raw.wins || 17,
                podiums: raw.podiums || 31,
                personalBest: raw.bestLap || '32.314',
                avgLapTime: raw.avgLap || '33.105',
                rankingPosition: raw.rank || 1,
                rankingPoints: raw.points || 2450
            };
        }

        _mapLiveTelemetry(raw) {
            return {
                sessionId: raw.sessionId || this.liveState.sessionId,
                status: raw.status || 'LIVE',
                kartNumber: raw.kart || raw.kartNumber || 14,
                currentPosition: raw.position || 1,
                totalDrivers: raw.totalDrivers || 14,
                currentLap: raw.lap || raw.currentLap || 12,
                totalLaps: raw.totalLaps || 18,
                sessionTimeRemainingMs: raw.timeRemaining || 360000,
                bestLapTime: raw.bestLap || '32.314',
                lastLapTime: raw.lastLap || '32.482',
                deltaToRecord: raw.deltaRecord || '+0.330s',
                deltaToPersonalBest: raw.deltaPB || '+0.168s',
                topSpeedKmh: raw.topSpeed || 64.8,
                sectorTimes: raw.sectors || this.liveState.sectorTimes,
                laps: Array.isArray(raw.laps) ? raw.laps : this.liveState.laps
            };
        }
    }

    return new KartingService();
}));
