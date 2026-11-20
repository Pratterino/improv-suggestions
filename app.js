import sports from './db/sports.js';
import nouns from './db/nouns.js';

const LANGUAGE = 'sv-SE';
const COLLECTION = [...new Set([...sports, ...nouns])];
const STOP_FADE_S = 0.015; // a word cut off by the next one fades out this fast instead of clicking
const ICONS = {
    sound: '<svg class="icon"><use href="#icon-sound"/></svg>',
    mute: '<svg class="icon"><use href="#icon-mute"/></svg>',
};

const synth = window.speechSynthesis;
const list = document.getElementById('suggestions');
const muteButton = document.getElementById('mute');

let words = [];
let count = 1;
let muted = false;
let swedishVoice = null;

let audio = null; // the AudioContext, made on first use
let playing = null; // { source, gain } of the word being read
let speechId = 0; // the latest speak(); an older one still loading gives up
const recordings = new Map(); // word -> Promise<AudioBuffer | null>

// The recording's file name, made by tools/record-words.cjs: an FNV-1a hash of the word.
function audioName(word) {
    let hash = 0x811c9dc5;
    for (const char of word.normalize('NFC')) {
        hash ^= char.codePointAt(0);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
}

function audioContext() {
    if (!audio && window.AudioContext) {
        audio = new AudioContext();
        // Plays even with the iPhone's silent switch on, like speech did.
        if (navigator.audioSession) navigator.audioSession.type = 'playback';
    }
    return audio;
}

// The word's recording, or null when there is none (it is then read with the device's own voice).
function recording(word) {
    if (!recordings.has(word)) {
        const context = audioContext();
        recordings.set(word, !context ? Promise.resolve(null) : fetch(`audio/${audioName(word)}.mp3`)
            .then((response) => (response.ok ? response.arrayBuffer() : null))
            .then((data) => (data ? context.decodeAudioData(data) : null))
            .catch(() => null));
    }
    return recordings.get(word);
}

function stopSpeaking() {
    synth?.cancel();
    if (!playing) return;
    const { source, gain } = playing;
    const now = audio.currentTime;
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(0, now + STOP_FADE_S);
    source.stop(now + STOP_FADE_S);
    playing = null;
}

async function speak(word) {
    const id = ++speechId;
    stopSpeaking();
    const context = audioContext();
    // Resumed right away, while the click still counts as the user's: Safari plays nothing otherwise.
    const resumed = context?.resume().catch(() => undefined);
    const buffer = await recording(word);
    if (id !== speechId) return;
    if (!buffer) {
        speakWithDevice(word);
        return;
    }
    await resumed;
    // Without a click the page may not play sound yet; then the word is skipped rather than read later.
    if (id !== speechId || context.state !== 'running') return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    source.connect(gain).connect(context.destination);
    source.onended = () => {
        if (playing?.source === source) playing = null;
    };
    source.start();
    playing = { source, gain };
}

function speakWithDevice(word) {
    if (!synth) return;
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = LANGUAGE;
    utterance.voice = swedishVoice;
    synth.speak(utterance);
}

// Voices load asynchronously, and some browsers write the language as sv_SE.
function updateVoice() {
    const swedish = synth.getVoices().filter((voice) => voice.lang.replace('_', '-').toLowerCase().startsWith('sv'));
    swedishVoice = swedish.find((voice) => voice.localService) ?? swedish[0] ?? null;
}

// Picks words that are not listed in `avoid`, so a new word never repeats a shown one.
function pickWords(amount, avoid) {
    const taken = new Set(avoid);
    const picked = [];
    while (picked.length < amount) {
        const word = COLLECTION[Math.floor(Math.random() * COLLECTION.length)];
        if (!taken.has(word)) {
            taken.add(word);
            picked.push(word);
        }
    }
    return picked;
}

function render() {
    list.dataset.count = String(words.length);
    list.replaceChildren(...words.map((word) => {
        recording(word); // loaded ahead, so a click plays at once
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'word';
        button.textContent = word;
        button.addEventListener('click', () => speak(word));
        const item = document.createElement('li');
        item.append(button);
        return item;
    }));
}

function renderMuteButton() {
    muteButton.classList.toggle('inactive', muted);
    muteButton.innerHTML = muted ? `${ICONS.sound} Aktivera röst` : `${ICONS.mute} Inaktivera röst`;
    // With several words nothing is read automatically, so there is nothing to mute.
    muteButton.hidden = count > 1;
}

function newSuggestions() {
    words = pickWords(count, words);
    render();
    if (count === 1 && !muted) speak(words[0]);
}

// Keeps the words already shown when the count changes, and reads nothing.
function setCount(newCount) {
    count = newCount;
    words = words.length > count
        ? words.slice(0, count)
        : [...words, ...pickWords(count - words.length, words)];
    render();
    renderMuteButton();
}

document.getElementById('statistics').textContent = `(${COLLECTION.length} st ord)`;
document.getElementById('new').addEventListener('click', newSuggestions);
muteButton.addEventListener('click', () => {
    muted = !muted;
    renderMuteButton();
});
document.querySelectorAll('input[name="count"]').forEach((input) => {
    input.addEventListener('change', () => setCount(Number(input.value)));
});

if (synth) {
    updateVoice();
    synth.addEventListener('voiceschanged', updateVoice);
}

renderMuteButton();
newSuggestions();
