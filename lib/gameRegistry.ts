// The one list of Ritmo's games (single source of truth). The student's
// Music Island map and the teacher's library are both drawn from it, so a
// new game is ONE entry here: it then gets its landmark on the island (in
// the first free spot of its region) and its card in the library.
//
// Safe for browser and server code (no imports with side effects).

export type SkillArea = "reading" | "listening" | "rhythm" | "piano" | "tempo-dynamics" | "class";

export interface SkillInfo {
  label: string; // in the teacher library
  region: string; // on the island
  blurb: string;
}

export const SKILLS: Record<SkillArea, SkillInfo> = {
  reading: { label: "Note reading", region: "Note Beach", blurb: "Read notes on the staff" },
  listening: { label: "Listening", region: "Ear Forest", blurb: "Hear high and low, happy and sad" },
  rhythm: { label: "Rhythm", region: "Rhythm Valley", blurb: "Keep the beat, read rhythms" },
  piano: { label: "Piano", region: "Piano Hill", blurb: "Find notes on the keyboard" },
  "tempo-dynamics": { label: "Tempo & dynamics", region: "Tempo & Dynamics Plain", blurb: "Fast and slow, loud and soft" },
  class: { label: "Whole class", region: "Team Arena", blurb: "Play together in class" },
};

// The order regions and library sections appear in.
export const SKILL_ORDER: SkillArea[] = ["reading", "listening", "rhythm", "piano", "tempo-dynamics", "class"];

export type LandmarkArt =
  | "lighthouse"
  | "finish-arch"
  | "treehouse"
  | "village"
  | "pond"
  | "piano-bridge"
  | "station"
  | "sleepy-town"
  | "arena";

export interface GameEntry {
  id: string;
  title: string;
  description: string; // one short line, for children and teachers
  skill: SkillArea;
  ages: [number, number];
  teaches: string; // what it teaches, curriculum-style (teacher library)
  levels: string[]; // "Easy", "Medium", "Hard", "Custom"…
  roundLength: string; // "10 pieces", "endless run (3 hearts)"…
  minutes: number; // about how long a round takes
  // The game's own page: Play demo for teachers, free practice on the
  // island. null: none (Note Reading is played from its shared game).
  route: string | null;
  // The shared library game it is assigned as (games.generator), or null
  // when it can't be assigned yet (Sleepy Town: stage 1; Team Battle: live).
  generator: string | null;
  art: LandmarkArt; // the landmark on the island, and the library preview
  // Which spot of its region it takes (0 = the first). Spots without a
  // game show a "Coming soon" sign.
  spot: number;
  isNew?: boolean;
}

