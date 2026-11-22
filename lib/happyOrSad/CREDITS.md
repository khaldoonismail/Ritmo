# Happy or Sad: music credits

Every piece in Happy or Sad is one of:

- **public domain**: composed long before 1929 by a composer who died
  long ago;
- **traditional**: a folk or children's song with no known author;
- **original**: written for Ritmo.

Each is a short excerpt (4–8 seconds) in a simple arrangement written for
Ritmo: the melody plus a light accompaniment, played in the browser with
Web Audio. No recordings are used, and no modern edition's arrangement is
copied.

Three pieces were checked note by note against public-domain MIDI files
from the [Mutopia Project](https://www.mutopiaproject.org), all marked
"Copyright: Public Domain". The reference files are kept locally in
`music-sources/` and are not part of the app. The notes are in
`lib/happyOrSad/pieces.ts`, and `npm run check:happy-or-sad` checks them.

## Easy: clearly happy or clearly sad

| Piece | Composer / origin | Mode | Notes |
|---|---|---|---|
| Eine kleine Nachtmusik (opening) | W. A. Mozart, 1787 | Major (G) | |
| Spring, from The Four Seasons (opening) | A. Vivaldi, 1725 | Major (E) | |
| “Surprise” Symphony No. 94, Andante theme | J. Haydn, 1791 | Major (C) | Replaces the William Tell gallop (not on Mutopia) |
| Pop Goes the Weasel | Traditional English, 1850s | Major (C) | Replaces the Can-can (not on Mutopia) |
| Sunny Hop | Original (Ritmo) | Major (D) | |
| Hopscotch | Original (Ritmo) | Major (F) | Replaces Skip to My Lou (its folk versions differ too much) |
| “Moonlight” Sonata, 1st movement (first bars) | L. van Beethoven, 1801 | Minor (C♯) | |
| Greensleeves | Traditional English, 16th century | Minor (A) | |
| Åse's Death (Peer Gynt, Op. 46 No. 2) | E. Grieg, 1875 | Minor (B) | Notes from Mutopia piece 246 (Kunkel Brothers, 1891), first 2 bars, an octave up |
| Scarborough Fair | Traditional English | Minor (D, Dorian) | Replaces The Sick Doll (not on Mutopia) |
| Rainy Window | Original (Ritmo) | Minor (A) | |
| Little Lost Kitten | Original (Ritmo) | Minor (D) | |

## Medium: major and minor pairs, same tempo and loudness

| Pair | Major | Minor | Tempo |
|---|---|---|---|
| M1 | Minuet in G (Notebook for Anna Magdalena Bach), C. Petzold, 1725 | Minuet in G minor (Notebook for Anna Magdalena Bach), C. Petzold, 1725. Notes from Mutopia piece 76 (BWV Anh. 115, Bach-Gesellschaft edition), bars 1–4 | 104 |
| M2 | Old MacDonald Had a Farm, traditional (replaces Soldiers' March, which is only on Mutopia under Creative Commons) | Symphony No. 40 (opening), W. A. Mozart, 1788 (replaces The Wild Rider, which is only on Mutopia under Creative Commons) | 120 |
| M3 | Yankee Doodle, traditional, 18th century (replaces Italian Song, not on Mutopia) | Old French Song (Album for the Young, Op. 39 No. 16), P. I. Tchaikovsky, 1878. Notes from Mutopia piece 2080 (Schirmer, 1904), bars 1–4 | 92 |
| M4 | Lightly Row (Hänschen klein), traditional German | Korobeiniki, traditional Russian, 1861 | 100 |
| M5 | Sunny Steps, original (Ritmo) | Shadow Steps, original (Ritmo) | 104 |

## Hard: the same melody in major and in minor

Each melody plays in its major form or in a minor version, in one of the
keys C, D, E♭, F, G, A or B♭. The minor version lowers the 3rd, 6th and
7th; the accompaniment keeps the raised 7th in V chords. Both versions use
the same tempo and loudness.

| Melody | Origin |
|---|---|
| Twinkle, Twinkle, Little Star | Traditional French (“Ah! vous dirai-je, maman”), 1761 |
| Frère Jacques | Traditional French |
| Ode to Joy (Symphony No. 9) | L. van Beethoven, 1824 |
| Mary Had a Little Lamb | Traditional American, 1830s |
| Row, Row, Row Your Boat | Traditional, 1852 |
| London Bridge Is Falling Down | Traditional English |
| Lullaby (Wiegenlied, Op. 49 No. 4) | J. Brahms, 1868 |
| Au clair de la lune | Traditional French, 18th century |
