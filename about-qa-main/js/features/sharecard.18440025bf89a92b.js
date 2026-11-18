/* Canvas renderer: loaded on first export. Drawing algorithms unchanged. */
window.installShareCardFeature = function ({ t, escapeHTML, haptic, showToast, pushOverlayHistory, popOverlayHistory }) {
window.generateShareCard = function() {
            const titleEl = document.getElementById('track-title');
            const artistEl = document.getElementById('track-artist');
            const artworkEl = document.getElementById('artwork');
            const title = (titleEl && titleEl.innerText) ? titleEl.innerText : t('standby_idle_title');
            const artist = (artistEl && artistEl.innerText) ? artistEl.innerText : t('standby_idle_subtitle');
            const artSrc = artworkEl ? artworkEl.getAttribute('src') : null;

            if (typeof showToast === 'function') showToast(t('toast_sharecard_creating'));

            const proceed = (artImg) => openSharecardPicker(artImg, title, artist);

            if (artSrc && !artSrc.startsWith('data:')) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => proceed(img);
                img.onerror = () => proceed(null);
                img.src = artSrc;
            } else {
                proceed(null);
            }
        };

        // NEW v24.20: Schnellexport - lädt direkt das Classic-Design herunter, ohne das
        // Auswahlmenü zu öffnen. Nutzt exakt dieselbe, bereits bewährte Bild-Lade- und
        // Zeichenlogik wie generateShareCard()/downloadSharecardDesign() - kein neuer,
        // ungetesteter Code-Pfad, nur ein direkterer Einstiegspunkt.
        window.quickExportSongCard = function() {
            const titleEl = document.getElementById('track-title');
            const artistEl = document.getElementById('track-artist');
            const artworkEl = document.getElementById('artwork');
            const title = (titleEl && titleEl.innerText) ? titleEl.innerText : t('standby_idle_title');
            const artist = (artistEl && artistEl.innerText) ? artistEl.innerText : t('standby_idle_subtitle');
            const artSrc = artworkEl ? artworkEl.getAttribute('src') : null;

            if (typeof showToast === 'function') showToast(t('toast_sharecard_creating'));

            let proceeded = false;
            const proceed = (artImg) => {
                if (proceeded) return;
                proceeded = true;
                downloadSharecardDesign(SHARECARD_DESIGNS[0], artImg, title, artist);
            };

            if (artSrc && !artSrc.startsWith('data:')) {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                // Timeout-Sicherung: Sollte das Covernetzwerk hängen, exportiere nach 1200ms zuverlässig
                const timer = setTimeout(() => proceed(null), 1200);
                img.onload = () => { clearTimeout(timer); proceed(img); };
                img.onerror = () => { clearTimeout(timer); proceed(null); };
                img.src = artSrc;
            } else {
                proceed(null);
            }
        };

        // NEW: Vierzehn Share-Card-Designs zur Auswahl.
        const SHARECARD_DESIGNS = [
            { id: 'classic', label: 'Classic', draw: drawShareCardClassic },
            { id: 'minimal', label: 'Minimal', draw: drawShareCardMinimal },
            { id: 'poster', label: 'Poster', draw: drawShareCardPoster },
            { id: 'vinyl', label: 'Vinyl', draw: drawShareCardVinyl },
            { id: 'neon', label: 'Neon', draw: drawShareCardNeon },
            { id: 'polaroid', label: 'Polaroid', draw: drawShareCardPolaroid },
            { id: 'terminal', label: 'Terminal', draw: drawShareCardTerminal },
            { id: 'cassette', label: 'Cassette', draw: drawShareCardCassette },
            { id: 'wave', label: 'Wave', draw: drawShareCardWave },
            { id: 'sticker', label: 'Sticker', draw: drawShareCardSticker },
            { id: 'hologram', label: 'Hologram', draw: drawShareCardHologram },
            { id: 'studio', label: 'Studio', draw: drawShareCardStudio },
            { id: 'ambient-orb', label: 'Ambient Orb', draw: drawShareCardOrb },
            { id: 'cyberpunk', label: 'Cyberpunk', draw: drawShareCardCyberpunk }
        ];

        function openSharecardPicker(artImg, title, artist) {
            const overlay = document.getElementById('sharecard-picker-overlay');
            const grid = document.getElementById('sharecard-picker-grid');
            if (!overlay || !grid) return;
            const liveTrackLabel = document.getElementById('sharecard-live-current-track');
            if (liveTrackLabel) liveTrackLabel.textContent = title + (artist ? ' – ' + artist : '');

            grid.innerHTML = SHARECARD_DESIGNS.map((d, i) => `
                <div class="sc-option" data-design="${i}">
                    <canvas width="240" height="320"></canvas>
                    <span class="sc-label">${escapeHTML(d.label)}</span>
                </div>`).join('');

            SHARECARD_DESIGNS.forEach((d, i) => {
                const cell = grid.children[i];
                const canvas = cell.querySelector('canvas');
                const ctx = canvas.getContext('2d');
                try { d.draw(ctx, 240, 320, artImg, title, artist); } catch (e) {}
                cell.addEventListener('click', () => downloadSharecardDesign(d, artImg, title, artist));
            });

            overlay.classList.add('sc-active');
            pushOverlayHistory();
        }

        window.closeSharecardPicker = function() {
            const overlay = document.getElementById('sharecard-picker-overlay');
            if (overlay && overlay.classList.contains('sc-active')) popOverlayHistory();
            if (overlay) overlay.classList.remove('sc-active');
        };

        function downloadSharecardDesign(design, artImg, title, artist) {
            try {
                if (typeof haptic === 'function') haptic(10);
                const W = 720, H = 960;
                const canvas = document.createElement('canvas');
                canvas.width = W; canvas.height = H;
                const ctx = canvas.getContext('2d');
                
                try {
                    design.draw(ctx, W, H, artImg, title, artist);
                    // CORS-Test: Verhindert stillschweigende SecurityErrors beim Export
                    canvas.toDataURL('image/png');
                } catch (taintErr) {
                    ctx.clearRect(0, 0, W, H);
                    design.draw(ctx, W, H, null, title, artist);
                    if (typeof showToast === 'function') showToast(t('toast_sharecard_cors'));
                }

                const filename = 'now-playing-gamingpig-' + design.id + '.png';

                const finishExport = (saved = true) => {
                    closeSharecardPicker();
                    if (saved && typeof showToast === 'function') {
                        showToast(t('toast_sharecard_saved') || 'Share Card gespeichert! 🎴');
                    }
                };

                const fallbackDownload = (blob) => {
                    if (blob && typeof URL !== 'undefined' && URL.createObjectURL) {
                        const blobUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = blobUrl;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        setTimeout(() => {
                            a.remove();
                            URL.revokeObjectURL(blobUrl);
                        }, 3000);
                        finishExport(true);
                    } else {
                        const dataUrl = canvas.toDataURL('image/png');
                        const a = document.createElement('a');
                        a.href = dataUrl;
                        a.download = filename;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        finishExport(true);
                    }
                };

                // Web Share API mit File-Support: Auf Android/Pixel direkt in Google Fotos oder Speicher ablegen
                if (canvas.toBlob) {
                    canvas.toBlob(async (blob) => {
                        if (!blob) {
                            fallbackDownload(null);
                            return;
                        }

                        if (typeof navigator !== 'undefined' && navigator.canShare && typeof File !== 'undefined') {
                            try {
                                const file = new File([blob], filename, { type: 'image/png' });
                                if (navigator.canShare({ files: [file] })) {
                                    await navigator.share({
                                        files: [file],
                                        title: 'Gamingpig Now Playing',
                                        text: `${title} - ${artist}`
                                    });
                                    finishExport(true);
                                    return;
                                }
                            } catch (shareErr) {
                                if (shareErr && shareErr.name === 'AbortError') {
                                    closeSharecardPicker();
                                    return;
                                }
                            }
                        }

                        fallbackDownload(blob);
                    }, 'image/png');
                } else {
                    fallbackDownload(null);
                }
            } catch (err) {
                if (typeof showToast === 'function') showToast(t('toast_sharecard_cors'));
            }
        }

        // --- Hilfsfunktion: zeichnet ein Bild "object-fit: cover" in ein Zielrechteck ---
        function drawImageCover(ctx, img, x, y, w, h) {
            if (!img) return;
            const imgRatio = img.width / img.height;
            const boxRatio = w / h;
            let sx, sy, sw, sh;
            if (imgRatio > boxRatio) {
                sh = img.height; sw = sh * boxRatio;
                sx = (img.width - sw) / 2; sy = 0;
            } else {
                sw = img.width; sh = sw / boxRatio;
                sx = 0; sy = (img.height - sh) / 2;
            }
            ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
        }

        // --- Design 1: Classic - geblurtes Cover als Hintergrund, Karte zentriert ---
        function drawShareCardClassic(ctx, W, H, artImg, title, artist) {
            const s = W / 720; // Skalierungsfaktor relativ zur Vollauflösung (für Vorschau-Canvas)
            ctx.fillStyle = '#05060a';
            ctx.fillRect(0, 0, W, H);
            if (artImg) {
                try {
                    ctx.filter = `blur(${38 * s}px) brightness(0.45) saturate(150%)`;
                    ctx.drawImage(artImg, -60 * s, -60 * s, W + 120 * s, H + 120 * s);
                    ctx.filter = 'none';
                } catch (e) {}
            }
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, 'rgba(0,0,0,0.15)');
            grad.addColorStop(1, 'rgba(0,0,0,0.55)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            const artSize = 460 * s;
            const artX = (W - artSize) / 2;
            const artY = 170 * s;
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 60 * s;
            ctx.shadowOffsetY = 20 * s;
            roundRectPath(ctx, artX, artY, artSize, artSize, 28 * s);
            ctx.fillStyle = '#111';
            ctx.fill();
            ctx.restore();
            ctx.save();
            roundRectPath(ctx, artX, artY, artSize, artSize, 28 * s);
            ctx.clip();
            if (artImg) drawImageCover(ctx, artImg, artX, artY, artSize, artSize);
            ctx.restore();

            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.font = `800 ${40 * s}px Inter, sans-serif`;
            wrapText(ctx, title, W / 2, artY + artSize + 70 * s, W - 100 * s, 46 * s);
            ctx.fillStyle = 'rgba(255,255,255,0.65)';
            ctx.font = `600 ${26 * s}px Inter, sans-serif`;
            ctx.fillText(artist, W / 2, artY + artSize + 118 * s);

            const eqY = artY + artSize + 160 * s;
            const barW = 6 * s, gap = 6 * s, barsN = 5, heights = [18, 30, 14, 26, 20].map(v => v * s);
            const totalW = barsN * barW + (barsN - 1) * gap;
            let bx = (W - totalW) / 2;
            ctx.fillStyle = 'rgba(59,130,246,0.9)';
            heights.forEach(h => { ctx.fillRect(bx, eqY - h, barW, h); bx += barW + gap; });

            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = `700 ${18 * s}px Inter, sans-serif`;
            ctx.fillText('🐷 GAMINGPIG HÖRT GERADE', W / 2, H - 50 * s);
        }

        // --- Design 2: Minimal - flacher Hintergrund, kleineres Cover, große Typografie ---
        function drawShareCardMinimal(ctx, W, H, artImg, title, artist) {
            const s = W / 720;
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, '#12141c');
            grad.addColorStop(1, '#05060a');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            const artSize = 190 * s;
            const artX = (W - artSize) / 2;
            const artY = 90 * s;
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 30 * s;
            ctx.shadowOffsetY = 12 * s;
            roundRectPath(ctx, artX, artY, artSize, artSize, 22 * s);
            ctx.fillStyle = '#111';
            ctx.fill();
            ctx.restore();
            ctx.save();
            roundRectPath(ctx, artX, artY, artSize, artSize, 22 * s);
            ctx.clip();
            if (artImg) drawImageCover(ctx, artImg, artX, artY, artSize, artSize);
            ctx.restore();

            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.font = `800 ${52 * s}px Inter, sans-serif`;
            wrapText(ctx, title, W / 2, artY + artSize + 130 * s, W - 70 * s, 58 * s);

            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = `700 ${22 * s}px Inter, sans-serif`;
            ctx.save();
            ctx.translate(W / 2, artY + artSize + 230 * s);
            const spaced = artist.toUpperCase().split('').join(String.fromCharCode(8202) + ' ');
            ctx.fillText(spaced, 0, 0);
            ctx.restore();

            ctx.strokeStyle = 'rgba(255,255,255,0.15)';
            ctx.lineWidth = 1 * s;
            ctx.beginPath();
            ctx.moveTo(W / 2 - 40 * s, H - 110 * s);
            ctx.lineTo(W / 2 + 40 * s, H - 110 * s);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.font = `700 ${15 * s}px Inter, sans-serif`;
            ctx.fillText('🐷 GAMINGPIG HÖRT GERADE', W / 2, H - 60 * s);
        }

        // --- Design 3: Poster - Cover als Vollflächen-Hintergrund, Text unten links ---
        function drawShareCardPoster(ctx, W, H, artImg, title, artist) {
            const s = W / 720;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, W, H);
            if (artImg) drawImageCover(ctx, artImg, 0, 0, W, H);

            const grad = ctx.createLinearGradient(0, H * 0.35, 0, H);
            grad.addColorStop(0, 'rgba(0,0,0,0)');
            grad.addColorStop(1, 'rgba(0,0,0,0.92)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffff';
            ctx.font = `800 ${46 * s}px Inter, sans-serif`;
            const titleY = H - 140 * s;
            wrapTextLeft(ctx, title, 44 * s, titleY, W - 90 * s, 52 * s);

            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.font = `600 ${26 * s}px Inter, sans-serif`;
            ctx.fillText(artist, 44 * s, H - 60 * s);

            ctx.textAlign = 'right';
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.font = `700 ${14 * s}px Inter, sans-serif`;
            ctx.fillText('🐷 GAMINGPIG HÖRT GERADE', W - 30 * s, 40 * s);
        }

        // --- Design 4: Vinyl - Retro-Look, Cover als Schallplatte ---
        function drawShareCardVinyl(ctx, W, H, artImg, title, artist) {
            const s = W / 720;
            const grad = ctx.createRadialGradient(W / 2, H * 0.4, 10, W / 2, H * 0.4, H * 0.8);
            grad.addColorStop(0, '#3a2a1c');
            grad.addColorStop(1, '#100a06');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            const cx = W / 2, cy = 350 * s, r = 210 * s;
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 50 * s;
            ctx.shadowOffsetY = 20 * s;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fillStyle = '#0a0a0a';
            ctx.fill();
            ctx.restore();

            // Rillen-Ringe
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            for (let i = 1; i <= 6; i++) {
                ctx.lineWidth = 1 * s;
                ctx.beginPath();
                ctx.arc(cx, cy, r - i * (18 * s), 0, Math.PI * 2);
                ctx.stroke();
            }

            // Cover-Label in der Mitte
            const labelR = r * 0.52;
            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, labelR, 0, Math.PI * 2);
            ctx.clip();
            if (artImg) drawImageCover(ctx, artImg, cx - labelR, cy - labelR, labelR * 2, labelR * 2);
            else { ctx.fillStyle = '#3b2a1c'; ctx.fill(); }
            ctx.restore();

            // Mittelloch
            ctx.beginPath();
            ctx.arc(cx, cy, 7 * s, 0, Math.PI * 2);
            ctx.fillStyle = '#100a06';
            ctx.fill();

            ctx.textAlign = 'center';
            ctx.fillStyle = '#f3e7d3';
            ctx.font = `800 ${38 * s}px 'JetBrains Mono', monospace`;
            wrapText(ctx, title, W / 2, cy + r + 90 * s, W - 90 * s, 44 * s);

            ctx.fillStyle = 'rgba(243,231,211,0.7)';
            ctx.font = `600 ${22 * s}px 'JetBrains Mono', monospace`;
            ctx.fillText(artist, W / 2, cy + r + 150 * s);

            ctx.fillStyle = 'rgba(243,231,211,0.4)';
            ctx.font = `700 ${15 * s}px 'JetBrains Mono', monospace`;
            ctx.fillText('◈ GAMINGPIG HÖRT GERADE ◈', W / 2, H - 50 * s);
        }

        // --- Design 5: Neon - Cyberpunk-Look mit Raster-Linien und Leucht-Rahmen ---
        function drawShareCardNeon(ctx, W, H, artImg, title, artist) {
            const s = W / 720;
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, '#0d0221');
            grad.addColorStop(1, '#1a0533');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            // Perspektivisches Raster im unteren Bereich (klassischer Retro-Wave-Look)
            ctx.save();
            ctx.strokeStyle = 'rgba(236, 72, 153, 0.35)';
            ctx.lineWidth = 1 * s;
            const gridTop = H * 0.62;
            for (let i = 0; i <= 10; i++) {
                const x = (W / 10) * i;
                ctx.beginPath();
                ctx.moveTo(W / 2 + (x - W / 2) * 0.15, gridTop);
                ctx.lineTo(x, H);
                ctx.stroke();
            }
            for (let i = 0; i <= 6; i++) {
                const y = gridTop + (H - gridTop) * (i / 6) * (i / 6);
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(W, y);
                ctx.stroke();
            }
            ctx.restore();

            const artSize = 380 * s;
            const artX = (W - artSize) / 2;
            const artY = 110 * s;
            ctx.save();
            ctx.shadowColor = 'rgba(236, 72, 153, 0.8)';
            ctx.shadowBlur = 40 * s;
            roundRectPath(ctx, artX, artY, artSize, artSize, 18 * s);
            ctx.strokeStyle = '#ec4899';
            ctx.lineWidth = 3 * s;
            ctx.stroke();
            ctx.restore();
            ctx.save();
            roundRectPath(ctx, artX, artY, artSize, artSize, 18 * s);
            ctx.clip();
            if (artImg) drawImageCover(ctx, artImg, artX, artY, artSize, artSize);
            else { ctx.fillStyle = '#1a0533'; ctx.fill(); }
            ctx.restore();

            ctx.textAlign = 'center';
            ctx.save();
            ctx.shadowColor = 'rgba(34, 211, 238, 0.9)';
            ctx.shadowBlur = 20 * s;
            ctx.fillStyle = '#22d3ee';
            ctx.font = `800 ${36 * s}px Inter, sans-serif`;
            wrapText(ctx, title.toUpperCase(), W / 2, artY + artSize + 66 * s, W - 80 * s, 42 * s);
            ctx.restore();

            ctx.fillStyle = 'rgba(236, 72, 153, 0.85)';
            ctx.font = `700 ${22 * s}px Inter, sans-serif`;
            ctx.fillText(artist, W / 2, artY + artSize + 116 * s);

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = `700 ${14 * s}px 'JetBrains Mono', monospace`;
            ctx.fillText('◢◤ GAMINGPIG HÖRT GERADE ◥◣', W / 2, H - 40 * s);
        }

        // --- Design 6: Polaroid - Sofortbild-Look mit weißem Rahmen und Handschrift-Bildunterschrift ---
        function drawShareCardPolaroid(ctx, W, H, artImg, title, artist) {
            const s = W / 720;
            ctx.fillStyle = '#e8e4da';
            ctx.fillRect(0, 0, W, H);

            const frameX = 55 * s, frameY = 70 * s, frameW = W - 110 * s;
            const photoSize = frameW;
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.35)';
            ctx.shadowBlur = 35 * s;
            ctx.shadowOffsetY = 18 * s;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(frameX, frameY, frameW, photoSize + 190 * s);
            ctx.restore();

            const padding = 22 * s;
            ctx.save();
            ctx.beginPath();
            ctx.rect(frameX + padding, frameY + padding, photoSize - padding * 2, photoSize - padding * 2);
            ctx.clip();
            if (artImg) drawImageCover(ctx, artImg, frameX + padding, frameY + padding, photoSize - padding * 2, photoSize - padding * 2);
            else { ctx.fillStyle = '#ccc'; ctx.fill(); }
            ctx.restore();

            // Handschrift-artige Bildunterschrift im unteren, weißen Polaroid-Streifen
            ctx.textAlign = 'center';
            ctx.fillStyle = '#2a2a2a';
            ctx.font = `italic 700 ${30 * s}px Georgia, serif`;
            wrapText(ctx, title, W / 2, frameY + photoSize + 55 * s, photoSize - 60 * s, 36 * s);

            ctx.fillStyle = '#6b6b6b';
            ctx.font = `italic 500 ${20 * s}px Georgia, serif`;
            ctx.fillText(artist, W / 2, frameY + photoSize + 108 * s);

            // Kleine handschriftliche Notiz am Rand, wie auf einem echten Polaroid
            ctx.save();
            ctx.translate(W / 2, frameY + photoSize + 150 * s);
            ctx.rotate(-0.03);
            ctx.fillStyle = '#9a8c78';
            ctx.font = `italic 600 ${16 * s}px Georgia, serif`;
            ctx.fillText('🐷 gamingpig hört gerade ~', 0, 0);
            ctx.restore();
        }

        // --- Design 7: Terminal - Retro-Hacker-/Konsolen-Look (passend zum IT-Thema) ---
        function drawShareCardTerminal(ctx, W, H, artImg, title, artist) {
            const s = W / 720;
            ctx.fillStyle = '#0a0e0a';
            ctx.fillRect(0, 0, W, H);

            // Terminal-Fenster-Rahmen
            const winX = 40 * s, winY = 50 * s, winW = W - 80 * s, winH = H - 100 * s;
            ctx.fillStyle = '#0d150d';
            roundRectPath(ctx, winX, winY, winW, winH, 14 * s);
            ctx.fill();
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.4)';
            ctx.lineWidth = 1.5 * s;
            ctx.stroke();

            // Titelleiste mit Ampel-Punkten
            ctx.fillStyle = 'rgba(74, 222, 128, 0.08)';
            roundRectPath(ctx, winX, winY, winW, 44 * s, 14 * s);
            ctx.fill();
            const dotColors = ['#ff5f56', '#ffbd2e', '#27c93f'];
            dotColors.forEach((c, i) => {
                ctx.beginPath();
                ctx.arc(winX + 26 * s + i * 22 * s, winY + 22 * s, 6 * s, 0, Math.PI * 2);
                ctx.fillStyle = c;
                ctx.fill();
            });
            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(74, 222, 128, 0.5)';
            ctx.font = `600 ${13 * s}px 'JetBrains Mono', monospace`;
            ctx.fillText('gamingpig@nowplaying: ~', W / 2, winY + 27 * s);

            // Cover als "eingebettetes" Bild mit grünem Rahmen
            const artSize = 340 * s;
            const artX = (W - artSize) / 2;
            const artY = winY + 74 * s;
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.6)';
            ctx.lineWidth = 2 * s;
            ctx.strokeRect(artX, artY, artSize, artSize);
            ctx.save();
            ctx.beginPath();
            ctx.rect(artX, artY, artSize, artSize);
            ctx.clip();
            if (artImg) { ctx.filter = 'grayscale(20%) contrast(1.05)'; drawImageCover(ctx, artImg, artX, artY, artSize, artSize); ctx.filter = 'none'; }
            else { ctx.fillStyle = '#0d150d'; ctx.fill(); }
            ctx.restore();

            // Terminal-artige Textzeilen
            ctx.textAlign = 'left';
            ctx.fillStyle = '#4ade80';
            ctx.font = `700 ${20 * s}px 'JetBrains Mono', monospace`;
            ctx.fillText('$ now_playing --title', artX, artY + artSize + 40 * s);
            ctx.fillStyle = '#e5e5e5';
            wrapTextLeft(ctx, `> ${title}`, artX, artY + artSize + 72 * s, artSize, 28 * s);
            ctx.fillStyle = 'rgba(74, 222, 128, 0.7)';
            ctx.font = `500 ${17 * s}px 'JetBrains Mono', monospace`;
            ctx.fillText(`> artist: ${artist}`, artX, artY + artSize + 128 * s);

            ctx.textAlign = 'center';
            ctx.fillStyle = 'rgba(74, 222, 128, 0.35)';
            ctx.font = `600 ${13 * s}px 'JetBrains Mono', monospace`;
            ctx.fillText('gamingpig hört gerade // process running _', W / 2, winY + winH - 20 * s);
        }

        // --- Design 8: Cassette - Retro-Kassette-Look ---
        function drawShareCardCassette(ctx, W, H, artImg, title, artist) {
            const s = W / 720;
            const bgGrad = ctx.createLinearGradient(0, 0, W, H);
            bgGrad.addColorStop(0, '#fef3c7');
            bgGrad.addColorStop(1, '#fde68a');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            const capX = 60 * s, capY = 260 * s, capW = W - 120 * s, capH = 340 * s;
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.25)';
            ctx.shadowBlur = 30 * s;
            ctx.shadowOffsetY = 15 * s;
            ctx.fillStyle = '#1c1917';
            roundRectPath(ctx, capX, capY, capW, capH, 20 * s);
            ctx.fill();
            ctx.restore();

            // Label-Fenster
            const labelX = capX + 30 * s, labelY = capY + 30 * s, labelW = capW - 60 * s, labelH = 130 * s;
            ctx.fillStyle = '#fefaf0';
            roundRectPath(ctx, labelX, labelY, labelW, labelH, 8 * s);
            ctx.fill();
            ctx.textAlign = 'center';
            ctx.fillStyle = '#1c1917';
            ctx.font = `800 ${26 * s}px 'JetBrains Mono', monospace`;
            wrapText(ctx, title, W / 2, labelY + 48 * s, labelW - 30 * s, 32 * s);
            ctx.fillStyle = '#78716c';
            ctx.font = `600 ${17 * s}px 'JetBrains Mono', monospace`;
            ctx.fillText(artist, W / 2, labelY + labelH - 20 * s);

            // Zwei Spulen
            const reelY = capY + labelH + 95 * s;
            [capX + capW * 0.28, capX + capW * 0.72].forEach(cx => {
                ctx.beginPath(); ctx.arc(cx, reelY, 55 * s, 0, Math.PI * 2);
                ctx.fillStyle = '#292524'; ctx.fill();
                ctx.beginPath(); ctx.arc(cx, reelY, 42 * s, 0, Math.PI * 2);
                ctx.strokeStyle = '#57534e'; ctx.lineWidth = 2 * s; ctx.stroke();
                for (let i = 0; i < 6; i++) {
                    const ang = (i / 6) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.moveTo(cx + Math.cos(ang) * 14 * s, reelY + Math.sin(ang) * 14 * s);
                    ctx.lineTo(cx + Math.cos(ang) * 36 * s, reelY + Math.sin(ang) * 36 * s);
                    ctx.strokeStyle = '#44403c'; ctx.lineWidth = 5 * s; ctx.stroke();
                }
                ctx.beginPath(); ctx.arc(cx, reelY, 10 * s, 0, Math.PI * 2);
                ctx.fillStyle = '#a8a29e'; ctx.fill();
            });

            // Kleines Cover-Thumbnail unten im Band-Fenster
            if (artImg) {
                const thumbSize = 46 * s;
                ctx.save();
                roundRectPath(ctx, W / 2 - thumbSize / 2, reelY + 60 * s, thumbSize, thumbSize, 6 * s);
                ctx.clip();
                drawImageCover(ctx, artImg, W / 2 - thumbSize / 2, reelY + 60 * s, thumbSize, thumbSize);
                ctx.restore();
            }

            ctx.fillStyle = 'rgba(28,25,23,0.55)';
            ctx.font = `700 ${16 * s}px 'JetBrains Mono', monospace`;
            ctx.fillText('◈ GAMINGPIG HÖRT GERADE ◈', W / 2, H - 55 * s);
        }

        // --- Design 9: Wave - Moderne, fließende Verlaufsformen mit großer Typografie ---
        function drawShareCardWave(ctx, W, H, artImg, title, artist) {
            const s = W / 720;
            const bgGrad = ctx.createLinearGradient(0, 0, W, H);
            bgGrad.addColorStop(0, '#1e1b4b');
            bgGrad.addColorStop(1, '#0f0a2e');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            // Fließende, unscharfe Farbklekse im Hintergrund
            const blobs = [
                { x: W * 0.2, y: H * 0.18, r: 180 * s, c: 'rgba(139, 92, 246, 0.55)' },
                { x: W * 0.85, y: H * 0.32, r: 150 * s, c: 'rgba(236, 72, 153, 0.45)' },
                { x: W * 0.3, y: H * 0.85, r: 200 * s, c: 'rgba(59, 130, 246, 0.4)' }
            ];
            ctx.filter = `blur(${60 * s}px)`;
            blobs.forEach(b => {
                ctx.beginPath();
                ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
                ctx.fillStyle = b.c;
                ctx.fill();
            });
            ctx.filter = 'none';

            const artSize = 300 * s;
            const artX = (W - artSize) / 2;
            const artY = 130 * s;
            ctx.save();
            ctx.shadowColor = 'rgba(139, 92, 246, 0.5)';
            ctx.shadowBlur = 50 * s;
            roundRectPath(ctx, artX, artY, artSize, artSize, 32 * s);
            ctx.fillStyle = '#111';
            ctx.fill();
            ctx.restore();
            ctx.save();
            roundRectPath(ctx, artX, artY, artSize, artSize, 32 * s);
            ctx.clip();
            if (artImg) drawImageCover(ctx, artImg, artX, artY, artSize, artSize);
            ctx.restore();

            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.font = `800 ${42 * s}px Inter, sans-serif`;
            wrapText(ctx, title, W / 2, artY + artSize + 76 * s, W - 90 * s, 48 * s);
            const artistGrad = ctx.createLinearGradient(W / 2 - 100 * s, 0, W / 2 + 100 * s, 0);
            artistGrad.addColorStop(0, '#a78bfa');
            artistGrad.addColorStop(1, '#f472b6');
            ctx.fillStyle = artistGrad;
            ctx.font = `700 ${24 * s}px Inter, sans-serif`;
            ctx.fillText(artist, W / 2, artY + artSize + 122 * s);

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = `700 ${15 * s}px Inter, sans-serif`;
            ctx.fillText('🐷 GAMINGPIG HÖRT GERADE', W / 2, H - 45 * s);
        }

        // --- Design 10: Sticker - Verspielter Aufkleber-/Washi-Tape-Look ---
        function drawShareCardSticker(ctx, W, H, artImg, title, artist) {
            const s = W / 720;
            ctx.fillStyle = '#fef9c3';
            ctx.fillRect(0, 0, W, H);

            const cardX = 55 * s, cardY = 90 * s, cardW = W - 110 * s, cardH = H - 220 * s;
            ctx.save();
            ctx.translate(cardX + cardW / 2, cardY + cardH / 2);
            ctx.rotate(-0.02);
            ctx.translate(-(cardX + cardW / 2), -(cardY + cardH / 2));
            ctx.shadowColor = 'rgba(0,0,0,0.15)';
            ctx.shadowBlur = 25 * s;
            ctx.shadowOffsetY = 10 * s;
            ctx.fillStyle = '#ffffff';
            roundRectPath(ctx, cardX, cardY, cardW, cardH, 24 * s);
            ctx.fill();
            ctx.restore();

            // "Washi Tape" Streifen oben
            ctx.save();
            ctx.translate(W / 2, cardY);
            ctx.rotate(-0.05);
            ctx.fillStyle = 'rgba(251, 113, 133, 0.75)';
            ctx.fillRect(-90 * s, -18 * s, 180 * s, 36 * s);
            ctx.restore();

            const artSize = 260 * s;
            const artX = (W - artSize) / 2;
            const artY = cardY + 55 * s;
            ctx.save();
            ctx.translate(artX + artSize / 2, artY + artSize / 2);
            ctx.rotate(0.015);
            ctx.translate(-(artX + artSize / 2), -(artY + artSize / 2));
            roundRectPath(ctx, artX, artY, artSize, artSize, 18 * s);
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 8 * s;
            ctx.save(); ctx.clip();
            if (artImg) drawImageCover(ctx, artImg, artX, artY, artSize, artSize);
            else { ctx.fillStyle = '#ddd'; ctx.fill(); }
            ctx.restore();
            ctx.stroke();
            ctx.restore();

            // Kleine Sticker-Deko (Stern + Herz als einfache Formen)
            ctx.fillStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(artX - 20 * s, artY - 10 * s, 22 * s, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#f472b6';
            ctx.beginPath();
            ctx.arc(artX + artSize + 15 * s, artY + artSize + 5 * s, 18 * s, 0, Math.PI * 2);
            ctx.fill();

            ctx.textAlign = 'center';
            ctx.fillStyle = '#1c1917';
            ctx.font = `800 ${32 * s}px Inter, sans-serif`;
            wrapText(ctx, title, W / 2, artY + artSize + 70 * s, cardW - 60 * s, 38 * s);
            ctx.fillStyle = '#78716c';
            ctx.font = `600 ${20 * s}px Inter, sans-serif`;
            ctx.fillText(artist, W / 2, artY + artSize + 116 * s);

            ctx.fillStyle = 'rgba(28,25,23,0.5)';
            ctx.font = `700 ${16 * s}px Inter, sans-serif`;
            ctx.fillText('🐷 gamingpig hört gerade', W / 2, H - 50 * s);
        }

        
        // --- Design 11: Hologram - Futuristisches Sci-Fi HUD mit Gitter und leuchtendem Hologramm ---
        function drawShareCardHologram(ctx, W, H, artImg, title, artist) {
            const s = W / 720;
            const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
            bgGrad.addColorStop(0, '#030b14');
            bgGrad.addColorStop(0.5, '#051829');
            bgGrad.addColorStop(1, '#020810');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            // Tech HUD Gitter-Hintergrund
            ctx.save();
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.12)';
            ctx.lineWidth = 1 * s;
            for (let x = 0; x <= W; x += 40 * s) {
                ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
            }
            for (let y = 0; y <= H; y += 40 * s) {
                ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
            }
            ctx.restore();

            // Holografischer Kreis-Projektor
            const cx = W / 2, cy = 350 * s;
            ctx.save();
            ctx.strokeStyle = 'rgba(6, 182, 212, 0.4)';
            ctx.lineWidth = 2 * s;
            ctx.setLineDash([8 * s, 6 * s]);
            ctx.beginPath(); ctx.arc(cx, cy, 230 * s, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(cx, cy, 245 * s, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();

            // Zentrale Hologramm-Karte
            const artSize = 340 * s;
            const artX = (W - artSize) / 2;
            const artY = cy - artSize / 2;

            ctx.save();
            ctx.shadowColor = 'rgba(6, 182, 212, 0.85)';
            ctx.shadowBlur = 40 * s;
            roundRectPath(ctx, artX, artY, artSize, artSize, 20 * s);
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 3 * s;
            ctx.stroke();
            ctx.restore();

            ctx.save();
            roundRectPath(ctx, artX, artY, artSize, artSize, 20 * s);
            ctx.clip();
            if (artImg) {
                ctx.filter = 'saturate(180%) contrast(1.1) brightness(1.05)';
                drawImageCover(ctx, artImg, artX, artY, artSize, artSize);
                ctx.filter = 'none';
            } else {
                ctx.fillStyle = '#082f49';
                ctx.fill();
            }
            // Hologram Scanline-Overlay
            ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
            for (let sy = artY; sy < artY + artSize; sy += 4 * s) {
                ctx.fillRect(artX, sy, artSize, 2 * s);
            }
            ctx.restore();

            // Typografie mit Glow
            ctx.textAlign = 'center';
            ctx.save();
            ctx.shadowColor = 'rgba(6, 182, 212, 0.9)';
            ctx.shadowBlur = 18 * s;
            ctx.fillStyle = '#67e8f9';
            ctx.font = "800 " + Math.round(36 * s) + "px 'JetBrains Mono', monospace";
            wrapText(ctx, title, W / 2, artY + artSize + 80 * s, W - 90 * s, 44 * s);
            ctx.restore();

            ctx.fillStyle = 'rgba(165, 243, 252, 0.75)';
            ctx.font = "600 " + Math.round(22 * s) + "px 'JetBrains Mono', monospace";
            ctx.fillText(artist, W / 2, artY + artSize + 135 * s);

            ctx.fillStyle = 'rgba(6, 182, 212, 0.5)';
            ctx.font = "700 " + Math.round(14 * s) + "px 'JetBrains Mono', monospace";
            ctx.fillText('◈ HOLOGRAM AUDIO STREAM // GAMINGPIG ◈', W / 2, H - 45 * s);
        }

        // --- Design 12: Studio - High-End Tonstudio Look mit VU-Meter & Matt-Schwarz ---
        function drawShareCardStudio(ctx, W, H, artImg, title, artist) {
            const s = W / 720;
            ctx.fillStyle = '#09090b';
            ctx.fillRect(0, 0, W, H);

            // Studio Metall-Panel Textur
            const panelX = 40 * s, panelY = 50 * s, panelW = W - 80 * s, panelH = H - 100 * s;
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 40 * s;
            roundRectPath(ctx, panelX, panelY, panelW, panelH, 24 * s);
            ctx.fillStyle = '#141418';
            ctx.fill();
            ctx.strokeStyle = '#27272a';
            ctx.lineWidth = 2 * s;
            ctx.stroke();
            ctx.restore();

            // Studio Header mit Rack-Schrauben
            const screwCols = [panelX + 20 * s, panelX + panelW - 20 * s];
            const screwRows = [panelY + 20 * s, panelY + panelH - 20 * s];
            screwCols.forEach(sx => {
                screwRows.forEach(sy => {
                    ctx.beginPath(); ctx.arc(sx, sy, 7 * s, 0, Math.PI * 2);
                    ctx.fillStyle = '#27272a'; ctx.fill();
                    ctx.beginPath(); ctx.arc(sx, sy, 3 * s, 0, Math.PI * 2);
                    ctx.fillStyle = '#09090b'; ctx.fill();
                });
            });

            // Master LED Display
            ctx.fillStyle = 'rgba(239, 68, 68, 0.85)';
            ctx.beginPath(); ctx.arc(panelX + 45 * s, panelY + 45 * s, 5 * s, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#a1a1aa';
            ctx.font = "700 " + Math.round(13 * s) + "px 'JetBrains Mono', monospace";
            ctx.textAlign = 'left';
            ctx.fillText('REC • MASTER OUT (24-BIT 96kHz)', panelX + 60 * s, panelY + 49 * s);

            // Cover
            const artSize = 360 * s;
            const artX = (W - artSize) / 2;
            const artY = panelY + 80 * s;
            ctx.save();
            roundRectPath(ctx, artX, artY, artSize, artSize, 16 * s);
            ctx.fillStyle = '#09090b'; ctx.fill();
            ctx.clip();
            if (artImg) drawImageCover(ctx, artImg, artX, artY, artSize, artSize);
            ctx.restore();
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 2 * s;
            roundRectPath(ctx, artX, artY, artSize, artSize, 16 * s);
            ctx.stroke();

            // VU Meter Stereo Balken
            const vuY = artY + artSize + 35 * s;
            const vuW = artSize, vuH = 10 * s;
            ['L', 'R'].forEach((ch, idx) => {
                const yPos = vuY + idx * 16 * s;
                ctx.fillStyle = '#71717a';
                ctx.font = "700 " + Math.round(11 * s) + "px 'JetBrains Mono', monospace";
                ctx.fillText(ch, artX - 20 * s, yPos + 8 * s);
                const segments = 24;
                const segW = (vuW - (segments - 1) * 3 * s) / segments;
                for (let i = 0; i < segments; i++) {
                    const segX = artX + i * (segW + 3 * s);
                    if (i < 16) ctx.fillStyle = '#22c55e';
                    else if (i < 20) ctx.fillStyle = '#eab308';
                    else ctx.fillStyle = '#ef4444';
                    ctx.fillRect(segX, yPos, segW, vuH);
                }
            });

            // Song Info
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.font = "800 " + Math.round(34 * s) + "px Inter, sans-serif";
            wrapText(ctx, title, W / 2, vuY + 70 * s, panelW - 60 * s, 42 * s);

            ctx.fillStyle = '#a1a1aa';
            ctx.font = "600 " + Math.round(22 * s) + "px Inter, sans-serif";
            ctx.fillText(artist, W / 2, vuY + 122 * s);

            ctx.fillStyle = '#52525b';
            ctx.font = "700 " + Math.round(13 * s) + "px 'JetBrains Mono', monospace";
            ctx.fillText('STUDIO MONITORING // GAMINGPIG', W / 2, panelY + panelH - 30 * s);
        }

        // --- Design 13: Glow Orb - Kosmischer Farbverlauf mit leuchtender Sphäre ---
        function drawShareCardOrb(ctx, W, H, artImg, title, artist) {
            const s = W / 720;
            const bgGrad = ctx.createLinearGradient(0, 0, W, H);
            bgGrad.addColorStop(0, '#0c071e');
            bgGrad.addColorStop(0.5, '#190a38');
            bgGrad.addColorStop(1, '#05020c');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, W, H);

            // Große leuchtende Sphäre / Orb im Zentrum
            const cx = W / 2, cy = 340 * s;
            const orbGrad = ctx.createRadialGradient(cx, cy, 20 * s, cx, cy, 240 * s);
            orbGrad.addColorStop(0, 'rgba(236, 72, 153, 0.7)');
            orbGrad.addColorStop(0.5, 'rgba(139, 92, 246, 0.45)');
            orbGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = orbGrad;
            ctx.beginPath(); ctx.arc(cx, cy, 240 * s, 0, Math.PI * 2); ctx.fill();

            // Rundes schwebendes Cover
            const artR = 170 * s;
            ctx.save();
            ctx.shadowColor = 'rgba(236, 72, 153, 0.7)';
            ctx.shadowBlur = 50 * s;
            ctx.beginPath(); ctx.arc(cx, cy, artR, 0, Math.PI * 2);
            ctx.fillStyle = '#180e29'; ctx.fill();
            ctx.restore();

            ctx.save();
            ctx.beginPath(); ctx.arc(cx, cy, artR, 0, Math.PI * 2); ctx.clip();
            if (artImg) drawImageCover(ctx, artImg, cx - artR, cy - artR, artR * 2, artR * 2);
            ctx.restore();

            ctx.beginPath(); ctx.arc(cx, cy, artR, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 3 * s;
            ctx.stroke();

            // Text
            ctx.textAlign = 'center';
            ctx.fillStyle = '#ffffff';
            ctx.font = "800 " + Math.round(40 * s) + "px Inter, sans-serif";
            wrapText(ctx, title, W / 2, cy + artR + 90 * s, W - 90 * s, 48 * s);

            const artGrad = ctx.createLinearGradient(W / 2 - 120 * s, 0, W / 2 + 120 * s, 0);
            artGrad.addColorStop(0, '#f472b6');
            artGrad.addColorStop(1, '#a78bfa');
            ctx.fillStyle = artGrad;
            ctx.font = "700 " + Math.round(24 * s) + "px Inter, sans-serif";
            ctx.fillText(artist, W / 2, cy + artR + 144 * s);

            ctx.fillStyle = 'rgba(255,255,255,0.45)';
            ctx.font = "700 " + Math.round(15 * s) + "px Inter, sans-serif";
            ctx.fillText('✨ AMBIENT ORB // GAMINGPIG', W / 2, H - 45 * s);
        }

        // --- Design 14: Cyberpunk - Glitchiger High-Tech Look mit gelben/cyan Warnstreifen ---
        function drawShareCardCyberpunk(ctx, W, H, artImg, title, artist) {
            const s = W / 720;
            ctx.fillStyle = '#0a0a0f';
            ctx.fillRect(0, 0, W, H);

            // Cyberpunk Gelb/Cyan Schrägstreifen
            ctx.save();
            ctx.fillStyle = '#fcee0a';
            ctx.fillRect(0, 0, W, 20 * s);
            ctx.fillStyle = '#00f0ff';
            ctx.fillRect(0, 20 * s, W, 6 * s);

            // Diagonale Warnstreifen oben
            ctx.fillStyle = '#0a0a0f';
            for (let i = 0; i < W; i += 30 * s) {
                ctx.beginPath();
                ctx.moveTo(i, 0);
                ctx.lineTo(i + 15 * s, 0);
                ctx.lineTo(i, 20 * s);
                ctx.lineTo(i - 15 * s, 20 * s);
                ctx.fill();
            }
            ctx.restore();

            const cardX = 45 * s, cardY = 70 * s, cardW = W - 90 * s, cardH = H - 140 * s;
            ctx.save();
            ctx.fillStyle = '#12131a';
            ctx.strokeStyle = '#00f0ff';
            ctx.lineWidth = 2 * s;
            // Angeschrägte Ecken
            const cut = 24 * s;
            ctx.beginPath();
            ctx.moveTo(cardX + cut, cardY);
            ctx.lineTo(cardX + cardW, cardY);
            ctx.lineTo(cardX + cardW, cardY + cardH - cut);
            ctx.lineTo(cardX + cardW - cut, cardY + cardH);
            ctx.lineTo(cardX, cardY + cardH);
            ctx.lineTo(cardX, cardY + cut);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // Cover
            const artSize = 350 * s;
            const artX = (W - artSize) / 2;
            const artY = cardY + 50 * s;
            ctx.save();
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 30 * s;
            ctx.strokeStyle = '#fcee0a';
            ctx.lineWidth = 3 * s;
            ctx.strokeRect(artX, artY, artSize, artSize);
            ctx.restore();

            ctx.save();
            ctx.beginPath(); ctx.rect(artX, artY, artSize, artSize); ctx.clip();
            if (artImg) {
                ctx.filter = 'contrast(1.15) saturate(140%)';
                drawImageCover(ctx, artImg, artX, artY, artSize, artSize);
                ctx.filter = 'none';
            }
            ctx.restore();

            // Typo
            ctx.textAlign = 'center';
            ctx.fillStyle = '#fcee0a';
            ctx.font = "900 " + Math.round(36 * s) + "px 'JetBrains Mono', monospace";
            wrapText(ctx, title.toUpperCase(), W / 2, artY + artSize + 70 * s, cardW - 40 * s, 42 * s);

            ctx.fillStyle = '#00f0ff';
            ctx.font = "700 " + Math.round(22 * s) + "px 'JetBrains Mono', monospace";
            ctx.fillText('// ' + artist.toUpperCase(), W / 2, artY + artSize + 120 * s);

            ctx.fillStyle = '#fcee0a';
            ctx.font = "800 " + Math.round(14 * s) + "px 'JetBrains Mono', monospace";
            ctx.fillText('⚡ CYBERPUNK 2077 NOW PLAYING ⚡', W / 2, cardY + cardH - 25 * s);
        }

        function roundRectPath(ctx, x, y, w, h, r) {
            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
        }

        function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
            const words = text.split(' ');
            let line = '';
            const lines = [];
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                if (ctx.measureText(testLine).width > maxWidth && n > 0) {
                    lines.push(line.trim());
                    line = words[n] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line.trim());
            const startY = y - ((lines.length - 1) * lineHeight) / 2;
            lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
        }

        // NEW: wie wrapText, aber linksbündig (für das Poster-Design)
        function wrapTextLeft(ctx, text, x, y, maxWidth, lineHeight) {
            const words = text.split(' ');
            let line = '';
            const lines = [];
            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' ';
                if (ctx.measureText(testLine).width > maxWidth && n > 0) {
                    lines.push(line.trim());
                    line = words[n] + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line.trim());
            const trimmed = lines.slice(0, 2);
            const startY = y - (trimmed.length - 1) * lineHeight;
            trimmed.forEach((l, i) => ctx.fillText(l, x, startY + i * lineHeight));
        }

        // ========================================================= //
        
};