export const GAMES: GameEntry[] = [
  {
    id: "note-reading",
    title: "Note Reading",
    description: "Name the note on the staff before time runs out.",
    skill: "reading",
    ages: [6, 12],
    teaches: "Recognising notes on the treble and bass staff, with letter or solfège names; sharps and flats on Hard.",
    levels: ["Easy", "Medium", "Hard"],
    roundLength: "10 questions",
    minutes: 4,
    route: null,
    generator: "note_reading",
    art: "lighthouse",
    spot: 0,
  },
  {
    id: "note-runner",
    title: "Note Runner",
    description: "Run along the beach and jump to the right note.",
    skill: "reading",
    ages: [6, 12],
    teaches: "Fluent note reading: naming staff notes quickly, in treble or bass clef.",
    levels: ["Easy", "Medium", "Hard"],
    roundLength: "endless run, 3 hearts",
    minutes: 3,
    route: "/games/note-runner",
    generator: "note_runner",
    art: "finish-arch",
    spot: 1,
  },
  {
    id: "up-or-down",
    title: "Up or Down",
    description: "Does the music go up or down? Climb the right way.",
    skill: "listening",
    ages: [5, 9],
    teaches: "Pitch direction: hearing whether a melody moves up, down or stays the same.",
    levels: ["Easy", "Medium", "Hard"],
    roundLength: "endless run, 3 hearts",
    minutes: 3,
    route: "/games/up-or-down",
    generator: "up_or_down",
    art: "treehouse",
    spot: 1,
  },
  {
    id: "happy-or-sad",
    title: "Happy or Sad",
    description: "Major or minor? Bring sunshine or rain to the village.",
    skill: "listening",
    ages: [4, 9],
    teaches: "Major and minor tonality: hearing the mood of the music, then the same melody in major and minor.",
    levels: ["Easy", "Medium", "Hard"],
    roundLength: "10 pieces",
    minutes: 4,
    route: "/games/happy-or-sad",
    generator: "happy_or_sad",
    art: "village",
    spot: 0,
  },
  {
    id: "rhythm-jump",
    title: "Rhythm Jump",
    description: "Hop across the pond in time with the rhythm.",
    skill: "rhythm",
    ages: [5, 11],
    teaches: "Reading and performing rhythms in time: crotchets, quavers, minims and rests, in 2/4, 3/4 and 4/4.",
    levels: ["Easy", "Medium", "Hard", "Custom"],
    roundLength: "8 rhythms",
    minutes: 4,
    route: "/games/rhythm-jump",
    generator: "rhythm_jump",
    art: "pond",
    spot: 0,
  },
  {
    id: "piano-hop",
    title: "Piano Hop",
    description: "Hop over the piano-key bridge to the note you hear.",
    skill: "piano",
    ages: [5, 10],
    teaches: "Keyboard geography: finding notes on the piano by ear and by name, black keys on Hard.",
    levels: ["Easy", "Medium", "Hard"],
    roundLength: "endless run, 3 hearts",
    minutes: 3,
    route: "/games/piano-hop",
    generator: "piano_hop",
    art: "piano-bridge",
    spot: 0,
  },
  {
    id: "music-train",
    title: "Music Train",
    description: "Fast or slow? Choose who drives the train.",
    skill: "tempo-dynamics",
    ages: [4, 8],
    teaches: "Tempo: slow, medium and fast, accelerando and ritardando, with the Italian terms.",
    levels: ["Easy", "Medium", "Hard"],
    roundLength: "10 pieces",
    minutes: 4,
    route: "/games/fast-or-slow",
    generator: "music_train",
    art: "station",
    spot: 0,
  },
  {
    id: "sleepy-town",
    title: "Sleepy Town",
    description: "Loud or soft? Tiptoe past the houses or wake the town.",
    skill: "tempo-dynamics",
    ages: [4, 8],
    teaches: "Dynamics: soft and loud, pp to ff, crescendo, diminuendo and sudden changes, with the markings.",
    levels: ["Easy", "Medium", "Hard"],
    roundLength: "10 pieces",
    minutes: 4,
    route: "/games/loud-or-soft",
    generator: null,
    art: "sleepy-town",
    spot: 1,
    isNew: true,
  },
  {
    id: "team-battle",
    title: "Team Battle",
    description: "The whole class in two teams, live with a join code.",
    skill: "class",
    ages: [7, 14],
    teaches: "Any topic you choose: a live class quiz on your own questions, played in two teams.",
    levels: ["Your questions"],
    roundLength: "the teacher's questions",
    minutes: 10,
    route: "/student/play",
    generator: null,
    art: "arena",
    spot: 0,
  },
];

// Fills each region's spots in order: games whose spot doesn't fit on
// the first island (more games than spots) go to the next island, which
// the boat leads to. `spots` = how many spots each region has.
export function islandOf(g: GameEntry, spots: Record<SkillArea, number>): { island: number; spot: number } {
  const n = Math.max(1, spots[g.skill]);
  return { island: Math.floor(g.spot / n), spot: g.spot % n };
}

export const gameByGenerator = (generator: string | null | undefined) => (generator ? GAMES.find((g) => g.generator === generator) ?? null : null);
export const gameById = (id: string) => GAMES.find((g) => g.id === id) ?? null;
export const gamesBySkill = (skill: SkillArea) => GAMES.filter((g) => g.skill === skill).sort((a, b) => a.spot - b.spot);
