// Happy or Sad's music: short pieces (4–8 s, melody + simple
// accompaniment) played in code on a piano-like tone. Every piece is
// public domain (composed long before 1929), traditional, or an original
// written for Ritmo; sources in lib/happyOrSad/CREDITS.md. Checked by
// scripts/check-happy-or-sad.ts (notes fit the key, bars add up, length,
// tempo ranges, credits).
//
// Notation, one string per voice (the melody first):
//   "G4:1"        a note and its length in beats (quarter notes)
//   "D3+F#3:2"    a chord
//   "r:0.5"       a rest
//   "1/3"         lengths may be fractions (triplets)
//   "|"           bar line (each bar must add up to the metre)
//   "B4!"         (Hard only) keep this note when the melody turns minor
//                 (the minor's raised 7th in a V chord)

export type Mode = "major" | "minor";
export type HappyOrSadLevel = "easy" | "medium" | "hard";

export interface Piece {
  id: string;
  title: string;
  // Composer and year, or "Traditional …", or "Original (Ritmo)".
  source: string;
  origin: "public-domain" | "traditional" | "original";
  // For pieces whose notes were read from a public-domain file.
  reference?: string;
  level: HappyOrSadLevel;
  mode: Mode;
  tonic: string; // e.g. "G", "C#", "Bb"
  beatsPerBar: number;
  bpm: number;
  // 0–1. Easy: happy pieces brighter and louder, sad ones softer. Medium
  // and Hard: one level for all, so loudness is never a clue.
  volume: number;
  // Medium: the pair this piece belongs to (same tempo and loudness).
  pair?: string;
  // Semitones to move the whole piece (an octave up for low writing).
  transpose?: number;
  voices: string[];
}

// Medium and Hard: one loudness for everything.
export const EVEN_VOLUME = 0.8;

