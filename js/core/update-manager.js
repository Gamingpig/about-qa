/** 
 * Update Manager v1.0 
 * Handhabt die manuelle Suche nach System-Updates
 */
window.checkManualUpdates = async function() {
    const statusDiv = document.getElementById('settings-update-status');
    if (!statusDiv) return;

    statusDiv.innerText = "Prüfe GitHub für Updates...";
    statusDiv.style.color = "#3b82f6";

    try {
        // Fetch remote version.json directly from GitHub raw
        const res = await fetch('https://raw.githubusercontent.com/Gamingpig/about-qa/main/version.json?_t=' + Date.now());
        const remote = await res.json();
        const local = await (await fetch('./version.json')).json();

        if (remote.version !== local.version) {
            statusDiv.innerText = "Update gefunden: v" + remote.version;
            statusDiv.style.color = "#f59e0b";
            // Trigger the global whatsnew overlay if it exists
            if (typeof triggerWhatsNew === 'function') {
                triggerWhatsNew();
            }
        } else {
            statusDiv.innerText = "Dein System ist aktuell (v" + local.version + ")";
            statusDiv.style.color = "#10b981";
        }
    } catch(e) {
        statusDiv.innerText = "Update-Prüfung fehlgeschlagen.";
        statusDiv.style.color = "#ef4444";
    }
};
