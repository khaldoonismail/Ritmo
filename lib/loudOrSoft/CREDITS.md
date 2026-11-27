# Sleepy Town (Loud or Soft): music credits

Every tune in Sleepy Town is one of:

- **public domain**: composed long before 1929 by a composer who died
  long ago;
- **traditional**: a folk or children's song with no known author;
- **original**: written for Ritmo.

Each is a two-bar excerpt in a simple arrangement written for Ritmo (the
melody plus an accompaniment on every beat), played in the browser with
Web Audio on recorded piano samples (Salamander Grand Piano by Alexander
Holm, CC BY 3.0; see `public/sounds/piano/CREDITS.md`). Louder notes are
also brighter (a low-pass filter that opens with the level), like a real
piano. No recordings of the pieces and no modern edition's arrangement
are used. Nothing in the game is Hebrew or Israeli.

The same melody is played at different dynamics; the tempo (96–116 beats
a minute) and the key (C, or up to 2 semitones down or 3 up) are picked
at random whatever the answer. Each question starts with the tune's own
opening at mezzo-forte as a reference.

The notes are in `lib/loudOrSoft/music.ts`; `npm run check:loud-or-soft`
checks them, and that every tune below is listed here.

| Tune | id | Origin |
|---|---|---|
| Twinkle, Twinkle, Little Star | twinkle | Traditional French (“Ah! vous dirai-je, maman”), 1761 |
| Frère Jacques | frere-jacques | Traditional French |
| Ode to Joy (Symphony No. 9) | ode-to-joy | L. van Beethoven, 1824 |
| Au clair de la lune | au-clair | Traditional French, 18th century |
| Mary Had a Little Lamb | mary-lamb | Traditional American, 1830s |
| London Bridge Is Falling Down | london-bridge | Traditional English |
| Lullaby (Wiegenlied, Op. 49 No. 4) | brahms-lullaby | J. Brahms, 1868 |
| Sleepy Town | sleepy-town | Original (Ritmo) |
| Night Parade | night-parade | Original (Ritmo) |

The volume step plays Twinkle, Twinkle, Little Star at mezzo-forte.
