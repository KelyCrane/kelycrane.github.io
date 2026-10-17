# Built-in piano scores
Original MIDI files are from the Mutopia Project. See CREDITS.json for each exact source URL, composer, maintainer, edition ID, original SHA-256, and license.

The original and JSON conversion of Chopin's Nocturne Op.9 No.2 (Mutopia 1590), maintained by Renato Biolcati Rinaldi, are distributed under Creative Commons Attribution-ShareAlike 3.0 Unported: https://creativecommons.org/licenses/by-sa/3.0/ and https://creativecommons.org/licenses/by-sa/3.0/legalcode . The license applies to that music data independently of the website's software.

The nine other listed editions are marked Public Domain by Mutopia. Attribution is retained in CREDITS.json and on the website credits page.

Conversion by KelyCrane's blog using @tonejs/midi: notes and CC64 sustain data are converted to seconds using the original tempo map. Sound-release times are computed from sustain events. No notes are transposed or dropped, and no third-party recording is included. Converted music data retains the original edition's license.

Regenerate with npm run import:music. The source/*.mid files remain unmodified; scores/*.json are loaded from this site only when selected for playback. Piano sample attribution is separately provided in audio/piano/CREDITS.txt.