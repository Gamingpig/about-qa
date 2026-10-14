/* Fixed legacy password verifier; token encryption still uses the entered password. */
(function (root) {
    'use strict';
    const STORAGE_KEY = 'gamingpig_admin_vault_v4';
    const PREVIOUS_KEY = 'gamingpig_admin_vault_v3';
    const AUTH_SALT = "gamingpig_status_push_salt_2026";
    const AUTH_HASH = "a14370f4bac2464358ee34ec6fe9313c9e3b5bf0728e7b4359eb409d8e7f8116";
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
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(passphrase + AUTH_SALT));
            const computed = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
            if (computed !== AUTH_HASH) {
                const error = new Error('Falsches Admin-Passwort.');
                error.name = 'OperationError';
                throw error;
            }
            // A local v3 record is never an authentication authority.
            const stored = localStorage.getItem(STORAGE_KEY);
            const previous = stored ? null : localStorage.getItem(PREVIOUS_KEY);
            record = stored ? JSON.parse(stored) : { version: 4, salt: encode(crypto.getRandomValues(new Uint8Array(16))) };
            if (record.version !== 4 || record.salt.length !== 16) throw new Error('Ungültiger Tresor.');
            const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
            key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', iterations: 310000, salt: new Uint8Array(record.salt) }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
            try {
                if (stored) {
                    if (await open(record.check) !== 'gamingpig-vault-v4') throw new Error('Falsche Passphrase.');
                } else {
                    record.check = await seal('gamingpig-vault-v4');
                    // Migrate only if the previous token was encrypted with this same,
                    // already verified admin password. Otherwise preserve v3 untouched.
                    if (previous) {
                        try {
                            const old = JSON.parse(previous);
                            if (old.version !== 3 || old.salt.length !== 16) throw new Error('Invalid previous vault');
                            const oldKey = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', iterations: 310000, salt: new Uint8Array(old.salt) }, material, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
                            const decodeOld = async value => new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(value.iv) }, oldKey, new Uint8Array(value.data)));
                            if (await decodeOld(old.check) === 'gamingpig-vault-v3' && old.token) record.token = await seal(await decodeOld(old.token));
                        } catch (_) { /* Different old local password: re-enter PAT after login. */ }
                    }
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
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
