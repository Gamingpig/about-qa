'use strict';
const fs = require('node:fs');
const path = require('node:path');
const protocol = require('../js/roadmap-protocol.js');
const FILE = path.join(__dirname, '../data/roadmap.json');
const ALT_FILE = path.join(__dirname, '../about-qa-main/data/roadmap.json');

const PEER_URLS = [
    'https://raw.githubusercontent.com/Gamingpig/About-Gamingpig/main/data/roadmap.json',
    'https://raw.githubusercontent.com/Gamingpig/about-qa/main/data/roadmap.json'
];

function emptyState() {
    return { schema: 1, updatedAt: null, votes: Object.fromEntries([1, 2, 3, 4, 5, 6].map(id => [id, 0])), voters: {}, wishes: [], deletedWishIds: [] };
}

function mergeState(target, source) {
    if (!source || source.schema !== 1 || !source.voters || !Array.isArray(source.wishes)) return false;
    let changed = false;
    for (const [voter, vData] of Object.entries(source.voters)) {
        if (!vData || typeof vData.revision !== 'number' || !Array.isArray(vData.features)) continue;
        if (!target.voters[voter] || (target.voters[voter].revision || 0) < vData.revision) {
            target.voters[voter] = {
                revision: vData.revision,
                features: [...vData.features].filter(f => Number.isInteger(f) && f >= 1 && f <= 6).sort(),
                eventId: vData.eventId || ''
            };
            changed = true;
        }
    }
    const wishMap = new Map(target.wishes.map(w => [w.id, w]));
    const deleted = new Set([...(target.deletedWishIds || []), ...(source.deletedWishIds || [])]);
    target.deletedWishIds = [...deleted];

    for (const wish of source.wishes) {
        if (!wish || !wish.id || deleted.has(wish.id)) continue;
        if (!wishMap.has(wish.id)) {
            target.wishes.push(wish);
            wishMap.set(wish.id, wish);
            changed = true;
        }
    }
    if (changed) {
        target.votes = emptyState().votes;
        for (const voter of Object.values(target.voters)) {
            for (const id of voter.features) target.votes[id] = (target.votes[id] || 0) + 1;
        }
        target.wishes.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
        if (source.updatedAt && (!target.updatedAt || new Date(source.updatedAt) > new Date(target.updatedAt))) {
            target.updatedAt = source.updatedAt;
        }
    }
    return changed;
}

async function ingest(state, messages) {
    let changed = false;
    const wishes = new Set([...state.wishes.map(w => w.id), ...(state.deletedWishIds || [])]);
    for (const item of messages) {
        if (item.event !== 'message' || item.topic !== protocol.TOPIC || typeof item.message !== 'string' ||
            Buffer.byteLength(item.message) > 4096 || !Number.isFinite(item.time)) continue;
        let envelope;
        try { envelope = JSON.parse(item.message); } catch (_) { continue; }
        const verified = await protocol.verify(envelope);
        if (!verified) continue;
        const { payload: p, voter } = verified;
        if (p.type === 'vote') {
            if ((state.voters[voter]?.revision || 0) >= p.revision) continue;
            state.voters[voter] = { revision: p.revision, features: p.features, eventId: p.id };
        } else {
            if (wishes.has(p.id)) continue;
            const wishItem = { id: p.id, voter, author: p.author.trim(), category: p.category.trim(),
                title: p.title.trim(), desc: p.desc.trim(), date: new Date(item.time * 1000).toISOString() };
            if (p.parentWishId) wishItem.parentWishId = p.parentWishId;
            if (p.parentWishTitle) wishItem.parentWishTitle = p.parentWishTitle;
            state.wishes.push(wishItem);
            wishes.add(p.id);
        }
        changed = true;
    }
    if (changed) {
        state.votes = emptyState().votes;
        for (const voter of Object.values(state.voters)) for (const id of voter.features) state.votes[id]++;
        state.wishes.sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
        state.updatedAt = new Date().toISOString();
    }
    return changed;
}

async function main() {
    // Never reset existing votes if the stored file is invalid.
    const state = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : emptyState();
    if (state.schema !== 1 || !state.voters || !Array.isArray(state.wishes)) throw new Error('Invalid roadmap state');
    let changed = false;

    // Merge upstream/peer repositories first so historical votes and cross-repo wishes are never lost
    for (const peerUrl of PEER_URLS) {
        try {
            const peerRes = await fetch(peerUrl + '?t=' + Date.now(), { signal: AbortSignal.timeout(10000) });
            if (peerRes.ok) {
                const peerData = await peerRes.json();
                if (mergeState(state, peerData)) {
                    changed = true;
                    console.log(`Merged peer roadmap data from ${peerUrl}`);
                }
            }
        } catch (e) {
            // Peer fetch is best-effort
        }
    }

    const response = await fetch(`${protocol.QUEUE}/json?poll=1&since=all`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Roadmap queue: HTTP ${response.status}`);
    const text = await response.text();
    if (Buffer.byteLength(text) > 8 * 1024 * 1024) throw new Error('Queue response exceeds import limit');
    const messages = text.split('\n').filter(Boolean).flatMap(line => {
        try { return [JSON.parse(line)]; } catch (_) { return []; }
    });
    if (await ingest(state, messages)) {
        changed = true;
    }

    if (changed) {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE + '.tmp', JSON.stringify(state, null, 2) + '\n');
        fs.renameSync(FILE + '.tmp', FILE);
        if (fs.existsSync(ALT_FILE)) {
            fs.writeFileSync(ALT_FILE + '.tmp', JSON.stringify(state, null, 2) + '\n');
            fs.renameSync(ALT_FILE + '.tmp', ALT_FILE);
        }
        console.log('Roadmap updated.');
    } else console.log('No new valid roadmap events.');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { emptyState, ingest, mergeState };
