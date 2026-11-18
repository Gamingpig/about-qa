#!/usr/bin/env bash
# ==============================================================================
# Gamingpig Live Discord Music Embed - Raspberry Pi Autostart Installer
# ==============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/discord_live_embed.py"
SERVICE_NAME="gamingpig-discord-embed"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

echo "=================================================="
echo "🎮 Gamingpig Discord Embed - Autostart Setup (Pi)"
echo "=================================================="

# 1. Prüfe ob Python 3 installiert ist
if ! command -v python3 &> /dev/null; then
    echo "[-] Python3 ist nicht installiert. Installiere..."
    sudo apt update && sudo apt install -y python3
fi

# 2. Skript ausführbar machen
chmod +x "$PYTHON_SCRIPT"

# 3. Webhook URL abfragen falls nicht gesetzt
if [ -z "$DISCORD_WEBHOOK_URL" ]; then
    echo ""
    read -rp "👉 Bitte gib deine Discord Webhook URL ein: " INPUT_WEBHOOK_URL
    DISCORD_WEBHOOK_URL="${INPUT_WEBHOOK_URL:-"
fi

if [ -z "$DISCORD_WEBHOOK_URL" ]; then
    echo "[-] Keine Webhook-URL angegeben. Setup abgebrochen."
    exit 1
fi

# 4. Aktuellen Benutzer ermitteln
RUN_USER="$(id -un)"

# 5. Systemd Service Datei schreiben
echo "[+] Erstelle Systemd Autostart-Service unter $SERVICE_FILE..."

sudo bash -c "cat <<EOF > $SERVICE_FILE
[Unit]
Description=Gamingpig Live Discord Music Embed Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$RUN_USER
WorkingDirectory=$SCRIPT_DIR
Environment=DISCORD_WEBHOOK_URL=$DISCORD_WEBHOOK_URL
ExecStart=/usr/bin/env python3 $PYTHON_SCRIPT
Restart=always
RestartSec=5

# Logging
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF"

# 6. Service aktivieren und sofort starten
echo "[+] Lade systemd Daemons neu..."
sudo systemctl daemon-reload

echo "[+] Aktiviere Service für Boot-Autostart..."
sudo systemctl enable "$SERVICE_NAME"

echo "[+] Starte Service jetzt..."
sudo systemctl restart "$SERVICE_NAME"

echo ""
echo "=================================================="
echo "✅ FERTIG! Der Discord Embed Bot läuft jetzt im Hintergrund"
echo "   und startet ab sofort bei jedem Pi-Boot automatisch!"
echo "=================================================="
echo ""
echo "Nützliche Befehle zur Verwaltung auf deinem Pi:"
echo "  - Status ansehen:   sudo systemctl status $SERVICE_NAME"
echo "  - Live-Logs sehen:  sudo journalctl -u $SERVICE_NAME -f"
echo "  - Bot stoppen:      sudo systemctl stop $SERVICE_NAME"
echo "  - Bot neustarten:   sudo systemctl restart $SERVICE_NAME"
echo "=================================================="
