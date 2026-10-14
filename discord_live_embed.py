#!/usr/bin/env python3
"""
Gamingpig Live Discord Music Embed Bot (Raspberry Pi Edition)
============================================================
Dieses Script pollt deine Live-Musik-API und aktualisiert automatisch eine
permanente Discord-Embed-Nachricht in deinem gewünschten Discord-Kanal.

Funktionen:
- Echtes Live-Embed mit Titel, Künstler, Album, Cover-Art & Fortschrittsbalken
- Ändert sich automatisch bei Songwechsel und Pausen
- Erstellt beim ersten Start die Nachricht und merkt sich die ID in 'discord_embed_state.json'
- Läuft ressourcenschonend und absturzsicher als Systemd-Dienst oder Hintergrundprozess auf deinem Raspberry Pi

Benötigt nur die Standardbibliothek (urllib / json / time), keine extra pip-Pakete erforderlich!
"""

import os
import sys
import json
import time
import urllib.request
import urllib.parse
import urllib.error

# ==============================================================================
# KONFIGURATION
# ==============================================================================
# 1. Erstelle in Discord einen Webhook für deinen gewünschten Kanal:
#    Kanaleinstellungen -> Integrationen -> Webhooks -> Neuer Webhook -> URL kopieren
DISCORD_WEBHOOK_URL = os.environ.get("DISCORD_WEBHOOK_URL", "DEINE_DISCORD_WEBHOOK_URL_HIER_EINFUEGEN")

# Deine Live-Musik-API URL
MUSIC_API_URL = "https://npc-api.aikins.xyz/v1/users/gamingpig/now"

# Portfolio Website URL
PORTFOLIO_URL = "https://gamingpig.github.io/About-Gamingpig/"

# Abfrage-Intervall in Sekunden (5s ist ideal)
POLL_INTERVAL = 5

# Datei zum Speichern der erstellten Discord Message ID (damit dieselbe Nachricht editiert wird)
STATE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "discord_embed_state.json")

# ==============================================================================
# HILFSFUNKTIONEN
# ==============================================================================

def make_progress_bar(current_ms, total_ms, length=12):
    if not total_ms or total_ms <= 0:
        return "🔘" + "▬" * (length - 1)
    ratio = min(1.0, max(0.0, current_ms / total_ms))
    idx = int(ratio * (length - 1))
    bar = ""
    for i in range(length):
        if i == idx:
            bar += "🔘"
        else:
            bar += "▬"
    return bar

def format_time(ms):
    if not ms or ms < 0:
        return "0:00"
    total_sec = int(ms / 1000)
    minutes = total_sec // 60
    seconds = total_sec % 60
    return f"{minutes}:{seconds:02d}"

def load_saved_message_id():
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("message_id")
        except Exception:
            return None
    return None

def save_message_id(message_id):
    try:
        with open(STATE_FILE, "w", encoding="utf-8") as f:
            json.dump({"message_id": str(message_id)}, f)
    except Exception as e:
        print(f"[WARN] Konnte message_id nicht speichern: {e}")

def fetch_music_data():
    try:
        req = urllib.request.Request(
            MUSIC_API_URL,
            headers={"User-Agent": "Gamingpig-Pi-EmbedBot/1.0"}
        )
        with urllib.request.urlopen(req, timeout=6) as response:
            if response.status == 200:
                body = response.read().decode("utf-8")
                return json.loads(body)
    except Exception as e:
        print(f"[DEBUG] Fehler beim Abrufen der Musikdaten: {e}")
    return None

