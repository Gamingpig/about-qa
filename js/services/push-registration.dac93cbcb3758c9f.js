(function (root) {
    'use strict';
    const b64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
    root.PushRegistration = {
        async register(subscription, lang) {
            const config = root.PushConfig;
            if (!config?.registrationPublicKey || !config.vapidPublicKey) throw new Error('Push wird gewartet: neue Schlüssel müssen eingerichtet werden.');
            const value = typeof subscription.toJSON === 'function' ? subscription.toJSON() : subscription;
            const publicKey = await crypto.subtle.importKey('jwk', config.registrationPublicKey, { name: 'RSA-OAEP', hash: 'SHA-256' }, false, ['encrypt']);
            const aes = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aes, new TextEncoder().encode(JSON.stringify({ endpoint: value.endpoint, keys: value.keys, lang, registeredAt: Date.now() })));
            const wrapped = await crypto.subtle.encrypt('RSA-OAEP', publicKey, await crypto.subtle.exportKey('raw', aes));
            const message = JSON.stringify({ v: 2, key: b64(wrapped), iv: b64(iv), data: b64(data) });
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);
            try {
                const response = await fetch(config.queueUrl, { method: 'POST', body: message, signal: controller.signal });
                if (!response.ok) throw new Error('Push-Registrierung fehlgeschlagen: ' + response.status);
                const receipt = await response.json();
                if (receipt.message !== message) throw new Error('Push-Registrierung nicht bestätigt.');
                return true; // Queue receipt; activation follows the GitHub Actions import.
            } finally { clearTimeout(timeout); }
        }
    };
})(window);
