// ==============================================================================
// Gamingpig iOS Dynamic Island, Lockscreen & Live Music Widget (Scriptable)
// ==============================================================================
// Anleitung:
// 1. Installiere die kostenlose App "Scriptable" aus dem App Store auf deinem iPhone.
// 2. Erstelle ein neues Skript, nenne es "Gamingpig Live" und füge diesen Code ein.
// 3. Gehe auf deinen iPhone-Homescreen oder Sperrbildschirm -> langes Drücken -> "+" -> Scriptable Widget hinzufügen!
// 4. Parameter (optional in Widget-Einstellungen): "liquid" | "oled" | "cyber"
// ==============================================================================

const API_URL = "https://npc-api.aikins.xyz/v1/users/gamingpig/now";
const STATSFM_URL = "https://api.stats.fm/api/v1/users/gamingpig/streams/current";
const DEFAULT_URL = "https://gamingpig.github.io/about-qa/?mode=standby";
const FALLBACK_ART = "https://gamingpig.github.io/about-qa/og-v2.jpg";

// Parameter-Auswertung für Styling & Ziel-URL
const WIDGET_PARAM = (typeof args !== 'undefined' && args.widgetParameter) ? args.widgetParameter.trim().toLowerCase() : "liquid";
const PORTFOLIO_URL = WIDGET_PARAM.startsWith("http") ? WIDGET_PARAM : DEFAULT_URL;

async function fetchNowPlaying() {
    try {
        let req = new Request(API_URL);
        req.timeoutInterval = 3;
        let data = await req.loadJSON();
        if (data && data.status === "playing" && data.track) {
            return data;
        }
    } catch(e) {}

    // Fallback auf stats.fm, falls die NPC-API / der Raspberry Pi offline ist
    try {
        let sfmReq = new Request(STATSFM_URL);
        sfmReq.timeoutInterval = 4;
        let payload = await sfmReq.loadJSON();
        let item = payload && payload.item;
        let trk = item && item.track;
        if (item && trk && item.isPlaying) {
            let artists = Array.isArray(trk.artists) ? trk.artists.map(a => a && a.name).filter(Boolean) : [];
            let albums = trk.albums || [];
            let album = albums[0] || {};
            return {
                status: "playing",
                track: {
                    title: trk.name || "",
                    artist: artists.join(", ") || "Unknown",
                    artwork_url: album.image || "",
                    duration_ms: Number(trk.durationMs) || 0,
                    progress_ms: Number(item.progressMs) || 0
                }
            };
        }
    } catch(e) {}

    return null;
}

async function getImage(url) {
    try {
        let req = new Request(url || FALLBACK_ART);
        req.timeoutInterval = 4;
        return await req.loadImage();
    } catch(e) {
        try {
            let reqFallback = new Request(FALLBACK_ART);
            return await reqFallback.loadImage();
        } catch(_) {
            return null;
        }
    }
}

