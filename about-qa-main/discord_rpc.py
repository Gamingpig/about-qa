#!/usr/bin/env python3
"""
Gamingpig Discord Rich Presence (RPC) Music Client
===================================================
Dieses Script verbindet sich lokal mit deiner laufenden Discord-Desktop-App
und zeigt deinen aktuellen Live-Spotify-Track direkt in deinem Discord-PROFIL an!

Features:
- "Hört Gamingpig Live" in deinem Discord-Status
- Zeigt Songtitel, Interpret, Album
- Zeigt Start- und Endzeitpunkt (Live-Fortschritt in Discord)
- Button "🌐 Im Portfolio mitlauschen"
- Verschwindet automatisch bei Musikpause
- Funktioniert unter Linux & Windows ohne Discord-Bot-Token!

Benötigt: pip install pypresence (oder wird automatisch installiert)
"""

import os
import sys
import time
import json
import urllib.request

# Discord Application Client-ID (Öffentliche App-ID für Gamingpig Music RPC)
CLIENT_ID = "1219665330386014318"  # Universal Rich Presence App ID

MUSIC_API_URL = "https://npc-api.aikins.xyz/v1/users/gamingpig/now"
PORTFOLIO_URL = "https://gamingpig.github.io/About-Gamingpig/"
POLL_INTERVAL = 3

def ensure_pypresence():
    try:
        import pypresence
        return pypresence
    except ImportError:
        print("[INFO] Installiere pypresence...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pypresence"])
        import pypresence
        return pypresence

pypresence = ensure_pypresence()
from pypresence import Presence

def fetch_now_playing():
    try:
        req = urllib.request.Request(MUSIC_API_URL, headers={"User-Agent": "Gamingpig-RPC/1.0"})
        with urllib.request.urlopen(req, timeout=3) as response:
            if response.status == 200:
                data = json.loads(response.read().decode("utf-8"))
                if data and data.get("status") == "playing" and data.get("track"):
                    return data
    except Exception:
        pass

    # Fallback auf stats.fm, falls die NPC-API oder der Raspberry Pi offline ist
    try:
        sfm_url = "https://api.stats.fm/api/v1/users/gamingpig/streams/current"
        req = urllib.request.Request(sfm_url, headers={"User-Agent": "Gamingpig-RPC/1.0"})
        with urllib.request.urlopen(req, timeout=4) as response:
            if response.status == 200:
                payload = json.loads(response.read().decode("utf-8"))
                item = payload.get("item") if payload else None
                track = item.get("track") if item else None
                if item and track and item.get("isPlaying"):
                    artists = [a.get("name") for a in track.get("artists", []) if a.get("name")]
                    albums = track.get("albums") or []
                    album = albums[0] if albums else {}
                    return {
                        "status": "playing",
                        "track": {
                            "title": track.get("name", ""),
                            "artist": ", ".join(artists) or "Unknown",
                            "album": album.get("name", ""),
                            "duration_ms": track.get("durationMs", 0),
                            "progress_ms": item.get("progressMs", 0),
                            "artwork_url": album.get("image", "")
                        }
                    }
    except Exception:
        pass

    return None

def main():
    print("==================================================")
    print("🎵 Gamingpig Discord Rich Presence (RPC) Client")
    print("==================================================")
    print("Verbinde mit lokaler Discord Desktop App...")

    rpc = None
    connected = False

    while not connected:
        try:
            rpc = Presence(CLIENT_ID)
            rpc.connect()
            connected = True
            print("✅ Erfolgreich mit Discord verbunden!")
        except Exception as e:
            print(f"[-] Discord nicht geöffnet. Warte... ({e})")
            time.sleep(5)

    last_song_key = None
    is_active = False

    while True:
        try:
            data = fetch_now_playing()
            if data and data.get("status") == "playing":
                track = data.get("track") or {}
                title = track.get("title") or track.get("name")
                artist = track.get("artist") or "Gamingpig"
                album = track.get("album") or ""
                duration_ms = track.get("duration_ms") or 0
                progress_ms = track.get("progress_ms") or 0
                art_url = track.get("artwork_url") or "icon-192"

                if title and title != "Aktuell ist es ruhig...":
                    song_key = f"{title}-{artist}"

                    now = int(time.time())
                    start_epoch = now - int(progress_ms / 1000)
                    end_epoch = start_epoch + int(duration_ms / 1000) if duration_ms > 0 else None

                    if song_key != last_song_key:
                        last_song_key = song_key
                        is_active = True
                        print(f"[{time.strftime('%H:%M:%S')}] 🎵 Status gesetzt: {title} - {artist}")

                        rpc_kwargs = {
                            "details": f"🎵 {title[:128]}",
                            "state": f"👤 {artist[:128]}",
                            "large_image": "spotify_logo",
                            "large_text": f"Album: {album[:128]}" if album else "Gamingpig Live",
                            "small_image": "play_icon",
                            "small_text": "Live auf Spotify",
                            "buttons": [
                                {"label": "🌐 Portfolio öffnen", "url": PORTFOLIO_URL}
                            ]
                        }

                        if end_epoch and end_epoch > now:
                            rpc_kwargs["start"] = start_epoch
                            rpc_kwargs["end"] = end_epoch

                        rpc.update(**rpc_kwargs)

            else:
                if is_active:
                    print(f"[{time.strftime('%H:%M:%S')}] 🌙 Musik pausiert - Status zurückgesetzt.")
                    rpc.clear()
                    is_active = False
                    last_song_key = None

        except Exception as e:
            # Falls Discord geschlossen wurde
            try:
                rpc.connect()
            except Exception:
                pass

        time.sleep(POLL_INTERVAL)

if __name__ == "__main__":
    main()
