'use strict';
// Publish only public files. Content hashes let old HTML keep using its matching JS.
const fs = require('node:fs');
const path = require('node:path');
const { createHash, createPrivateKey, createPublicKey } = require('node:crypto');
const root = path.join(__dirname, '..');
const out = path.join(root, '_site');
const manifest = {};
function walk(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
function write(name, data) {
    const target = path.join(out, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, data);
}
fs.mkdirSync(out, { recursive: true });
for (const file of walk(path.join(root, 'js'))) {
    const relative = path.relative(root, file).replaceAll('\\', '/');
    let data = fs.readFileSync(file);
    if (relative === 'js/core/push-config.js') {
        const vapid = process.env.VAPID_PUBLIC_KEY || '';
        let registration = process.env.PUSH_REGISTRATION_PUBLIC_KEY || '';
        if (!registration && process.env.PUSH_REGISTRATION_PRIVATE_KEY) {
            registration = JSON.stringify(createPublicKey(createPrivateKey(process.env.PUSH_REGISTRATION_PRIVATE_KEY)).export({ format: 'jwk' }));
        }
        registration ||= 'null';
        if (!vapid || registration === 'null') console.warn('Push public keys missing: registration UI will stay disabled.');
        data = Buffer.from(data.toString('utf8')
            .replace("vapidPublicKey: ''", `vapidPublicKey: ${JSON.stringify(vapid)}`)
            .replace('registrationPublicKey: null', `registrationPublicKey: ${registration}`));
    }
    const hash = createHash('sha256').update(data).digest('hex').slice(0, 16);
    manifest[relative] = relative.replace(/\.js$/, `.${hash}.js`);
    write(manifest[relative], data);
}
function rewrite(text) {
    for (const [source, target] of Object.entries(manifest)) {
        text = text.replace(new RegExp(source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\?v=[^\\s\'"<>]+)?', 'g'), target);
    }
    return text;
}
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isFile() || !(/\.(html|png|jpg|jpeg|webp|svg|ico)$/.test(entry.name) || ['manifest.json', 'CNAME', 'robots.txt', 'sitemap.xml'].includes(entry.name))) continue;
    const data = fs.readFileSync(path.join(root, entry.name));
    write(entry.name, entry.name.endsWith('.html') ? rewrite(data.toString('utf8')) : data);
}
write('sw.js', rewrite(fs.readFileSync(path.join(root, 'sw.js'), 'utf8')));
for (const name of ['roadmap.json', 'push-summary.json', 'glass-config.json']) {
    const file = path.join(root, 'data', name);
    if (fs.existsSync(file)) write('data/' + name, fs.readFileSync(file));
}
if (fs.existsSync(path.join(root, 'assets'))) for (const file of walk(path.join(root, 'assets'))) write(path.relative(root, file), fs.readFileSync(file));
if (fs.existsSync(path.join(root, '.well-known'))) for (const file of walk(path.join(root, '.well-known'))) write(path.relative(root, file), fs.readFileSync(file));
write('asset-manifest.json', JSON.stringify(manifest, null, 2));
console.log(`Public website built: ${out}`);
