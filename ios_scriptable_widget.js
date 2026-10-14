// ==============================================================================
// Gamingpig iOS Dynamic Island & Live Music Widget (Scriptable)
// ==============================================================================
// Anleitung:
// 1. Installiere die kostenlose App "Scriptable" aus dem App Store auf deinem iPhone.
// 2. Erstelle ein neues Skript, nenne es "Gamingpig Live" und füge diesen Code ein.
// 3. Gehe auf deinen iPhone-Homescreen -> langes Drücken -> "+" -> Scriptable Widget hinzufügen!
// ==============================================================================

const API_URL = "https://npc-api.aikins.xyz/v1/users/gamingpig/now";
const PORTFOLIO_URL = "https://gamingpig.github.io/About-Gamingpig/";
const FALLBACK_ART = "https://gamingpig.github.io/About-Gamingpig/og-v2.jpg";

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
        let sfmReq = new Request("https://api.stats.fm/api/v1/users/gamingpig/streams/current");
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
        let reqFallback = new Request(FALLBACK_ART);
        return await reqFallback.loadImage();
    }
}

async function createWidget() {
    let data = await fetchNowPlaying();
    let isPlaying = data && data.status === "playing";
    let track = (data && data.track) || {};
    let title = track.title || track.name || "Aktuell ist es ruhig...";
    let artist = track.artist || "Genieße die Stille";
    let artUrl = track.artwork_url || FALLBACK_ART;

    let widget = new ListWidget();
    widget.backgroundColor = new Color("#080c1a");
    widget.url = PORTFOLIO_URL;

    // Gradient Background
    let gradient = new LinearGradient();
    if (isPlaying) {
        gradient.colors = [new Color("#0a0f1d"), new Color("#111827"), new Color("#030712")];
        gradient.locations = [0, 0.6, 1];
    } else {
        gradient.colors = [new Color("#0b0f19"), new Color("#030712")];
        gradient.locations = [0, 1];
    }
    widget.backgroundGradient = gradient;

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
    let coverWidget = mainRow.addImage(coverImg);
    coverWidget.imageSize = new Size(54, 54);
    coverWidget.cornerRadius = 14;
    coverWidget.borderWidth = 1;
    coverWidget.borderColor = new Color("#ffffff", 0.15);

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
        let liveBar = infoStack.addText("🎵 Live auf Spotify");
        liveBar.font = Font.boldSystemFont(9);
        liveBar.textColor = new Color("#3b82f6");
    }

    return widget;
}

let widget = await createWidget();
if (config.runsInWidget) {
    Script.setWidget(widget);
} else {
    widget.presentMedium();
}
Script.complete();