async function createWidget() {
    let data = await fetchNowPlaying();
    let isPlaying = data && data.status === "playing";
    let track = (data && data.track) || {};
    let title = track.title || track.name || "Aktuell ist es ruhig...";
    let artist = track.artist || "Genieße die Stille";
    let artUrl = track.artwork_url || FALLBACK_ART;
    let duration = Number(track.duration_ms) || 0;
    let progress = Number(track.progress_ms) || 0;

    let widget = new ListWidget();
    widget.url = PORTFOLIO_URL;

    // Theme & Hintergrund
    let gradient = new LinearGradient();
    if (WIDGET_PARAM.includes("oled")) {
        widget.backgroundColor = new Color("#000000");
    } else if (WIDGET_PARAM.includes("cyber")) {
        gradient.colors = [new Color("#0f172a"), new Color("#1e1b4b"), new Color("#311042")];
        gradient.locations = [0, 0.6, 1];
        widget.backgroundGradient = gradient;
    } else {
        // Liquid Glass Default Theme
        if (isPlaying) {
            gradient.colors = [new Color("#0a0f1d"), new Color("#0f172a"), new Color("#030712")];
            gradient.locations = [0, 0.5, 1];
        } else {
            gradient.colors = [new Color("#0b0f19"), new Color("#020617")];
            gradient.locations = [0, 1];
        }
        widget.backgroundGradient = gradient;
    }

    const family = (typeof config !== 'undefined' && config.widgetFamily) ? config.widgetFamily : "medium";

    // 🔒 iOS SPERRBILDSCHIRM (ACCESSORY RECTANGULAR)
    if (family === "accessoryRectangular") {
        let row1 = widget.addStack();
        row1.centerAlignContent();
        let dot = row1.addText(isPlaying ? "▶ " : "⏸ ");
        dot.font = Font.boldSystemFont(11);
        let titleLock = row1.addText(title);
        titleLock.font = Font.boldSystemFont(11);
        titleLock.lineLimit = 1;

        widget.addSpacer(2);
        let artistLock = widget.addText(artist);
        artistLock.font = Font.systemFont(10);
        artistLock.lineLimit = 1;

        if (isPlaying && duration > 0) {
            widget.addSpacer(2);
            let pct = Math.min(1, Math.max(0, progress / duration));
            let pctText = widget.addText(`${Math.round(pct * 100)}% · Live auf Spotify`);
            pctText.font = Font.systemFont(9);
            pctText.textColor = new Color("#94a3b8");
        }
        return widget;
    }

    // 📱 SMALL WIDGET (HOMESCREEN KLEIN)
    if (family === "small") {
        let topRow = widget.addStack();
        topRow.centerAlignContent();
        let dot = topRow.addText(isPlaying ? "🟢 " : "🌙 ");
        dot.font = Font.systemFont(9);
        let statusText = topRow.addText(isPlaying ? "NOW PLAYING" : "STANDBY");
        statusText.font = Font.blackSystemFont(8);
        statusText.textColor = isPlaying ? new Color("#22c55e") : new Color("#64748b");
        topRow.addSpacer();

        widget.addSpacer(6);
        let coverImg = await getImage(artUrl);
        if (coverImg) {
            let coverWidget = widget.addImage(coverImg);
            coverWidget.imageSize = new Size(58, 58);
            coverWidget.cornerRadius = 14;
            coverWidget.borderWidth = 1;
            coverWidget.borderColor = new Color("#ffffff", 0.18);
        }

        widget.addSpacer(6);
        let tText = widget.addText(title);
        tText.font = Font.boldSystemFont(11);
        tText.textColor = new Color("#ffffff");
        tText.lineLimit = 1;

        let aText = widget.addText(artist);
        aText.font = Font.mediumSystemFont(9);
        aText.textColor = new Color("#94a3b8");
        aText.lineLimit = 1;
        return widget;
    }

    // 📱 MEDIUM WIDGET (HOMESCREEN STANDARD / TABLET, family === "medium")
    // Top Row: Status Chip
    let topRow = widget.addStack();
    topRow.centerAlignContent();

    let dot = topRow.addText(isPlaying ? "🟢 " : "🌙 ");
    dot.font = Font.systemFont(9);

    let statusText = topRow.addText(isPlaying ? "NOW PLAYING" : "STANDBY");
    statusText.font = Font.blackSystemFont(9);
    statusText.textColor = isPlaying ? new Color("#22c55e") : new Color("#64748b");

    topRow.addSpacer();

    let brand = topRow.addText("GAMINGPIG");
    brand.font = Font.blackSystemFont(8);
    brand.textColor = new Color("#475569");

    widget.addSpacer(8);

    // Middle Row: Cover + Info
    let mainRow = widget.addStack();
    mainRow.centerAlignContent();

    let coverImg = await getImage(artUrl);
    if (coverImg) {
        let coverWidget = mainRow.addImage(coverImg);
        coverWidget.imageSize = new Size(54, 54);
        coverWidget.cornerRadius = 14;
        coverWidget.borderWidth = 1;
        coverWidget.borderColor = new Color("#ffffff", 0.15);
    }

    mainRow.addSpacer(12);

    let infoStack = mainRow.addStack();
    infoStack.layoutVertically();

    let titleText = infoStack.addText(title);
    titleText.font = Font.boldSystemFont(13);
    titleText.textColor = new Color("#ffffff");
    titleText.lineLimit = 1;

    infoStack.addSpacer(2);

    let artistText = infoStack.addText(artist);
    artistText.font = Font.mediumSystemFont(11);
    artistText.textColor = new Color("#94a3b8");
    artistText.lineLimit = 1;

    if (isPlaying) {
        infoStack.addSpacer(6);
        let metaRow = infoStack.addStack();
        metaRow.centerAlignContent();

        let liveBar = metaRow.addText("🎵 Live auf Spotify");
        liveBar.font = Font.boldSystemFont(9);
        liveBar.textColor = new Color("#38bdf8");

        if (duration > 0 && progress > 0) {
            metaRow.addSpacer(8);
            let pct = Math.round(Math.min(100, Math.max(0, (progress / duration) * 100)));
            let pctText = metaRow.addText(`· ${pct}%`);
            pctText.font = Font.mediumSystemFont(9);
            pctText.textColor = new Color("#64748b");
        }
    }

    return widget;
}

let widget = await createWidget();
if (typeof config !== 'undefined' && config.runsInWidget) {
    Script.setWidget(widget);
} else {
    widget.presentMedium();
}
Script.complete();
