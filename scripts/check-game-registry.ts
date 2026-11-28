// Automated check for the game registry (lib/gameRegistry.ts), Music
// Island's layout (lib/islandLayout.ts) and what the island shows each
// student (lib/islandProgress.ts).
//
//   npm run check:game-registry
//
//   * every game has a unique id, all its fields, a real page (its route
//     exists under app/) and a free spot of its own on the island (two
//     games never share a spot; extra games go to the next island);
//   * the registry and the assignable games agree: every shared library
//     game (runner games and Note Reading) has exactly one registry entry,
//     with the same page as RUNNER_PAGE;
//   * every region has at least one "Coming soon" spot left;
//   * the island data: best results and stars per game over all its
//     assignments, the homework flag on unfinished assignments only (the
//     soonest due first), tapping homework opens the assignment, other
//     games open their own page, due dates read right;
//   * nothing Hebrew or Israeli.

import { existsSync } from "node:fs";
import { GAMES, SKILL_ORDER, SKILLS, islandOf, type GameEntry } from "../lib/gameRegistry";
import { SPOTS, SPOT_COUNT } from "../lib/islandLayout";
import { buildIslandData, dueLabel, starsForAccuracy } from "../lib/islandProgress";
import { RUNNER_PAGE } from "../lib/runnerGames";
import { NOTE_READING_GENERATOR } from "../lib/noteReading";

let failures = 0;
const fail = (m: string) => {
  failures++;
  console.error("✗ " + m);
};

// --- the registry -------------------------------------------------------------------
const ids = new Set<string>();
const taken = new Set<string>();
for (const g of GAMES) {
  if (ids.has(g.id)) fail(`${g.id}: id used twice`);
  ids.add(g.id);
  for (const k of ["title", "description", "teaches", "roundLength"] as const) if (!g[k] || g[k].length < 3) fail(`${g.id}: no ${k}`);
  if (!SKILLS[g.skill]) fail(`${g.id}: unknown skill ${g.skill}`);
  if (!(g.ages[0] >= 3 && g.ages[1] > g.ages[0] && g.ages[1] <= 18)) fail(`${g.id}: ages ${g.ages}`);
  if (g.levels.length === 0) fail(`${g.id}: no levels`);
  if (!(g.minutes > 0 && g.minutes <= 30)) fail(`${g.id}: ${g.minutes} minutes`);
  if (g.route) {
    const dir = `app${g.route}`;
    if (!existsSync(`${dir}/page.tsx`)) fail(`${g.id}: route ${g.route} has no page (${dir}/page.tsx)`);
  } else if (!g.generator) fail(`${g.id}: neither a page nor a shared game`);
  if (g.practice && !existsSync(`app${g.practice}/page.tsx`)) fail(`${g.id}: practice page ${g.practice} has no page`);
  if (g.skill !== "class" && !g.route && !g.practice) fail(`${g.id}: no free-practice page for the island`);
  const { island, spot } = islandOf(g, SPOT_COUNT);
  const key = `${island}/${g.skill}/${spot}`;
  if (taken.has(key)) fail(`${g.id}: spot ${key} already taken`);
  taken.add(key);
  if (!SPOTS[g.skill][spot]) fail(`${g.id}: spot ${spot} doesn't exist`);
  if (/[֐-׿]|israel|hebrew/i.test(JSON.stringify(g))) fail(`${g.id}: not allowed content`);
}
for (const k of SKILL_ORDER) {
  if (k === "class") continue;
  const used = GAMES.filter((g) => g.skill === k && islandOf(g, SPOT_COUNT).island === 0).length;
  if (used >= SPOTS[k].length) fail(`${SKILLS[k].region}: no "Coming soon" spot left`);
}

// --- registry ↔ assignable games -----------------------------------------------------
const generators = [...Object.keys(RUNNER_PAGE), NOTE_READING_GENERATOR];
for (const gen of generators) {
  const entries = GAMES.filter((g) => g.generator === gen);
  if (entries.length !== 1) fail(`generator ${gen}: ${entries.length} registry entries`);
  const page = (RUNNER_PAGE as Record<string, string>)[gen];
  if (page && entries[0] && entries[0].route !== page) fail(`${entries[0].id}: route ${entries[0].route} but RUNNER_PAGE says ${page}`);
}
for (const g of GAMES) if (g.generator && !generators.includes(g.generator)) fail(`${g.id}: generator ${g.generator} isn't a shared game`);

