# Improv suggestions
This is a simple word suggestion site which gives you or your improv group 1-3 word suggestions from a growing catalogue of words. 
Swedish only! words are from https://zdb.se/

Live at https://pratterino.github.io/improv-suggestions/

Plain HTML, CSS and JavaScript with no build step. GitHub Pages serves the master branch as it is.
To run it locally, serve the folder with any static server, since JavaScript modules do not load from file:// URLs.

## Voice
Every word is read from its own recording in `audio/` (Piper's Swedish NST voice), so it sounds the same on every device.
A word without a recording is read by the device's own voice instead. After adding words to `db/`, record the new ones
with `node tools/record-words.cjs`; the comment at the top of that file says what it needs.