// ---------------------------------------------------------------------------
// Easy: clearly happy (major, bright, quick) or clearly sad (minor, gentle,
// slow, soft).
// ---------------------------------------------------------------------------
const EASY: Piece[] = [
  {
    id: "eine-kleine",
    title: "Eine kleine Nachtmusik (opening)",
    source: "W. A. Mozart, 1787",
    origin: "public-domain",
    level: "easy",
    mode: "major",
    tonic: "G",
    beatsPerBar: 4,
    bpm: 132,
    volume: 1,
    voices: [
      "G4:1 r:0.5 D4:0.5 G4:1 r:0.5 D4:0.5 | G4:0.5 D4:0.5 G4:0.5 B4:0.5 D5:1 r:1 | C5:1 r:0.5 A4:0.5 C5:1 r:0.5 A4:0.5 | C5:0.5 A4:0.5 F#4:0.5 A4:0.5 D4:1 r:1",
      "G2+G3:1 r:1 G2+G3:1 r:1 | G2+B2+D3:1 r:1 G2+B2+D3:1 r:1 | D3+F#3+C4:1 r:1 D3+F#3+C4:1 r:1 | D3+F#3+A3:1 r:1 G2+G3:1 r:1",
    ],
  },
  {
    id: "spring",
    title: "Spring, from The Four Seasons (opening)",
    source: "A. Vivaldi, 1725",
    origin: "public-domain",
    level: "easy",
    mode: "major",
    tonic: "E",
    beatsPerBar: 4,
    bpm: 120,
    volume: 1,
    voices: [
      "G#4:1 G#4:1 G#4:1 F#4:0.5 E4:0.5 | B4:3 B4:0.5 A4:0.5 | G#4:1 G#4:1 G#4:1 F#4:0.5 E4:0.5 | B4:4",
      "E3:1 B3:1 E3:1 B3:1 | E3:1 B3:1 E3:1 B3:1 | E3:1 B3:1 E3:1 B3:1 | E3+B3+E4:4",
    ],
  },
  {
    // Replaces the William Tell gallop (not on the Mutopia Project).
    id: "surprise",
    title: "“Surprise” Symphony No. 94, Andante theme",
    source: "J. Haydn, 1791",
    origin: "public-domain",
    level: "easy",
    mode: "major",
    tonic: "C",
    beatsPerBar: 2,
    bpm: 108,
    volume: 1,
    voices: [
      "C5:0.5 C5:0.5 E5:0.5 E5:0.5 | G5:0.5 G5:0.5 E5:1 | F5:0.5 F5:0.5 D5:0.5 D5:0.5 | B4:0.5 B4:0.5 G4:1",
      "C3+G3:1 E3+G3:1 | C3+G3:1 E3+G3:1 | G2+F3:1 B2+F3:1 | G2+D3:1 G2+B2:1",
    ],
  },
  {
    // Replaces the Can-can (not on the Mutopia Project).
    id: "pop-weasel",
    title: "Pop Goes the Weasel",
    source: "Traditional English, 1850s",
    origin: "traditional",
    level: "easy",
    mode: "major",
    tonic: "C",
    beatsPerBar: 3,
    bpm: 150,
    volume: 1,
    voices: [
      "C5:1 C5:0.5 D5:1 D5:0.5 | E5:0.5 G5:0.5 E5:0.5 C5:1 G4:0.5 | C5:1 C5:0.5 D5:1 D5:0.5 | E5:1.5 C5:1.5",
      "C3+G3:1.5 G2+G3:1.5 | C3+G3:1.5 G2+G3:1.5 | G2+D3:1.5 B2+F3:1.5 | C3+G3:1.5 C2+C3:1.5",
    ],
  },
  {
    id: "sunny-hop",
    title: "Sunny Hop",
    source: "Original (Ritmo)",
    origin: "original",
    level: "easy",
    mode: "major",
    tonic: "D",
    beatsPerBar: 4,
    bpm: 144,
    volume: 1,
    voices: [
      "D5:0.5 F#5:0.5 A5:1 F#5:0.5 A5:0.5 D6:1 | B5:0.5 A5:0.5 G5:0.5 F#5:0.5 E5:2 | E5:0.5 G5:0.5 B5:1 A5:0.5 G5:0.5 F#5:1 | E5:0.5 F#5:0.5 E5:0.5 C#5:0.5 D5:2",
      "D3:1 A3:1 D3:1 A3:1 | G2:1 D3:1 A2:1 E3:1 | A2:1 E3:1 D3:1 A3:1 | A2:1 E3:1 D3+A3:2",
    ],
  },
  {
    // Replaces Skip to My Lou (folk versions differ too much to pick one).
    id: "hopscotch",
    title: "Hopscotch",
    source: "Original (Ritmo)",
    origin: "original",
    level: "easy",
    mode: "major",
    tonic: "F",
    beatsPerBar: 2,
    bpm: 132,
    volume: 1,
    voices: [
      "F4:0.5 A4:0.5 C5:0.5 A4:0.5 | F5:1 C5:1 | D5:0.5 C5:0.5 Bb4:0.5 A4:0.5 | G4:1 C5:1 | A4:0.5 Bb4:0.5 C5:0.5 G4:0.5 | F4:2",
      "F3:1 C3:1 | F3:1 A2:1 | Bb2:1 F3:1 | C3:1 E3:1 | F3:1 C3:1 | F2+C3:2",
    ],
  },
  // --- sad ---
  {
    id: "moonlight",
    title: "“Moonlight” Sonata, 1st movement (first bars)",
    source: "L. van Beethoven, 1801",
    origin: "public-domain",
    level: "easy",
    mode: "minor",
    tonic: "C#",
    beatsPerBar: 4,
    bpm: 60,
    volume: 0.55,
    voices: [
      "G#3:1/3 C#4:1/3 E4:1/3 G#3:1/3 C#4:1/3 E4:1/3 G#3:1/3 C#4:1/3 E4:1/3 G#3:1/3 C#4:1/3 E4:1/3 | G#3:1/3 C#4:1/3 E4:1/3 G#3:1/3 C#4:1/3 E4:1/3 G#3:1/3 C#4:1/3 E4:1/3 G#3:1/3 C#4:1/3 E4:1/3",
      "C#2+C#3:4 | B1+B2:4",
    ],
  },
  {
    id: "greensleeves",
    title: "Greensleeves",
    source: "Traditional English, 16th century",
    origin: "traditional",
    level: "easy",
    mode: "minor",
    tonic: "A",
    beatsPerBar: 3,
    bpm: 90,
    volume: 0.55,
    voices: [
      "C5:1 D5:0.5 E5:0.75 F#5:0.25 E5:0.5 | D5:1 B4:0.5 G4:0.75 A4:0.25 B4:0.5 | C5:1 A4:0.5 A4:0.75 G#4:0.25 A4:0.5 | B4:1 G#4:0.5 E4:1.5",
      "A2+E3:3 | G2+D3:3 | A2+E3:3 | E2+B2:3",
    ],
  },
  {
    // Notes read from the Mutopia Project's public-domain MIDI (first 2
    // bars: at the piece's slow tempo 4 bars would last 19 s; bars 1–2
    // are the opening phrase). Played an octave higher than written so
    // the low chords are clear on tablet speakers.
    id: "ase",
    title: "Åse's Death (Peer Gynt, Op. 46 No. 2)",
    source: "E. Grieg, 1875",
    origin: "public-domain",
    reference: "Mutopia Project, piece 246 (Kunkel Brothers, 1891), Public Domain",
    level: "easy",
    mode: "minor",
    tonic: "B",
    beatsPerBar: 4,
    bpm: 60,
    volume: 0.55,
    transpose: 12,
    voices: [
      "D3+F#3:1 F#3+B3:1 F#3+A#3+C#4:2 | D3+F#3:1 F#3+B3:1 F#3+A#3+C#4:2",
      "B1+B2:1 D2+B2:1 F#2+C#3:2 | B1+B2:1 D2+B2:1 F#2+C#3:2",
    ],
  },
  {
    // Replaces The Sick Doll (not on the Mutopia Project).
    id: "scarborough",
    title: "Scarborough Fair",
    source: "Traditional English",
    origin: "traditional",
    level: "easy",
    mode: "minor",
    tonic: "D",
    beatsPerBar: 3,
    bpm: 90,
    volume: 0.55,
    voices: [
      "D4:2 D4:1 | A4:2 A4:1 | E4:1.5 F4:0.5 E4:1 | D4:3",
      "D3+A3:3 | D3+A3:3 | C3+G3:3 | D3+A3:3",
    ],
  },
  {
    id: "rainy-window",
    title: "Rainy Window",
    source: "Original (Ritmo)",
    origin: "original",
    level: "easy",
    mode: "minor",
    tonic: "A",
    beatsPerBar: 3,
    bpm: 90,
    volume: 0.55,
    voices: [
      "E5:2 D5:1 | C5:2 B4:1 | A4:1 C5:1 B4:1 | A4:3",
      "A2+E3:3 | F2+C3:3 | E2+G#2+B2:3 | A2+E3:3",
    ],
  },
  {
    id: "lost-kitten",
    title: "Little Lost Kitten",
    source: "Original (Ritmo)",
    origin: "original",
    level: "easy",
    mode: "minor",
    tonic: "D",
    beatsPerBar: 4,
    bpm: 66,
    volume: 0.55,
    voices: ["A4:1 F4:1 E4:1 D4:1 | E4:1 C#4:1 D4:2", "D3+A3:2 Bb2+F3:2 | A2+E3:2 D3+A3:2"],
  },
];

