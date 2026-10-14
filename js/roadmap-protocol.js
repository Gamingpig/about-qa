/* Shared, dependency-free browser/Actions protocol. Only signs user actions. */
(function (root, factory) {
    if (typeof module === 'object' && module.exports) module.exports = factory(require('node:crypto').webcrypto);
    else root.RoadmapProtocol = factory(root.crypto);
})(typeof window !== 'undefined' ? window : globalThis, function (crypto) {
    'use strict';
    const TOPIC = 'gamingpig_roadmap_v1_6e924bc83d';
    const QUEUE = `https://ntfy.sh/${TOPIC}`;
    const encode = value => new TextEncoder().encode(value);
    const hex = bytes => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
    const unhex = text => new Uint8Array(text.match(/../g).map(x => parseInt(x, 16)));
    const algorithm = { name: 'ECDSA', namedCurve: 'P-256' };
    async function identity() {
        const pair = await crypto.subtle.generateKey(algorithm, true, ['sign', 'verify']);
        return { publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey),
            privateKey: await crypto.subtle.exportKey('jwk', pair.privateKey) };
    }
    async function voterId(publicKey) {
        return hex(await crypto.subtle.digest('SHA-256', encode(`${publicKey.x}.${publicKey.y}`)));
    }
    function valid(payload) {
        if (!payload || payload.v !== 1 || !/^[0-9a-f-]{36}$/.test(payload.id)) return false;
        if (payload.type === 'vote') return Number.isSafeInteger(payload.revision) && payload.revision > 0 &&
            Array.isArray(payload.features) && payload.features.length <= 6 &&
            new Set(payload.features).size === payload.features.length &&
            payload.features.every(id => Number.isInteger(id) && id >= 1 && id <= 6);
        if (payload.type !== 'wish') return false;
        if (![['author', 60], ['category', 60], ['title', 100], ['desc', 500]].every(([key, limit]) =>
            typeof payload[key] === 'string' && payload[key].trim().length > 0 && payload[key].length <= limit)) return false;
        if (payload.parentWishId !== undefined && payload.parentWishId !== null) {
            if (typeof payload.parentWishId !== 'string' || payload.parentWishId.length > 50) return false;
        }
        if (payload.parentWishTitle !== undefined && payload.parentWishTitle !== null) {
            if (typeof payload.parentWishTitle !== 'string' || payload.parentWishTitle.length > 100) return false;
        }
        return true;
    }
    async function sign(keys, data) {
        const payload = { ...data, v: 1, id: data.id || crypto.randomUUID() };
        if (payload.parentWishId !== undefined && payload.parentWishId !== null) {
            payload.parentWishId = String(payload.parentWishId).trim();
            if (!payload.parentWishId) delete payload.parentWishId;
        }
        if (payload.parentWishTitle !== undefined && payload.parentWishTitle !== null) {
            payload.parentWishTitle = String(payload.parentWishTitle).trim();
            if (!payload.parentWishTitle) delete payload.parentWishTitle;
        }
        if (!valid(payload)) throw new Error('Invalid roadmap entry');
        const key = await crypto.subtle.importKey('jwk', keys.privateKey, algorithm, false, ['sign']);
        const message = JSON.stringify(payload);
        const signature = hex(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encode(message)));
        // Do not transmit private key material, even if an imported public JWK contains extra fields.
        const publicKey = { kty: 'EC', crv: 'P-256', x: keys.publicKey.x, y: keys.publicKey.y };
        const envelope = { message, signature, publicKey };
        if (encode(JSON.stringify(envelope)).length > 4000) throw new Error('Entry too large');
        return envelope;
    }
    async function verify(envelope) {
        if (!envelope || typeof envelope.message !== 'string' || envelope.message.length > 3000 ||
            !/^[a-f0-9]{128}$/.test(envelope.signature) || envelope.publicKey?.d ||
            envelope.publicKey?.crv !== 'P-256' || envelope.publicKey?.kty !== 'EC') return null;
        try {
            const payload = JSON.parse(envelope.message);
            if (!valid(payload)) return null;
            const key = await crypto.subtle.importKey('jwk', envelope.publicKey, algorithm, false, ['verify']);
            if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key,
                unhex(envelope.signature), encode(envelope.message))) return null;
            return { payload, voter: await voterId(envelope.publicKey) };
        } catch (_) { return null; }
    }
    return { TOPIC, QUEUE, identity, voterId, sign, verify };
});
