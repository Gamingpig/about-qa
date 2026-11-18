'use strict';

module.exports = async function setup({ github, context }) {
    const repo = context.repo;
    for (const [name, color, description] of [
        ['roadmap-feature', '8957e5', 'Portfolio-Feature: Stimmen als 👍 am ersten Beitrag'],
        ['community-wish', 'db61a2', 'Öffentlicher Wunsch aus dem Portfolio']
    ]) {
        try { await github.rest.issues.getLabel({ ...repo, name }); }
        catch (error) {
            if (error.status !== 404) throw error;
            await github.rest.issues.createLabel({ ...repo, name, color, description });
        }
    }
    const titles = [
        'Echtzeit Kartbahn Telemetrie & Live-Tracker',
        'KI-DJ & Nahtlose 3D Audio-Transitionen',
        'Community Mini-Game (Retro Arcade)',
        'Interaktive Widgets für iOS & Android Homescreen',
        'Community Discord Synchronized Listening Room',
        'Eigene KI-Stimmen für Songtext-Vorlesen'
    ];
    const issues = await github.paginate(github.rest.issues.listForRepo, {
        ...repo, labels: 'roadmap-feature', state: 'all', per_page: 100
    });
    for (const [index, title] of titles.entries()) {
        const prefix = `[Roadmap #${index + 1}]`;
        if (issues.some(issue => !issue.pull_request && issue.title.startsWith(prefix))) continue;
        await github.rest.issues.create({
            ...repo, title: `${prefix} ${title}`, labels: ['roadmap-feature'],
            body: '## Abstimmen / Vote\n\n' +
                'Reagiere auf **diesen ersten Beitrag** mit 👍, um abzustimmen. ' +
                'Ein erneuter Klick auf deine 👍-Reaktion zieht deine Stimme zurück. ' +
                'Mit demselben GitHub-Konto gilt deine Stimme auf allen Geräten.\n\n' +
                'React to **this first post** with 👍 to vote; click your reaction again to undo. ' +
                'The portfolio reads the shared count automatically.\n\n' +
                'Bitte den `[Roadmap #…]`-Titelanfang und das Label `roadmap-feature` beibehalten.'
        });
    }
};
