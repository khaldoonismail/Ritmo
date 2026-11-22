# Piano samples: credits

The piano notes in every Ritmo game (Note Reading, Note Runner, Up or Down,
Piano Hop, Happy or Sad) are played from recordings of a real piano:

**Salamander Grand Piano** by **Alexander Holm**
(a Yamaha C5 grand, recorded with two AKG C414 microphones),
licensed under the
[Creative Commons Attribution 3.0 Unported licence (CC BY 3.0)](https://creativecommons.org/licenses/by/3.0/).
The licence allows use for any purpose, commercial included, with credit.

- Original sample set: <https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html>
  (also <https://archive.org/details/SalamanderGrandPianoV3>)
- Files taken from the MP3 subset hosted by the Tone.js project:
  <https://github.com/Tonejs/audio/tree/master/salamander>
  (credited there to Alexander Holm, CC BY 3.0). Downloaded 2026-11-22.

## Changes made for Ritmo

As CC BY 3.0 asks, these changes are noted here:

- Only 22 notes are kept, one every 3 semitones from A1 to C7
  (`v1/A1.mp3` … `v1/C7.mp3`); the notes between are played by
  speeding the nearest recording up or down by at most 1.5 semitones.
- Each file was mixed down to mono, cut to 4 seconds with a 1-second fade
  at the end, evened out in loudness (the same RMS level over the first
  0.6 seconds, so no note sounds louder than another), its hammer attack
  limited to −9 dBFS (so notes never clip when played louder) and
  re-encoded as 64 kbps MP3.
- Playback corrects each recording's small tuning offset (the piano's
  natural "stretch" tuning, up to 23.5 cents at C7), so every note is
  exact equal temperament, A4 = 440 Hz.

The Salamander Grand Piano's author does not endorse Ritmo.
