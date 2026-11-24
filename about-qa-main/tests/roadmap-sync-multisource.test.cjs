'use strict';
const { test, describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { emptyState, mergeState, ingest } = require('../scripts/sync-roadmap.cjs');

describe('Roadmap Multi-Source Sync & Voter Loss Prevention', () => {
    it('mergeState merges voters without data loss, keeping highest revision', () => {
        const stateA = {
            schema: 1,
            updatedAt: '2026-09-09T10:00:00.000Z',
            votes: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0, 6: 1 },
            voters: {
                'voter-1': { revision: 100, features: [2], eventId: 'e-1' },
                'voter-2': { revision: 200, features: [6], eventId: 'e-2' }
            },
            wishes: [{ id: 'w-1', title: 'Wish 1', author: 'A', category: 'C', desc: 'D', date: '2026-09-09T10:00:00.000Z' }],
            deletedWishIds: []
        };

        const stateB = {
            schema: 1,
            updatedAt: '2026-11-24T10:00:00.000Z',
            votes: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1 },
            voters: {
                'voter-1': { revision: 150, features: [2, 3], eventId: 'e-1-new' },
                'voter-3': { revision: 300, features: [6], eventId: 'e-3' }
            },
            wishes: [
                { id: 'w-2', title: 'Wish 2', author: 'B', category: 'C', desc: 'D', date: '2026-11-24T10:00:00.000Z' }
            ],
            deletedWishIds: []
        };

        const changed = mergeState(stateA, stateB);
        assert.equal(changed, true);

        // voter-1 updated to revision 150 with features [2, 3]
        assert.equal(stateA.voters['voter-1'].revision, 150);
        assert.deepEqual(stateA.voters['voter-1'].features, [2, 3]);

        // voter-2 preserved (revision 200, [6])
        assert.equal(stateA.voters['voter-2'].revision, 200);

        // voter-3 added (revision 300, [6])
        assert.equal(stateA.voters['voter-3'].revision, 300);

        // Vote tallies:
        // feature 2 has voter-1 (1 vote)
        // feature 3 has voter-1 (1 vote)
        // feature 6 has voter-2 and voter-3 (2 votes!)
        assert.equal(stateA.votes['2'], 1);
        assert.equal(stateA.votes['3'], 1);
        assert.equal(stateA.votes['6'], 2);

        // Both wishes preserved
        assert.equal(stateA.wishes.length, 2);
        assert.ok(stateA.wishes.some(w => w.id === 'w-1'));
        assert.ok(stateA.wishes.some(w => w.id === 'w-2'));
    });

    it('data/roadmap.json contains all 7 voters including both feature 6 votes', () => {
        const file = path.join(__dirname, '../data/roadmap.json');
        const data = JSON.parse(fs.readFileSync(file, 'utf8'));

        assert.equal(data.schema, 1);
        const voterKeys = Object.keys(data.voters);
        assert.equal(voterKeys.length, 7, 'Must preserve all 7 known voters');

        // Verify the user vote (28fb1a...) and dce1cd... both vote for feature 6
        const userVoter = data.voters['28fb1a2292cce5d87515e9702f9b0f70fb3c203d2392f9503a9be8254a1b755e'];
        const secondVoter = data.voters['dce1cd1ce306fdd56ea6cf84ad2bdb8b27f53dd30a0cead90dc60023843b19db'];

        assert.ok(userVoter, 'User voter must exist');
        assert.ok(secondVoter, 'Second voter must exist');
        assert.ok(userVoter.features.includes(6), 'User voted for feature 6');
        assert.ok(secondVoter.features.includes(6), 'Second voter voted for feature 6');
        assert.equal(data.votes['6'], 2, 'Feature 6 must have exactly 2 votes');
    });

    it('client github-roadmap.6d5d949a55d29080.js defines multi-source fallback including local data', () => {
        const clientJs = fs.readFileSync(path.join(__dirname, '../js/github-roadmap.6d5d949a55d29080.js'), 'utf8');
        assert.match(clientJs, /DATA_URLS\s*=\s*\[/);
        assert.match(clientJs, /\.\/data\/roadmap\.json/);
        assert.match(clientJs, /Promise\.allSettled/);
        assert.match(clientJs, /mergeRemoteStates/);
    });

    it('roadmap-sync.yml includes recurring schedule cron trigger', () => {
        const yml = fs.readFileSync(path.join(__dirname, '../.github/workflows/roadmap-sync.yml'), 'utf8');
        assert.match(yml, /schedule:\s*-\s*cron:/);
    });
});
