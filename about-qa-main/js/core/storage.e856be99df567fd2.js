/* Preferences only: cryptographic identities and the admin vault require durable storage. */
(function (root) {
    'use strict';
    function createStorage(name) {
        const changed = new Map();
        let cleared = false;
        return {
            getItem(key) {
                key = String(key);
                if (changed.has(key)) return changed.get(key);
                if (cleared) return null;
                try { return root[name].getItem(key); } catch (_) { return null; }
            },
            setItem(key, value) {
                key = String(key); value = String(value);
                try { root[name].setItem(key, value); if (cleared) changed.set(key, value); else changed.delete(key); }
                catch (_) { changed.set(key, value); }
            },
            removeItem(key) {
                key = String(key);
                try { root[name].removeItem(key); changed.delete(key); }
                catch (_) { changed.set(key, null); }
            },
            clear() {
                changed.clear();
                try { root[name].clear(); } catch (_) { cleared = true; }
            },
            keys() {
                let keys = [];
                try { if (!cleared) keys = Object.keys(root[name]); } catch (_) {}
                return [...new Set([...keys, ...changed.keys()])].filter(key => this.getItem(key) !== null);
            },
            key(index) { return this.keys()[index] ?? null; },
            get length() { return this.keys().length; }
        };
    }
    root.AppStorage = createStorage('localStorage');
    root.AppSession = createStorage('sessionStorage');
})(window);
