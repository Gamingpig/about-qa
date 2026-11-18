'use strict';
const fs = require('node:fs');
const path = require('node:path');
const protocol = require('../js/roadmap-protocol.js');
const FILE = path.join(__dirname, '../data/roadmap.json');

function emptyState() {
    return { schema: 1, updatedAt: null, votes: Object.fromEntries([1, 2, 3, 4, 5, 6].map(id => [id, 0])), voters: {}, wishes: [], deletedWishIds: [] };
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
            state.wishes.push({ id: p.id, voter, author: p.author.trim(), category: p.category.trim(),
                title: p.title.trim(), desc: p.desc.trim(), date: new Date(item.time * 1000).toISOString() });
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
    const response = await fetch(`${protocol.QUEUE}/json?poll=1&since=all`, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Roadmap queue: HTTP ${response.status}`);
    const text = await response.text();
    if (Buffer.byteLength(text) > 8 * 1024 * 1024) throw new Error('Queue response exceeds import limit');
    const messages = text.split('\n').filter(Boolean).flatMap(line => {
        try { return [JSON.parse(line)]; } catch (_) { return []; }
    });
    if (await ingest(state, messages)) {
        fs.mkdirSync(path.dirname(FILE), { recursive: true });
        fs.writeFileSync(FILE + '.tmp', JSON.stringify(state, null, 2) + '\n');
        fs.renameSync(FILE + '.tmp', FILE);
        console.log('Roadmap updated.');
    } else console.log('No new valid roadmap events.');
}
if (require.main === module) main().catch(error => { console.error(error.message); process.exitCode = 1; });
module.exports = { emptyState, ingest };