// ---------------------------------------------------------------------------
// Medium: pairs of a major and a minor piece with the same tempo, loudness
// and texture (melody + bass), so the only clue is the mode.
// ---------------------------------------------------------------------------
const medium = (p: Omit<Piece, "level" | "volume" | "origin"> & { origin?: Piece["origin"] }): Piece => ({
  origin: "public-domain",
  ...p,
  level: "medium",
  volume: EVEN_VOLUME,
});

const MEDIUM: Piece[] = [
  medium({
    id: "minuet-g",
    pair: "M1",
    title: "Minuet in G (Notebook for Anna Magdalena Bach)",
    source: "C. Petzold, 1725",
    mode: "major",
    tonic: "G",
    beatsPerBar: 3,
    bpm: 104,
    voices: [
      "D5:1 G4:0.5 A4:0.5 B4:0.5 C5:0.5 | D5:1 G4:1 G4:1 | E5:1 C5:0.5 D5:0.5 E5:0.5 F#5:0.5 | G5:1 G4:1 G4:1",
      "G3:3 | B3:3 | C4:3 | B3:3",
    ],
  }),
  medium({
    // Notes read from the Mutopia Project's public-domain MIDI (bars 1–4).
    id: "minuet-g-minor",
    pair: "M1",
    title: "Minuet in G minor (Notebook for Anna Magdalena Bach)",
    source: "C. Petzold, 1725",
    reference: "Mutopia Project, piece 76 (BWV Anh. 115, Bach-Gesellschaft edition), Public Domain",
    mode: "minor",
    tonic: "G",
    beatsPerBar: 3,
    bpm: 104,
    voices: [
      "Bb5:1 A5:1 G5:1 | A5:1 D5:1 D5:1 | G5:1 G4:0.5 A4:0.5 Bb4:0.5 C5:0.5 | D5:3",
      "G3:3 | F3:3 | Eb3:3 | D3:1 D4:0.5 C4:0.5 Bb3:0.5 A3:0.5",
    ],
  }),
  medium({
    // Replaces Soldiers' March (on Mutopia only under Creative Commons).
    id: "old-macdonald",
    pair: "M2",
    title: "Old MacDonald Had a Farm",
    source: "Traditional",
    origin: "traditional",
    mode: "major",
    tonic: "G",
    beatsPerBar: 4,
    bpm: 120,
    voices: [
      "G4:1 G4:1 G4:1 D4:1 | E4:1 E4:1 D4:2 | B4:1 B4:1 A4:1 A4:1 | G4:3 r:1",
      "G2+D3:2 G2+D3:2 | C3+G3:2 G2+D3:2 | G2+D3:2 D3+A3:2 | G2+D3:3 r:1",
    ],
  }),
  medium({
    // Replaces The Wild Rider (on Mutopia only under Creative Commons).
    id: "mozart-40",
    pair: "M2",
    title: "Symphony No. 40 (opening)",
    source: "W. A. Mozart, 1788",
    mode: "minor",
    tonic: "G",
    beatsPerBar: 4,
    bpm: 120,
    voices: [
      "Eb5:0.5 D5:0.5 D5:1 Eb5:0.5 D5:0.5 D5:1 | Eb5:0.5 D5:0.5 D5:1 Bb5:2 | Bb5:0.5 A5:0.5 G5:1 G5:0.5 F5:0.5 Eb5:1 | Eb5:0.5 D5:0.5 C5:1 C5:2",
      "G2+D3:2 G2+D3:2 | G2+D3:2 G2+D3:2 | C3+G3:2 C3+G3:2 | D3+A3:2 D3+A3:2",
    ],
  }),
  medium({
    // Replaces Italian Song (not on the Mutopia Project).
    id: "yankee-doodle",
    pair: "M3",
    title: "Yankee Doodle",
    source: "Traditional, 18th century",
    origin: "traditional",
    mode: "major",
    tonic: "C",
    beatsPerBar: 2,
    bpm: 92,
    voices: [
      "C5:0.5 C5:0.5 D5:0.5 E5:0.5 | C5:0.5 E5:0.5 D5:0.5 G4:0.5 | C5:0.5 C5:0.5 D5:0.5 E5:0.5 | C5:1 B4:1",
      "C3:1 G2:1 | C3:1 G2:1 | C3:1 G2:1 | C3:1 G2:1",
    ],
  }),
  medium({
    // Notes read from the Mutopia Project's public-domain MIDI (bars 1–4).
    id: "old-french-song",
    pair: "M3",
    title: "Old French Song (Album for the Young, Op. 39 No. 16)",
    source: "P. I. Tchaikovsky, 1878",
    reference: "Mutopia Project, piece 2080 (Schirmer, 1904), Public Domain",
    mode: "minor",
    tonic: "G",
    beatsPerBar: 2,
    bpm: 92,
    voices: [
      "D4:0.5 G4:0.5 A4:0.5 Bb4:0.5 | C5:0.5 D5:1.5 | D5:0.5 C5:0.5 D5:0.5 Eb5:0.5 | C5:0.5 D5:1.5",
      "r:0.5 Bb3:0.5 C4:0.5 D4:0.5 | C4:0.5 Bb3:1.5 | r:0.5 Eb4:1 C4:0.5 | r:0.5 Bb3:1.5",
      "r:0.5 G3:1.5 | G3:2 | G3:2 | G3:2",
    ],
  }),
  medium({
    id: "lightly-row",
    pair: "M4",
    title: "Lightly Row (Hänschen klein)",
    source: "Traditional German",
    origin: "traditional",
    mode: "major",
    tonic: "G",
    beatsPerBar: 2,
    bpm: 100,
    voices: [
      "D5:0.5 B4:0.5 B4:1 | C5:0.5 A4:0.5 A4:1 | G4:0.5 A4:0.5 B4:0.5 C5:0.5 | D5:0.5 D5:0.5 D5:1",
      "G2+D3:1 G2+D3:1 | D3+A3:1 D3+A3:1 | G2+D3:1 G2+D3:1 | D3+A3:1 G2+D3:1",
    ],
  }),
  medium({
    id: "korobeiniki",
    pair: "M4",
    title: "Korobeiniki",
    source: "Traditional Russian, 1861",
    origin: "traditional",
    mode: "minor",
    tonic: "A",
    beatsPerBar: 2,
    bpm: 100,
    voices: [
      "E5:0.5 B4:0.25 C5:0.25 D5:0.5 C5:0.25 B4:0.25 | A4:0.5 A4:0.25 C5:0.25 E5:0.5 D5:0.25 C5:0.25 | B4:0.75 C5:0.25 D5:0.5 E5:0.5 | C5:0.5 A4:0.5 A4:1",
      "A2+E3:1 A2+E3:1 | A2+E3:1 A2+E3:1 | E2+B2:1 E2+B2:1 | A2+E3:1 A2+E3:1",
    ],
  }),
  medium({
    id: "sunny-steps",
    pair: "M5",
    title: "Sunny Steps",
    source: "Original (Ritmo)",
    origin: "original",
    mode: "major",
    tonic: "C",
    beatsPerBar: 4,
    bpm: 104,
    voices: [
      "C5:1 E5:1 G5:1 E5:1 | F5:1 D5:1 B4:1 G4:1 | C5:1 E5:0.5 D5:0.5 C5:2",
      "C3+G3:2 G2+D3:2 | F2+C3:2 G2+D3:2 | C3+G3:2 C2+G2:2",
    ],
  }),
  medium({
    id: "shadow-steps",
    pair: "M5",
    title: "Shadow Steps",
    source: "Original (Ritmo)",
    origin: "original",
    mode: "minor",
    tonic: "C",
    beatsPerBar: 4,
    bpm: 104,
    voices: [
      "G4:1 Eb5:1 D5:1 C5:1 | Ab4:1 C5:1 B4:1 G4:1 | C5:1 Eb5:0.5 D5:0.5 C5:2",
      "C3+G3:2 G2+D3:2 | F2+C3:2 G2+D3:2 | C3+G3:2 C2+G2:2",
    ],
  }),
];

