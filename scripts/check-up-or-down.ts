// Checks Up or Down's question rules (lib/upOrDown.ts) over many runs:
// each level's distances, "Same" about 1 in 4 on Hard (never elsewhere),
// notes in range, no more than three of one direction in a row, and
// listening time always longer than the two notes plus 2 s to think.
// Run: npm run check:up-or-down
import {
  HIGH_MIDI,
  LEVELS,
  LOW_MIDI,
  PAIR_SECONDS,
  QuestionSupply,
  listenSeconds,
  type Direction,
  type UpOrDownLevel,
} from "../lib/upOrDown";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures < 20) console.error("✗ " + msg);
};

for (const level of ["easy", "medium", "hard"] as UpOrDownLevel[]) {
  const { min, max } = LEVELS[level];
  const counts: Record<Direction, number> = { up: 0, down: 0, same: 0 };
  const distances = new Set<number>();
  const N = 20000;
  for (let run = 0; run < N / 50; run++) {
    const supply = new QuestionSupply(level);
    let streakDir: Direction | null = null;
    let streak = 0;
    for (let i = 0; i < 50; i++) {
      const q = supply.next();
      counts[q.answer]++;
      const d = q.second - q.first;
      if (q.first < LOW_MIDI || q.first > HIGH_MIDI || q.second < LOW_MIDI || q.second > HIGH_MIDI)
        fail(`${level}: note out of range ${q.first}→${q.second}`);
      const want: Direction = d > 0 ? "up" : d < 0 ? "down" : "same";
      if (want !== q.answer) fail(`${level}: answer ${q.answer} but ${q.first}→${q.second}`);
      if (q.answer !== "same") {
        distances.add(Math.abs(d));
        if (Math.abs(d) < min || Math.abs(d) > max) fail(`${level}: distance ${Math.abs(d)} outside ${min}–${max}`);
      }
      streak = q.answer === streakDir ? streak + 1 : 1;
      streakDir = q.answer;
      if (streak > 3) fail(`${level}: ${streak} × ${q.answer} in a row`);
    }
  }
  const sameShare = counts.same / N;
  if (level === "hard" ? sameShare < 0.2 || sameShare > 0.3 : counts.same > 0)
    fail(`${level}: "same" share ${(sameShare * 100).toFixed(1)}%`);
  for (let d = min; d <= max; d++) if (!distances.has(d)) fail(`${level}: distance ${d} never used`);
  for (let c = 0; c < 200; c++) if (listenSeconds(level, c) < PAIR_SECONDS + 2) fail(`${level}: too little listening time at ${c}`);
  console.log(
    `${LEVELS[level].label}: up ${counts.up}, down ${counts.down}, same ${counts.same} (${(sameShare * 100).toFixed(1)}%), distances ${[...distances].sort((a, b) => a - b).join(",")}`
  );
}

if (failures) {
  console.error(`${failures} problem(s).`);
  process.exit(1);
}
console.log("All Up or Down questions follow the rules.");
