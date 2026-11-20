// Records every word as a small MP3 in audio/, so the site can play the same Swedish voice on every device, with a soft
// fade at the end instead of the pop some speech engines make. Words already recorded are skipped, so after adding words
// to db/ only the new ones are recorded; app.js reads any word without a recording with the device's own voice.
//
// The voice is Piper's sv_SE NST voice, run in the browser by the sås-image app (D:\Dev\sås-image), which must be
// running its dev server on http://localhost:5173 (npm run dev there). Needs ffmpeg on the PATH and Playwright from
// that project:
//
//   node tools/record-words.cjs [--only=3] [--force]

const { chromium } = require('D:/Dev/sås-image/node_modules/@playwright/test');
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'audio');
const APP = 'http://localhost:5173/';
const VOICE = 'nst';
const SPEED = 1;
const MARGIN_S = 0.02; // kept before the first and after the last audible sample
const FADE_IN_S = 0.005;
const FADE_OUT_S = 0.03;
const TAIL_S = 0.06; // silence after the fade
const PEAK = 0.9; // every word brought to the same loudest point (Piper's own level is quiet and varies)

// Same as audioName() in app.js.
function audioName(word) {
    let hash = 0x811c9dc5;
    for (const char of word.normalize('NFC')) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

async function words() {
    const lists = await Promise.all(['sports', 'nouns'].map(async (name) => {
        const source = fs.readFileSync(path.join(ROOT, 'db', `${name}.js`), 'utf8');
        return (await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`)).default;
    }));
    return [...new Set(lists.flat())];
}

// Trims the silence Piper leaves around a word, then fades both ends so the sound starts and stops at zero.
function shape(samples, rate) {
    const loud = (x) => Math.abs(x) > 0.01;
    const first = samples.findIndex(loud);
    const last = samples.findLastIndex(loud);
    if (first < 0) throw new Error('silent recording');
    const start = Math.max(0, first - Math.round(MARGIN_S * rate));
    const end = Math.min(samples.length, last + 1 + Math.round(MARGIN_S * rate));
    const out = new Float32Array(end - start + Math.round(TAIL_S * rate));
    out.set(samples.subarray(start, end));
    const fadeIn = Math.round(FADE_IN_S * rate);
    const fadeOut = Math.round(FADE_OUT_S * rate);
    const length = end - start;
    const gain = PEAK / out.reduce((peak, x) => Math.max(peak, Math.abs(x)), 0);
    for (let i = 0; i < length; i++) out[i] *= gain;
    for (let i = 0; i < fadeIn; i++) out[i] *= i / fadeIn;
    for (let i = 0; i < fadeOut; i++) out[length - 1 - i] *= i / fadeOut;
    return out;
}

function encode(samples, rate, file) {
    const result = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y',
        '-f', 'f32le', '-ar', String(rate), '-ac', '1', '-i', 'pipe:0',
        '-c:a', 'libmp3lame', '-q:a', '5', file], { input: Buffer.from(samples.buffer) });
    if (result.status !== 0) throw new Error(result.stderr.toString());
}

(async () => {
    const only = Number((process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1]) || Infinity;
    const force = process.argv.includes('--force');
    fs.mkdirSync(OUT, { recursive: true });
    const todo = (await words())
        .filter((word) => force || !fs.existsSync(path.join(OUT, `${audioName(word)}.mp3`)))
        .slice(0, only);
    console.log(`${todo.length} words to record`);
    if (!todo.length) return;

    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(APP);
    await page.waitForSelector('body[data-ready="1"]', { timeout: 120000 });

    const started = Date.now();
    for (const [i, word] of todo.entries()) {
        const { data, rate } = await page.evaluate(async ([text, voice, speed]) => {
            const speech = await window.synthesize(text, voice, speed);
            return { data: Array.from(speech.samples), rate: speech.sampleRate };
        }, [word, VOICE, SPEED]);
        encode(shape(Float32Array.from(data), rate), rate, path.join(OUT, `${audioName(word)}.mp3`));
        if ((i + 1) % 25 === 0 || i + 1 === todo.length) {
            console.log(`${i + 1}/${todo.length} (${Math.round((Date.now() - started) / 1000)} s)`);
        }
    }
    await browser.close();
})().catch((error) => {
    console.error(error);
    process.exit(1);
});
