import { glyphPaths, GLYPH_UNITS_PER_SPACE } from "@/lib/noteGlyphs";
import { isNoteSpec, staffPosition, type NoteSpec } from "@/lib/noteReading";

// Draws one Note Reading question: a five-line staff, the clef, and the note
// (with ledger lines and a ♯/♭ when needed), all as inline SVG so any note
// can be shown without image files. It scales to its container's width; the
// drawing area is the same for every note (room for 3 ledger lines above and
// below), so the layout doesn't jump between questions.

const SPACE = 10; // viewBox units per staff space
const HALF = SPACE / 2;
const TOP_POSITION = 15.5; // highest staff position the window shows
const BOTTOM_POSITION = -7.5;
const WIDTH = 112;
const HEIGHT = (TOP_POSITION - BOTTOM_POSITION) * HALF;
const GLYPH_SCALE = SPACE / GLYPH_UNITS_PER_SPACE;

const HEAD_WIDTH = (425 / GLYPH_UNITS_PER_SPACE) * SPACE;
const NOTE_X = 76; // centre of the note head
const CLEF_X = 8;
const STAFF_STROKE = 1;
const STEM_LENGTH = 3.5 * SPACE;

function yOf(position: number): number {
  return (TOP_POSITION - position) * HALF;
}

export default function NoteStaff({
  note,
  maxWidth = 380,
  color = "#1f1f1f",
}: {
  note: NoteSpec | unknown;
  maxWidth?: number | string;
  color?: string;
}) {
  if (!isNoteSpec(note)) return null;

  const p = staffPosition(note);
  const y = yOf(p);

  const ledgers: number[] = [];
  for (let l = -2; l >= p; l -= 2) ledgers.push(l);
  for (let l = 10; l <= p; l += 2) ledgers.push(l);

  const stemUp = p < 4;
  const stemX = stemUp ? NOTE_X + HEAD_WIDTH / 2 - 0.6 : NOTE_X - HEAD_WIDTH / 2 + 0.6;
  // Notes far off the staff get a stem that reaches the middle line.
  const stemEnd = stemUp ? Math.min(y - STEM_LENGTH, yOf(4)) : Math.max(y + STEM_LENGTH, yOf(4));

  const accidentalPath =
    note.accidental === "sharp"
      ? glyphPaths.accidentalSharp
      : note.accidental === "flat"
        ? glyphPaths.accidentalFlat
        : null;
  const accidentalWidth = note.accidental === "sharp" ? 10 : 9;
  const accidentalX = NOTE_X - HEAD_WIDTH / 2 - 2.5 - accidentalWidth;

  const clefPath = note.clef === "treble" ? glyphPaths.gClef : glyphPaths.fClef;
  // The G clef curls around the G line (2nd line), the F clef's dots sit
  // around the F line (4th line).
  const clefY = note.clef === "treble" ? yOf(2) : yOf(6);

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label={`A note on the ${note.clef} staff`}
      style={{ display: "block", width: "100%", maxWidth, height: "auto", margin: "0 auto" }}
    >
      <g fill={color} stroke="none">
        {[0, 2, 4, 6, 8].map((line) => (
          <rect
            key={line}
            x={2}
            y={yOf(line) - STAFF_STROKE / 2}
            width={WIDTH - 4}
            height={STAFF_STROKE}
          />
        ))}
        <path d={clefPath} transform={`translate(${CLEF_X} ${clefY}) scale(${GLYPH_SCALE})`} />
        {ledgers.map((l) => (
          <rect
            key={l}
            x={NOTE_X - HEAD_WIDTH / 2 - 3.5}
            y={yOf(l) - STAFF_STROKE * 0.7}
            width={HEAD_WIDTH + 7}
            height={STAFF_STROKE * 1.4}
          />
        ))}
        {accidentalPath && (
          <path d={accidentalPath} transform={`translate(${accidentalX} ${y}) scale(${GLYPH_SCALE})`} />
        )}
        <path
          d={glyphPaths.noteheadBlack}
          transform={`translate(${NOTE_X - HEAD_WIDTH / 2} ${y}) scale(${GLYPH_SCALE})`}
        />
        <rect
          x={stemX - 0.6}
          y={Math.min(y, stemEnd)}
          width={1.2}
          height={Math.abs(stemEnd - y)}
        />
      </g>
    </svg>
  );
}
