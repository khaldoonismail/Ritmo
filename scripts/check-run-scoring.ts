// Checks the server's run check and scoring (lib/runCheck.ts) with runs
// made by the games' own note makers: honest runs at a real pace pass and
// score like the game does; too-fast runs, notes outside the level, "Same"
// below Hard, sharps/flats where none are allowed and answers after the
// last heart are all rejected.
// Run: npm run check:run-scoring
import { checkRun } from "../lib/runCheck";
import { GateSupply, gateSeconds, GAP_SECONDS, pointsFor as nrPoints } from "../lib/noteRunner";
import { QuestionSupply, listenSeconds, pointsFor as uodPoints, type Direction } from "../lib/upOrDown";
import { normalizeNoteRunnerSettings, normalizeUpOrDownSettings, noteRunnerConfig } from "../lib/runnerGames";

let failures = 0;
const expect = (ok: boolean, msg: string) => {
  if (!ok) {
    failures++;
    console.error("✗ " + msg);
  }
};

// Note Runner: `pattern` says which answers are right.
function noteRun(settingsIn: object, pattern: boolean[]) {
  const settings = normalizeNoteRunnerSettings(settingsIn);
  const supply = new GateSupply(noteRunnerConfig(settings));
  let correct = 0;
  let streak = 0;
  let points = 0;
  let seconds = 0;
  const answers = pattern.map((right, i) => {
    const g = supply.next();
    seconds += gateSeconds(settings.level, correct) + (i > 0 ? GAP_SECONDS : 0);
    const picked = right ? g.answer : g.options.find((p) => p !== g.answer)!;
    if (right) {
      points += nrPoints(streak);
      correct++;
      streak++;
    } else streak = 0;
    return { note: g.question.note, picked };
  });
  return { settings, answers, seconds, points };
}

function upDownRun(level: "easy" | "medium" | "hard", pattern: boolean[]) {
  const settings = normalizeUpOrDownSettings({ level });
  const supply = new QuestionSupply(level);
  let correct = 0;
  let streak = 0;
  let points = 0;
  let seconds = 0;
  const answers = pattern.map((right) => {
    const q = supply.next();
    seconds += listenSeconds(level, correct);
    const wrong: Direction = q.answer === "up" ? "down" : "up";
    if (right) {
      points += uodPoints(streak);
      correct++;
      streak++;
    } else streak = 0;
    return { first: q.first, second: q.second, picked: right ? q.answer : wrong };
  });
  return { settings, answers, seconds, points };
}

const long = [...Array(40).fill(true), false, true, true, false, false];

for (const s of [
  { clef: "treble", level: "easy" },
  { clef: "bass", level: "medium" },
  { clef: "mixed", level: "hard", accidentals: true },
]) {
  for (let k = 0; k < 30; k++) {
    const r = noteRun(s, long);
    const ok = checkRun(r.settings, r.answers, r.seconds + 2);
    expect(ok.ok && ok.score.points === r.points, `Note Runner ${JSON.stringify(s)}: honest run rejected or mis-scored: ${JSON.stringify(ok)}`);
    const fast = checkRun(r.settings, r.answers, r.seconds * 0.5);
    expect(!fast.ok, `Note Runner ${JSON.stringify(s)}: a run twice as fast was accepted`);
  }
}
{
  // Hard notes submitted to an Easy assignment.
  const r = noteRun({ clef: "treble", level: "hard" }, long);
  const easy = normalizeNoteRunnerSettings({ clef: "treble", level: "easy" });
  expect(!checkRun(easy, r.answers, 1e6).ok, "Note Runner: Hard notes accepted on Easy");
  const bass = normalizeNoteRunnerSettings({ clef: "bass", level: "hard" });
  expect(!checkRun(bass, r.answers, 1e6).ok, "Note Runner: treble notes accepted on a bass assignment");
  const sharps = noteRun({ clef: "treble", level: "hard", accidentals: true }, Array(80).fill(true));
  const noSharps = normalizeNoteRunnerSettings({ clef: "treble", level: "hard", accidentals: false });
  expect(!checkRun(noSharps, sharps.answers, 1e6).ok, "Note Runner: sharps/flats accepted without them");
  const afterLast = noteRun({ clef: "treble", level: "easy" }, [false, false, false, true]);
  expect(!checkRun(afterLast.settings, afterLast.answers, 1e6).ok, "Note Runner: answer after the last heart accepted");
  const quit = noteRun({ clef: "treble", level: "easy" }, [true, false, true]);
  expect(checkRun(quit.settings, quit.answers, 1e6).ok, "Note Runner: a quit run (hearts left) rejected");
}

for (const level of ["easy", "medium", "hard"] as const) {
  for (let k = 0; k < 30; k++) {
    const r = upDownRun(level, long);
    const ok = checkRun(r.settings, r.answers, r.seconds + 2);
    expect(ok.ok && ok.score.points === r.points, `Up or Down ${level}: honest run rejected or mis-scored: ${JSON.stringify(ok)}`);
    expect(!checkRun(r.settings, r.answers, r.seconds * 0.5).ok, `Up or Down ${level}: a run twice as fast was accepted`);
  }
}
{
  const hard = upDownRun("hard", Array(60).fill(true));
  const easy = normalizeUpOrDownSettings({ level: "easy" });
  expect(!checkRun(easy, hard.answers, 1e6).ok, "Up or Down: Hard intervals accepted on Easy");
  const medium = normalizeUpOrDownSettings({ level: "medium" });
  expect(
    !checkRun(medium, [{ first: 60, second: 60, picked: "same" }], 1e6).ok,
    "Up or Down: Same accepted on Medium"
  );
  expect(
    !checkRun(easy, [{ first: 40, second: 55, picked: "up" }], 1e6).ok,
    "Up or Down: note below the range accepted"
  );
  expect(!checkRun(easy, "nope", 1e6).ok, "garbage answers accepted");
  const tooLate = upDownRun("easy", [true]);
  tooLate.answers[0].picked = null as unknown as Direction;
  const r = checkRun(easy, tooLate.answers, 1e6);
  expect(r.ok && r.score.points === 0 && r.score.correct === 0, "Up or Down: Too late! not scored as wrong");
}

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("✓ run check: honest runs pass with the game's own score; cheats are rejected");