// --- the island data ---------------------------------------------------------------------
const NOW = Date.UTC(2026, 10, 25, 12); // a Wednesday
const gen = (g: GameEntry) => g.generator!;
const byId = (id: string) => GAMES.find((g) => g.id === id)!;
const generatorOf = new Map<string, string | null>([
  ["G-runner", gen(byId("note-runner"))],
  ["G-hos", gen(byId("happy-or-sad"))],
  ["G-train", gen(byId("music-train"))],
  ["G-quiz", null],
]);
const day = (d: number) => new Date(NOW + d * 86400000).toISOString();
const data = buildIslandData({
  now: NOW,
  generatorOf,
  assignments: [
    { id: "a1", game_id: "G-runner", due_at: day(2), assigned_at: day(-3) }, // Friday, open
    { id: "a2", game_id: "G-runner", due_at: day(5), assigned_at: day(-1) }, // later, open
    { id: "a3", game_id: "G-hos", due_at: day(1), assigned_at: day(-2) }, // completed
    { id: "a4", game_id: "G-quiz", due_at: null, assigned_at: day(-1) }, // a quiz: not on the island
    { id: "a5", game_id: "G-train", due_at: null, assigned_at: day(-1) }, // open, no due date
  ],
  statusOf: new Map([
    ["a1", "in_progress"],
    ["a3", "completed"],
  ]),
  results: [
    { game_id: "G-runner", points: 300, accuracy: 50 },
    { game_id: "G-runner", points: 1240, accuracy: 40 },
    { game_id: "G-hos", points: 0, accuracy: 70 },
    { game_id: "G-hos", points: 0, accuracy: "92.4" },
  ],
});
const P = data.progress;
if (P["note-runner"].best !== "1,240" || P["note-runner"].stars !== undefined) fail(`note runner best ${JSON.stringify(P["note-runner"])}`);
if (P["happy-or-sad"].best !== "92%" || P["happy-or-sad"].stars !== 3) fail(`happy or sad best ${JSON.stringify(P["happy-or-sad"])}`);
if (P["note-runner"].homework?.due !== "Fri" || data.hrefs["note-runner"] !== "/student/game/a1") fail(`note runner homework ${JSON.stringify(P["note-runner"])} ${data.hrefs["note-runner"]}`);
if (P["happy-or-sad"].homework) fail("completed homework still flagged");
if (data.hrefs["happy-or-sad"] !== "/student/game/a3") fail("a game with only finished homework should still open its assignment");
if (P["music-train"].homework?.due !== "To do" || P["music-train"].played) fail(`music train ${JSON.stringify(P["music-train"])}`);
if (data.homeworkCount !== 3) fail(`homework count ${data.homeworkCount}`);
if (P["rhythm-jump"].played || data.hrefs["rhythm-jump"] !== "/games/rhythm-jump") fail("an unplayed, unassigned game: new, opens its own page");
if (data.hrefs["team-battle"] !== "/student/play") fail("team battle opens the join page");
if (data.hrefs["note-reading"] !== "/games/note-reading" || data.notes["note-reading"]) fail("note reading without an assignment: opens free practice");
for (const g of GAMES) if (!(g.id in data.progress) || !(g.id in data.hrefs)) fail(`${g.id} missing from the island data`);
if (dueLabel(null, NOW) !== "To do" || dueLabel(day(-1), NOW) !== "Late!" || dueLabel(day(0.2), NOW) !== "Today" || dueLabel(day(10), NOW) !== "5 Dec") fail("due labels");
if (starsForAccuracy(90) !== 3 || starsForAccuracy(89) !== 2 || starsForAccuracy(60) !== 2 || starsForAccuracy(59) !== 1) fail("stars");

if (failures) {
  console.error(`\n${failures} problem(s) found.`);
  process.exit(1);
}
console.log(`✓ ${GAMES.length} games in the registry, each on its own island spot with a real page; ${generators.length} shared games matched; island data (stars, best, homework, links) correct.`);