// ---------------------------------------------------------------------------
// Hard: the SAME melody, sometimes major and sometimes minor, in different
// keys. Written here in C major; the minor version lowers the 3rd, 6th and
// 7th (natural minor), except notes marked "!" (the raised 7th in a V
// chord, as in harmonic minor). Same tempo and loudness either way.
// ---------------------------------------------------------------------------
export interface HardMelody {
  id: string;
  title: string;
  source: string;
  origin: "public-domain" | "traditional";
  beatsPerBar: number;
  bpm: number;
  voices: string[]; // in C major
}

export const HARD_MELODIES: HardMelody[] = [
  {
    id: "twinkle",
    title: "Twinkle, Twinkle, Little Star",
    source: "Traditional French (“Ah! vous dirai-je, maman”), 1761",
    origin: "traditional",
    beatsPerBar: 4,
    bpm: 120,
    voices: [
      "C4:1 C4:1 G4:1 G4:1 | A4:1 A4:1 G4:2 | F4:1 F4:1 E4:1 E4:1 | D4:1 D4:1 C4:2",
      "C3+E3+G3:2 C3+E3+G3:2 | F3+A3+C4:2 C3+E3+G3:2 | F3+A3+C4:2 C3+E3+G3:2 | G2+B2!+D3:2 C3+E3+G3:2",
    ],
  },
  {
    id: "frere-jacques",
    title: "Frère Jacques",
    source: "Traditional French",
    origin: "traditional",
    beatsPerBar: 4,
    bpm: 120,
    voices: [
      "C4:1 D4:1 E4:1 C4:1 | C4:1 D4:1 E4:1 C4:1 | E4:1 F4:1 G4:2 | E4:1 F4:1 G4:2",
      "C3+E3+G3:4 | C3+E3+G3:4 | C3+E3+G3:4 | C3+E3+G3:4",
    ],
  },
  {
    id: "ode-to-joy",
    title: "Ode to Joy (Symphony No. 9)",
    source: "L. van Beethoven, 1824",
    origin: "public-domain",
    beatsPerBar: 4,
    bpm: 120,
    voices: [
      "E4:1 E4:1 F4:1 G4:1 | G4:1 F4:1 E4:1 D4:1 | C4:1 C4:1 D4:1 E4:1 | E4:1.5 D4:0.5 D4:2",
      "C3+E3+G3:4 | G2+B2!+D3:4 | C3+E3+G3:4 | C3+E3+G3:2 G2+B2!+D3:2",
    ],
  },
  {
    id: "mary-lamb",
    title: "Mary Had a Little Lamb",
    source: "Traditional American, 1830s",
    origin: "traditional",
    beatsPerBar: 4,
    bpm: 120,
    voices: [
      "E4:1 D4:1 C4:1 D4:1 | E4:1 E4:1 E4:2 | D4:1 D4:1 D4:2 | E4:1 G4:1 G4:2",
      "C3+E3+G3:4 | C3+E3+G3:4 | G2+B2!+D3:4 | C3+E3+G3:4",
    ],
  },
  {
    id: "row-boat",
    title: "Row, Row, Row Your Boat",
    source: "Traditional, 1852",
    origin: "traditional",
    beatsPerBar: 3,
    bpm: 100,
    voices: [
      "C4:1.5 C4:1.5 | C4:1 D4:0.5 E4:1.5 | E4:1 D4:0.5 E4:1 F4:0.5 | G4:3",
      "C3+E3+G3:3 | C3+E3+G3:3 | C3+E3+G3:3 | C3+E3+G3:3",
    ],
  },
  {
    id: "london-bridge",
    title: "London Bridge Is Falling Down",
    source: "Traditional English",
    origin: "traditional",
    beatsPerBar: 4,
    bpm: 120,
    voices: [
      "G4:1.5 A4:0.5 G4:1 F4:1 | E4:1 F4:1 G4:2 | D4:1 E4:1 F4:2 | E4:1 F4:1 G4:2",
      "C3+E3+G3:4 | C3+E3+G3:4 | G2+B2!+D3:4 | C3+E3+G3:4",
    ],
  },
  {
    id: "brahms-lullaby",
    title: "Lullaby (Wiegenlied, Op. 49 No. 4)",
    source: "J. Brahms, 1868",
    origin: "public-domain",
    beatsPerBar: 3,
    bpm: 100,
    voices: [
      "E4:0.5 E4:0.5 G4:2 | E4:0.5 E4:0.5 G4:2 | E4:0.5 G4:0.5 C5:1 B4:1 | A4:1 A4:1 G4:1",
      "C3+E3+G3:3 | C3+E3+G3:3 | C3+E3+G3:3 | G2+B2!+D3:3",
    ],
  },
  {
    id: "au-clair",
    title: "Au clair de la lune",
    source: "Traditional French, 18th century",
    origin: "traditional",
    beatsPerBar: 4,
    bpm: 120,
    voices: [
      "C4:1 C4:1 C4:1 D4:1 | E4:2 D4:2 | C4:1 E4:1 D4:1 D4:1 | C4:4",
      "C3+E3+G3:4 | C3+E3+G3:2 G2+B2!+D3:2 | C3+E3+G3:2 G2+B2!+D3:2 | C3+E3+G3:4",
    ],
  },
];

