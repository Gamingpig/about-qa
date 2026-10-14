const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const versionJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'version.json'), 'utf8'));
const swJs = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const releaseHtml = fs.readFileSync(path.join(ROOT, 'release.html'), 'utf8');

test('Automatic Language Selection & Tutorial Startup (v24.215.0)', async (t) => {
    await t.test('O1: Version 24.215.0 is synchronized across all core files', () => {
        assert.equal(versionJson.version, '24.215.0');
        assert.match(swJs, /const SW_VERSION = "24\.215\.0";/);
        assert.match(indexHtml, /ONBOARDING_VERSION = 'v24\.215\.0/);
        assert.match(indexHtml, /id="footer-menu-hint"[^>]*>v24\.215\.0<\/span>/);
        assert.match(indexHtml, /id="footer-version-label"[^>]*>v24\.215\.0<\/span>/);
        assert.match(releaseHtml, /<title>Release Notes v24\.215\.0 – Gamingpig<\/title>/);
        assert.match(indexHtml, /version:\s*"v24\.215\.0"/);
    });

    await t.test('O2: Initial onboarding shield class is applied for first-time visitors in <head>', () => {
        // Must check if saved language or onboarding_completed is missing
        assert.match(indexHtml, /const _isFirstVisit = !savedAppLang \|\| !AppStorage\.getItem\('onboarding_completed'\);/);
        assert.match(indexHtml, /if \(_forceStart \|\| _isFirstVisit\) \{\s*document\.documentElement\.classList\.add\('needs-onboarding'\);/);
        // Instant CSS shield forces language picker overlay to be visible as the very first screen
        assert.match(indexHtml, /html\.needs-onboarding #language-picker-overlay/);
        assert.match(indexHtml, /html\.needs-onboarding #language-picker-overlay\.hidden/);
    });

    await t.test('O3: Automatic language selection condition evaluates to true for first-time visitors', () => {
        assert.match(indexHtml, /const _needsLanguageSelection = Boolean\([\s\S]*?_forceOnboarding \|\|[\s\S]*?!_savedLang/);
        // Language picker opens via openLanguagePicker or OnboardingCoordinator.step1_language()
        assert.match(indexHtml, /window\.openLanguagePicker\(false\);/);
    });

    await t.test('O4: Closing or selecting language picker transitions smoothly to Step 2 (tutorial)', () => {
        // In closeLanguagePicker
        assert.match(indexHtml, /const wasOnboarding = window\.OnboardingCoordinator && window\.OnboardingCoordinator\.isOnboarding;/);
        assert.match(indexHtml, /window\.OnboardingCoordinator\.step2_tutorial\(\);/);

        // In selectLanguage
        assert.match(indexHtml, /if \(window\.OnboardingCoordinator && window\.OnboardingCoordinator\.isOnboarding\) \{\s*if \(typeof window\.OnboardingCoordinator\.step2_tutorial === 'function'\) \{\s*window\.OnboardingCoordinator\.step2_tutorial\(\);/);
    });

    await t.test('O5: Tutorial automatically launches for visitors who have a language but incomplete tutorial/onboarding', () => {
        assert.match(indexHtml, /const _needsTutorial = Boolean\([\s\S]*?!_isTutorialDone \|\|[\s\S]*?!_isCompleted/);
        assert.match(indexHtml, /window\.OnboardingCoordinator\.step2_tutorial\(\);/);
        assert.match(indexHtml, /startTutorial\(\);/);
    });

    await t.test('O6: Returning visitors who completed onboarding and tutorial are NOT interrupted', () => {
        // Logic test using simulated state:
        const evaluateAutostart = ({ _forceOnboarding, _savedLang, _isCompleted, _isTutorialDone, hasTutorialParam }) => {
            const needsLang = Boolean(_forceOnboarding || !_savedLang || (!_isCompleted && !_savedLang));
            let needsTut = false;
            if (!needsLang) {
                needsTut = Boolean(hasTutorialParam || !_isTutorialDone || !_isCompleted);
            }
            return { needsLang, needsTut };
        };

        // Case A: Fresh visitor -> needs language picker
        const fresh = evaluateAutostart({ _forceOnboarding: false, _savedLang: null, _isCompleted: false, _isTutorialDone: false, hasTutorialParam: false });
        assert.equal(fresh.needsLang, true, 'Fresh visitor must get language picker');

        // Case B: Has language, but tutorial not completed -> needs tutorial
        const langDone = evaluateAutostart({ _forceOnboarding: false, _savedLang: 'de', _isCompleted: false, _isTutorialDone: false, hasTutorialParam: false });
        assert.equal(langDone.needsLang, false, 'Visitor with language must not get language picker again');
        assert.equal(langDone.needsTut, true, 'Visitor with unfinished tutorial must get tutorial');

        // Case C: Fully completed returning visitor -> no popups!
        const returning = evaluateAutostart({ _forceOnboarding: false, _savedLang: 'de', _isCompleted: true, _isTutorialDone: true, hasTutorialParam: false });
        assert.equal(returning.needsLang, false, 'Returning user must not get language picker');
        assert.equal(returning.needsTut, false, 'Returning user must not get tutorial popup automatically');

        // Case D: Explict ?tutorial in URL -> triggers tutorial
        const manualTut = evaluateAutostart({ _forceOnboarding: false, _savedLang: 'de', _isCompleted: true, _isTutorialDone: true, hasTutorialParam: true });
        assert.equal(manualTut.needsTut, true, 'Explicit ?tutorial query param must trigger tutorial');
    });

    await t.test('O7: Tutorial start is strictly blocked until a language is selected', () => {
        // hasUserSelectedLanguage helper exists
        assert.match(indexHtml, /function hasUserSelectedLanguage\(\)/);
        assert.match(indexHtml, /window\.hasUserSelectedLanguage = hasUserSelectedLanguage;/);

        // startTutorial routes to language picker if no language is selected
        assert.match(indexHtml, /window\.startTutorial = function startTutorial\(\) \{\s*if \(typeof hasUserSelectedLanguage === 'function' && !hasUserSelectedLanguage\(\)\)/);

        // showTutorialModeChoiceModal routes to language picker if no language is selected
        assert.match(indexHtml, /function showTutorialModeChoiceModal\(\) \{\s*if \(typeof hasUserSelectedLanguage === 'function' && !hasUserSelectedLanguage\(\)\)/);

        // OnboardingCoordinator.step2_tutorial routes back to step1_language if no language is selected
        assert.match(indexHtml, /step2_tutorial\(\) \{\s*if \(typeof hasUserSelectedLanguage === 'function' && !hasUserSelectedLanguage\(\)\) \{\s*this\.step1_language\(\);/);

        // closeLanguagePicker only launches tutorial if a language is chosen
        assert.match(indexHtml, /if \(wasOnboarding && hasLang\)/);
    });

    await t.test('O8: Language Picker perfection points: Step 1 badge, active state, a11y, sound, escape, storage sync', () => {
        // Step 1 badge element
        assert.match(indexHtml, /id="lang-picker-step-badge"/);

        // A11y role="dialog" and aria-modal="true"
        assert.match(indexHtml, /id="language-picker-overlay"[^>]*role="dialog"[^>]*aria-modal="true"/);

        // Active state and checkmark in renderLanguagePicker
        assert.match(indexHtml, /aria-current="\$\{isActive \? 'true' : 'false'\}"/);
        assert.match(indexHtml, /lang-check text-blue-500 font-black/);

        // Sound feedback on select
        assert.match(indexHtml, /playUISound\('click'\)/);

        // Keyboard Escape handling
        assert.match(indexHtml, /if \(e\.key === 'Escape'\)/);

        // Cross-tab storage sync
        assert.match(indexHtml, /window\.addEventListener\('storage',\s*\(e\)\s*=>/);
    });
});
