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
        // --- AUTOMATIC UPDATES DISABLED ---
// const res = await fetch('https://raw.githubusercontent.com/Gamingpig/about-qa/main/version.json?_t=' + Date.now());
        const remote = await res.json();
        const local = await (await fetch('./version.json')).json();

        if (remote.version !== local.version) {
            statusDiv.innerText = "Update gefunden: v" + remote.version;
            statusDiv.style.color = "#f59e0b";
            
            // 1. Force Clear PWA Cache
            if ('caches' in window) {
                const cacheKeys = await caches.keys();
                await Promise.all(cacheKeys.map(key => caches.delete(key)));
            }

            // 2. Unregister Service Workers
            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations();
                await Promise.all(regs.map(r => r.unregister()));
            }

            // 3. Force Hard Reload
            window.location.replace(window.location.origin + window.location.pathname + '?v=' + Date.now());
        } else {
            statusDiv.innerText = "Dein System ist aktuell (v" + local.version + ")";
            statusDiv.style.color = "#10b981";
        }
    } catch(e) {
        statusDiv.innerText = "Update-Prüfung fehlgeschlagen.";
        statusDiv.style.color = "#ef4444";
    }
};