// The keys Hard plays in (semitones from C; G, A and B♭ sit below C so
// every key stays in a comfortable range).
export const HARD_KEYS: { name: string; shift: number }[] = [
  { name: "C", shift: 0 },
  { name: "D", shift: 2 },
  { name: "Eb", shift: 3 },
  { name: "F", shift: 5 },
  { name: "G", shift: -5 },
  { name: "A", shift: -3 },
  { name: "Bb", shift: -2 },
];

// A Hard melody as a playable piece in one key and mode.
export function hardPiece(m: HardMelody, mode: Mode, key: { name: string; shift: number }): Piece {
  const toMinor = (voice: string) =>
    voice.replace(/\b([EAB])(\d)(!?)/g, (all, step: string, oct: string, keep: string) =>
      keep ? `${step}${oct}` : `${step}b${oct}`
    );
  return {
    id: `${m.id}-${mode}-${key.name}`,
    title: m.title,
    source: m.source,
    origin: m.origin,
    level: "hard",
    mode,
    tonic: key.name,
    beatsPerBar: m.beatsPerBar,
    bpm: m.bpm,
    volume: EVEN_VOLUME,
    transpose: key.shift,
    voices: (mode === "minor" ? m.voices.map(toMinor) : m.voices).map((v) => v.replace(/!/g, "")),
  };
}

