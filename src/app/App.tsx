import React, {useEffect, useState} from 'react';
import {faRedo, faVolumeMute, faVolumeUp} from '@fortawesome/free-solid-svg-icons'
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome'

import sports from './../db/sports';
import nouns from "../db/nouns";
import './App.scss';

const synth = window.speechSynthesis;
const collection = Array.from(new Set([
    ...sports,
    ...nouns,
]));

function App() {
    const [suggestion, setSuggestion] = useState('');
    const [muted, setMuted] = useState(false);

    const setRandomSuggestion = () => {
        setSuggestion(collection[Math.random() * collection.length >> 0]);
    };

    useEffect(() => {
        setRandomSuggestion();
    }, []);

    useEffect(() => {
        speak(suggestion, {force: false});
    }, [suggestion]);

    function speak(word: string, {force = false}) {
        synth.cancel();
        const utterThis = new SpeechSynthesisUtterance(word);
        utterThis.volume = 1;
        (!muted || force) && synth.speak(utterThis);
    }

    return (
        <div className="container">
            <div className="suggestion__statistics">
                ({collection.length} st ord)
            </div>
            <div className="suggestion-container">
                <h1 onClick={() => speak(suggestion, {force: true})}>{suggestion}</h1>
            </div>
            <div className="suggestion-container__buttons">
                <button onClick={setRandomSuggestion}><FontAwesomeIcon icon={faRedo}/> Nytt förslag
                </button>
                <button
                    className={muted ? 'inactive' : ''}
                    onClick={() => setMuted(!muted)}>{muted ? <><FontAwesomeIcon icon={faVolumeUp}/> Aktivera
                    röst</> : <><FontAwesomeIcon icon={faVolumeMute}/> Inaktivera röst</>}</button>
            </div>
        </div>
    )
}


export default App;
