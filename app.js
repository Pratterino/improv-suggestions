import sports from './db/sports.js';
import nouns from './db/nouns.js';

const LANGUAGE = 'sv-SE';
const COLLECTION = [...new Set([...sports, ...nouns])];
const ICONS = {
    sound: '<svg class="icon"><use href="#icon-sound"/></svg>',
    mute: '<svg class="icon"><use href="#icon-mute"/></svg>',
};

const synth = window.speechSynthesis;
const list = document.getElementById('suggestions');
const muteButton = document.getElementById('mute');
const voiceNote = document.getElementById('voice-note');

let words = [];
let count = 1;
let muted = false;
let swedishVoice = null;

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

function speak(word) {
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = LANGUAGE;
    utterance.voice = swedishVoice;
    utterance.volume = 1;
    synth.speak(utterance);
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

// Voices load asynchronously, and some browsers write the language as sv_SE.
function updateVoice() {
    const voices = synth.getVoices();
    const swedish = voices.filter((voice) => voice.lang.replace('_', '-').toLowerCase().startsWith('sv'));
    swedishVoice = swedish.find((voice) => voice.localService) ?? swedish[0] ?? null;
    voiceNote.hidden = voices.length === 0 || swedishVoice !== null;
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
} else {
    voiceNote.hidden = false;
    voiceNote.textContent = 'Den här webbläsaren kan inte läsa upp ord.';
}

renderMuteButton();
newSuggestions();
