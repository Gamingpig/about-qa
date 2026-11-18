/* The key exists only in memory while unlocked. No password or verifier in source. */
(function (root) {
    'use strict';
    const STORAGE_KEY = 'gamingpig_admin_vault_v3';
    const encode = value => Array.from(new Uint8Array(value));
    let key = null;
    let record = null;
    async function seal(value) {
        if (!key) throw new Error('Tresor ist gesperrt.');
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(value));
        return { iv: encode(iv), data: encode(data) };
    }
    async function open(value) {
        if (!key) throw new Error('Tresor ist gesperrt.');
        return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(value.iv) }, key, new Uint8Array(value.data)));
    }
    root.AdminVault = {
        async unlock(passphrase) {
            this.lock();
            const stored = localStorage.getItem(STORAGE_KEY);
            if (!stored && passphrase.length < 14) throw new Error('Neue lokale Tresor-Passphrase: mindestens 14 Zeichen.');
            record = stored ? JSON.parse(stored) : { version: 3, salt: encode(crypto.getRandomValues(new Uint8Array(16))) };
            if (record.version !== 3 || record.salt.length !== 16) throw new Error('Ungültiger Tresor.');
            const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
            key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', iterations: 310000, salt: new Uint8Array(record.salt) }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
            try {
                if (stored) {
                    if (await open(record.check) !== 'gamingpig-vault-v3') throw new Error('Falsche Passphrase.');
                } else {
                    record.check = await seal('gamingpig-vault-v3');
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
                    for (const legacy of ['gamingpig_gh_pat_enc', 'gamingpig_gh_pat', 'gh_admin_pat_v2']) localStorage.removeItem(legacy);
                }
            } catch (error) { this.lock(); throw error; }
        },
        lock() { key = null; record = null; },
        async getToken() { return record?.token ? open(record.token) : ''; },
        async setToken(token) {
            if (!key || !record) throw new Error('Tresor ist gesperrt.');
            const next = { ...record, token: token ? await seal(token) : null };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            record = next;
        }
    };
})(window);
