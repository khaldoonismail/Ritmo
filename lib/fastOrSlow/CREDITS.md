# Music Train (Fast or Slow): music credits

Every tune in Music Train is one of:

- **public domain**: composed long before 1929 by a composer who died
  long ago;
- **traditional**: a folk or children's song with no known author;
- **original**: written for Ritmo.

Each is a two-bar excerpt in a simple arrangement written for Ritmo (the
melody plus an accompaniment on every beat), played in the browser with
Web Audio on recorded piano samples (Salamander Grand Piano by Alexander
Holm, CC BY 3.0; see `public/sounds/piano/CREDITS.md`). No recordings of
the pieces and no modern edition's arrangement are used. Nothing in the
game is Hebrew or Israeli.

The notes are in `lib/fastOrSlow/music.ts`; `npm run check:fast-or-slow`
checks them, and that every tune below is listed here.

## Melodies (Easy and Medium, and Hard's getting faster / slower)

The same melody is played at different tempos; the key is picked at
random (C, or up to 2 semitones down or 3 up) whatever the answer.

| Tune | id | Origin |
|---|---|---|
| Twinkle, Twinkle, Little Star | twinkle | Traditional French (“Ah! vous dirai-je, maman”), 1761 |
| Frère Jacques | frere-jacques | Traditional French |
| Ode to Joy (Symphony No. 9) | ode-to-joy | L. van Beethoven, 1824 |
| Mary Had a Little Lamb | mary-lamb | Traditional American, 1830s |
| Hot Cross Buns | hot-cross-buns | Traditional English, 18th century |
| London Bridge Is Falling Down | london-bridge | Traditional English |
| Lullaby (Wiegenlied, Op. 49 No. 4) | brahms-lullaby | J. Brahms, 1868 |
| Choo-Choo Tune | choo-choo | Original (Ritmo) |
| The Little Engine | little-engine | Original (Ritmo) |

## Hard: trap pieces

Busy tunes (many quick notes) played slowly, and calm tunes (only long
notes) played fast, so the child has to follow the beat, not count notes.

| Tune | id | Kind | Origin |
|---|---|---|---|
| Busy Bee | busy-bee | many short notes, slow (Largo) | Original (Ritmo) |
| Raindrop Run | raindrop-run | many short notes, slow (Largo) | Original (Ritmo) |
| Sleepy Giant | sleepy-giant | long notes, fast (Presto) | Original (Ritmo) |
| Long Clouds | long-clouds | long notes, fast (Presto) | Original (Ritmo) |