export const PIECES: Piece[] = [...EASY, ...MEDIUM];

export function piecesFor(level: Exclude<HappyOrSadLevel, "hard">): Piece[] {
  return PIECES.filter((p) => p.level === level);
}

// ---------------------------------------------------------------------------
// Reading the notation
// ---------------------------------------------------------------------------
const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteMidi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note "${name}"`);
  return 12 * (Number(m[3]) + 1) + STEP[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
}

export function pitchClass(name: string): number {
  return ((STEP[name[0]] + (name[1] === "#" ? 1 : name[1] === "b" ? -1 : 0)) % 12 + 12) % 12;
}

export interface PieceNote {
  midi: number;
  start: number; // beats
  beats: number;
  voice: number;
}

export interface ParsedVoice {
  notes: PieceNote[];
  bars: number[]; // each bar's length in beats
  length: number;
}

function parseDur(s: string): number {
  if (s.includes("/")) {
    const [a, b] = s.split("/").map(Number);
    return a / b;
  }
  return Number(s);
}

export function parseVoice(voice: string, index: number, transpose = 0): ParsedVoice {
  const notes: PieceNote[] = [];
  const bars: number[] = [];
  let t = 0;
  let barStart = 0;
  for (const tok of voice.trim().split(/\s+/)) {
    if (tok === "|") {
      bars.push(t - barStart);
      barStart = t;
      continue;
    }
    const [pitch, dur] = tok.split(":");
    const beats = parseDur(dur);
    if (!(beats > 0)) throw new Error(`bad length in "${tok}"`);
    if (pitch !== "r") {
      for (const n of pitch.split("+")) notes.push({ midi: noteMidi(n.replace("!", "")) + transpose, start: t, beats, voice: index });
    }
    t += beats;
  }
  bars.push(t - barStart);
  return { notes, bars, length: t };
}

export interface ParsedPiece {
  notes: PieceNote[];
  beats: number;
  seconds: number;
}

export function parsePiece(p: Piece): ParsedPiece {
  const voices = p.voices.map((v, i) => parseVoice(v, i, p.transpose ?? 0));
  const beats = Math.max(...voices.map((v) => v.length));
  return { notes: voices.flatMap((v) => v.notes), beats, seconds: (beats * 60) / p.bpm };
}

// Scale steps allowed in each mode, as semitones above the tonic. Minor
// allows the natural minor plus the raised 6th and 7th (harmonic and
// melodic minor), as real minor-key music uses them.
export const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
export const MINOR_STEPS = [0, 2, 3, 5, 7, 8, 10, 9, 11];