def build_discord_embed(data):
    """Erstellt das Discord-Embed Payload-Dictionary basierend auf den Live-Daten."""
    is_playing = data and data.get("status") == "playing"
    track = data.get("track") if (data and isinstance(data.get("track"), dict)) else {}

    title = track.get("title") or track.get("name") or "Aktuell ist es ruhig..."
    artist = track.get("artist") or "Genieße die Stille"
    album = track.get("album") or ""
    art_url = track.get("artwork_url") or ""
    duration_ms = track.get("duration_ms") or 0
    progress_ms = track.get("progress_ms") or 0
    track_url = track.get("track_url") or PORTFOLIO_URL

    if is_playing and title != "Aktuell ist es ruhig...":
        progress_bar = make_progress_bar(progress_ms, duration_ms, length=14)
        time_str = f"`{format_time(progress_ms)}` {progress_bar} `{format_time(duration_ms)}`"

        fields = [
            {"name": "👤 Künstler", "value": artist, "inline": True},
        ]
        if album:
            fields.append({"name": "💿 Album", "value": album, "inline": True})
        
        fields.append({"name": "⏱️ Fortschritt", "value": time_str, "inline": False})
        fields.append({
            "name": "🔗 Links",
            "value": f"[🌐 Im Portfolio ansehen]({PORTFOLIO_URL}) • [🎧 Song öffnen]({track_url})",
            "inline": False
        })

        embed = {
            "title": f"🎵 {title}",
            "url": PORTFOLIO_URL,
            "description": "**Gamingpig hört gerade live Musik auf Spotify**",
            "color": 0x1DB954,  # Spotify Grün
            "fields": fields,
            "footer": {
                "text": "Gamingpig Live Now Playing • Raspberry Pi Live Feed",
                "icon_url": "https://gamingpig.github.io/About-Gamingpig/og-v2.jpg"
            },
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }

        if art_url and art_url.startswith("http"):
            embed["thumbnail"] = {"url": art_url}

        return {"embeds": [embed]}

    else:
        # Offline / Pause Embed
        embed = {
            "title": "🌙 Aktuell ist es ruhig...",
            "url": PORTFOLIO_URL,
            "description": "Gamingpig hört momentan keine Musik. Genieße die Stille!",
            "color": 0x334155,  # Slate Dunkelblau/Grau
            "fields": [
                {
                    "name": "🌐 Portfolio",
                    "value": f"[Gamingpig's Website öffnen]({PORTFOLIO_URL})",
                    "inline": False
                }
            ],
            "footer": {
                "text": "Gamingpig Live Now Playing • Standby",
                "icon_url": "https://gamingpig.github.io/About-Gamingpig/og-v2.jpg"
            },
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
        return {"embeds": [embed]}

def send_or_edit_discord_embed(payload, message_id=None):
    """
    Sendet das Embed an Discord. Wenn bereits eine message_id existiert,
    wird die bestehende Nachricht per PATCH aktualisiert (kein Chat-Spam!).
    """
    if "DEINE_DISCORD_WEBHOOK_URL_HIER_EINFUEGEN" in DISCORD_WEBHOOK_URL:
        print("[ERROR] Bitte trage deine echte DISCORD_WEBHOOK_URL im Script ein!")
        return message_id

    # Wenn message_id vorhanden -> PATCH an /messages/{id}
    if message_id:
        patch_url = f"{DISCORD_WEBHOOK_URL}/messages/{message_id}"
        try:
            req = urllib.request.Request(
                patch_url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json", "User-Agent": "Gamingpig-Pi-EmbedBot/1.0"},
                method="PATCH"
            )
            with urllib.request.urlopen(req, timeout=6) as resp:
                if resp.status in (200, 204):
                    return message_id
        except urllib.error.HTTPError as e:
            if e.code == 404:
                # Nachricht wurde in Discord gelöscht -> neu erstellen
                print("[INFO] Gespeicherte Nachricht nicht gefunden, erstelle eine neue...")
                message_id = None
            else:
                print(f"[WARN] PATCH fehlgeschlagen mit Status {e.code}")
        except Exception as e:
            print(f"[WARN] PATCH Netzwerkfehler: {e}")

    # Neue Nachricht erstellen (mit ?wait=true, um die neue message_id zu erhalten)
    create_url = DISCORD_WEBHOOK_URL + ("&" if "?" in DISCORD_WEBHOOK_URL else "?") + "wait=true"
    try:
        req = urllib.request.Request(
            create_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json", "User-Agent": "Gamingpig-Pi-EmbedBot/1.0"},
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=6) as resp:
            if resp.status in (200, 201):
                body = json.loads(resp.read().decode("utf-8"))
                new_id = body.get("id")
                if new_id:
                    print(f"[INFO] Neue Live-Embed-Nachricht erstellt (ID: {new_id})")
                    save_message_id(new_id)
                    return new_id
    except Exception as e:
        print(f"[ERROR] POST fehlgeschlagen: {e}")

    return message_id

# ==============================================================================
# MAIN LOOP
# ==============================================================================
def main():
    print("==================================================")
    print("🎮 Gamingpig Live Discord Music Embed Bot")
    print("==================================================")
    
    if "DEINE_DISCORD_WEBHOOK_URL_HIER_EINFUEGEN" in DISCORD_WEBHOOK_URL:
        print("[!] WICHTIG: Bitte trage deine Discord Webhook-URL ein:")
        print("    Entweder als Umgebungsvariable: export DISCORD_WEBHOOK_URL='https://...'")
        print("    Oder direkt oben im Script.")
        print("==================================================")

    message_id = load_saved_message_id()
    if message_id:
        print(f"[INFO] Bereits vorhandene Nachricht-ID gefunden: {message_id}")

    last_track_signature = None

    while True:
        try:
            data = fetch_music_data()
            if data:
                track = data.get("track") or {}
                status = data.get("status")
                current_sig = f"{status}_{track.get('title')}_{track.get('artist')}_{int((track.get('progress_ms') or 0)/10000)}"

                # Nur updaten wenn sich Track, Status oder Fortschritt relevant geändert haben
                if current_sig != last_track_signature:
                    payload = build_discord_embed(data)
                    message_id = send_or_edit_discord_embed(payload, message_id)
                    last_track_signature = current_sig
                    title = track.get("title") or "Offline"
                    print(f"[{time.strftime('%H:%M:%S')}] Live Embed aktualisiert: {title}")

        except KeyboardInterrupt:
            print("\n[INFO] Bot beendet.")
            sys.exit(0)
        except Exception as e:
            print(f"[ERROR] Unerwarteter Fehler im Loop: {e}")

        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
