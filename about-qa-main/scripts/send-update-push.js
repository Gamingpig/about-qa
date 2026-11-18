const fs = require('fs');
const path = require('path');
const webPush = require('web-push');

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BItv0vIf2FPn11TcGv_5Nyp1YHE4c6e7lYHWRONDnGL-ca7EPMbD_DlzkMlB_InZEVJEFASPhkMwOLnPRRxfX-w';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'cS5HGxWt9nsqWNAs_7ljuydLqf8D9uqkYh1WRkM3X8Q';
const VAPID_SUBJECT = 'mailto:support@gamingpig.de';

webPush.setVapidDetails(
    VAPID_SUBJECT,
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

const SUBSCRIBERS_FILE = path.join(__dirname, '..', 'data', 'subscribers.json');

async function sendNotificationToAll() {
    let subscribers = [];
    try {
        if (fs.existsSync(SUBSCRIBERS_FILE)) {
            subscribers = JSON.parse(fs.readFileSync(SUBSCRIBERS_FILE, 'utf8') || '[]');
        }
    } catch(e) {
        console.error('Error loading subscribers:', e.message);
    }

    const payload = {
        title: '🎯 Update v24.152.0 Live – Gamingpig',
        body: 'Onboarding-Autostart & zurücksetzbarer Status-Counter sind jetzt live!',
        broadcastId: 'update_v24_148_0_' + Date.now(),
        url: 'https://gamingpig.github.io/About-Gamingpig/release.html',
        timestamp: Date.now()
    };

    console.log(`📡 Sending Web Push to ${subscribers.length} subscriber(s)...`);

    const promises = subscribers.map(async (sub, idx) => {
        try {
            const pushSub = {
                endpoint: sub.endpoint,
                keys: sub.keys
            };
            await webPush.sendNotification(pushSub, JSON.stringify(payload));
            console.log(`✓ Device #${idx + 1} notified successfully!`);
        } catch(err) {
            console.warn(`✗ Device #${idx + 1} push failed:`, err.statusCode || err.message);
        }
    });

    await Promise.allSettled(promises);

    // Also dispatch to ntfy.sh topics
    const ntfyTopics = [
        'gamingpig_push_sub_vault_9f8a2b3c4d5e',
        'gamingpig_status'
    ];

    for (const topic of ntfyTopics) {
        try {
            await fetch(`https://ntfy.sh/${topic}`, {
                method: 'POST',
                headers: {
                    'Title': 'Gamingpig v24.152.0 Update Live',
                    'Priority': 'default',
                    'Tags': 'tada,rocket',
                    'Click': 'https://gamingpig.github.io/About-Gamingpig/release.html'
                },
                body: 'Onboarding-Autostart & zurücksetzbarer Status-Counter sind jetzt live!'
            });
            console.log(`✓ Dispatched to ntfy topic: ${topic}`);
        } catch(e) {
            console.warn(`Could not dispatch to ntfy ${topic}:`, e.message);
        }
    }
}

sendNotificationToAll().then(() => {
    console.log('✅ Push notification dispatch completed!');
}).catch(console.error);
