// Automated check for Piano Hop's keyboard and key sounds.
//
//   npm run check:piano-hop
//
// For every level it builds the exact 3D keys the game draws
// (components/pianoHop/keyboard.ts) and checks them against facts written
// out independently here (not taken from the game's code):
//   * the right keys exist: Easy C4–C5 white keys, Medium C4–C6 white
//     keys, Hard C4–C6 with every black key;
//   * every white key sits in its own slot, left to right, one key wide;
//   * every black key sits on the line between the right two white keys
//     (C♯ between C and D…), raised above and towards the back, so the
//     groups of 2 and 3 come out right, with no black key between E–F
//     and B–C;
//   * a tap straight down on each key's middle (and near its edges) picks
//     that key, and a black key's tap target never covers its neighbour;
//   * Easy's "Do" marker is on every C and nowhere else;
//   * each key plays its own pitch: the sound code is run with a stand-in
//     AudioContext and the note it starts must match the key's real
//     frequency (A4 = 440 Hz, equal temperament);
//   * names: every name the game asks (Do-Re-Mi and C-D-E, ♯ and ♭) is
//     right for exactly the keys with that pitch, both spellings of a
//     black key (C♯ = D♭) are accepted, and Easy/Medium never ask for a
//     black key.
// Exits with code 1 and lists failures if anything is wrong.

import * as THREE from "three";

// --- a stand-in for the browser's audio, so the real sound code runs ---------
const started: number[] = [];
class FakeParam {
  value = 0;
  setValueAtTime(v: number) {
    this.value = v;
    return this;
  }
  exponentialRampToValueAtTime() {
    return this;
  }
  linearRampToValueAtTime() {
    return this;
  }
  setTargetAtTime() {
    return this;
  }
  cancelScheduledValues() {
    return this;
  }
}
class FakeNode {
  connect() {}
  disconnect() {}
}
class FakeOscillator extends FakeNode {
  type = "sine";
  frequency = new FakeParam();
  onended: (() => void) | null = null;
  start() {
    started.push(this.frequency.value);
  }
  stop() {}
}
class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = new FakeNode();
  resume() {
    return Promise.resolve();
  }
  addEventListener() {}
  createGain() {
    return Object.assign(new FakeNode(), { gain: new FakeParam() });
  }
  createOscillator() {
    return new FakeOscillator();
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), { type: "lowpass", frequency: new FakeParam() });
  }
}
const g = globalThis as unknown as Record<string, unknown>;
g.window = Object.assign(globalThis, { AudioContext: FakeAudioContext, addEventListener() {}, setTimeout, clearTimeout });
g.document = { addEventListener() {}, hidden: false };

let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures <= 40) console.error("✗ " + msg);
};

// --- independent reference facts ------------------------------------------------
const NAMES_SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const NAMES_FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const SOLFEGE: Record<string, string> = { C: "Do", D: "Re", E: "Mi", F: "Fa", G: "Sol", A: "La", B: "Si" };
const toSolfege = (n: string) => SOLFEGE[n[0]] + n.slice(1);
const BLACK_PCS = [1, 3, 6, 8, 10];
// Known frequencies (Hz) of some keys, to anchor the formula below.
const KNOWN_HZ: Record<number, number> = { 60: 261.626, 64: 329.628, 69: 440, 72: 523.251, 78: 739.989, 84: 1046.502 };
const hzOf = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

const EXPECTED: Record<string, number[]> = {
  easy: [60, 62, 64, 65, 67, 69, 71, 72],
  medium: [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84],
  hard: Array.from({ length: 25 }, (_, i) => 60 + i),
};

async function main() {
  const { pianoKeys, PIANO_LEVELS, PianoQuestionSupply, isRight, questionName } = await import("../lib/pianoHop");
  const { buildKeyboard, pickKey, BACK_Z, FRONT_Z, WHITE_H } = await import("../components/pianoHop/keyboard");
  const { Materials } = await import("../components/noteRunner/look");
  const { playKey } = await import("../components/pianoHop/sound");

  for (const anchor of Object.keys(KNOWN_HZ)) {
    const m = Number(anchor);
    if (Math.abs(hzOf(m) - KNOWN_HZ[m]) > 0.01) fail(`reference formula wrong for MIDI ${m}`);
  }

  for (const level of ["easy", "medium", "hard"] as const) {
    const keys = pianoKeys(level);
    const midis = keys.map((k) => k.midi);
    if (JSON.stringify(midis) !== JSON.stringify(EXPECTED[level])) fail(`${level}: keys ${midis.join(",")}`);

    const scene = new THREE.Scene();
    const marker = new THREE.Texture();
    const built = buildKeyboard(keys, new Materials("low"), (o) => scene.add(o), PIANO_LEVELS[level].markers ? marker : null);
    scene.updateMatrixWorld(true);

    const whites = built.filter((k) => !k.key.black);
    const whiteSlot = new Map<number, number>(); // midi → slot index
    whites.forEach((k, i) => {
      whiteSlot.set(k.key.midi, i);
      const p = k.mesh.getWorldPosition(new THREE.Vector3());
      const box = new THREE.Box3().setFromObject(k.mesh);
      if (Math.abs(p.x - (i + 0.5)) > 1e-6) fail(`${level}: white key ${k.key.midi} at x=${p.x}, expected ${i + 0.5}`);
      if (box.max.x - box.min.x > 1 + 1e-6 || box.max.x - box.min.x < 0.85) fail(`${level}: white key ${k.key.midi} is ${box.max.x - box.min.x} wide`);
      if (NAMES_SHARP[k.key.midi % 12].length !== 1) fail(`${level}: ${k.key.midi} drawn as a white key`);
      if (k.mesh.userData.midi !== k.key.midi || k.hit.userData.midi !== k.key.midi) fail(`${level}: key ${k.key.midi} mislabelled`);
      const hasMarker = k.mesh.children.some((c) => c.name === "marker");
      const wantMarker = PIANO_LEVELS[level].markers && k.key.midi % 12 === 0;
      if (hasMarker !== wantMarker) fail(`${level}: marker on ${k.key.midi} is ${hasMarker}, expected ${wantMarker}`);
    });
    // Adjacent white keys never overlap.
    for (let i = 1; i < whites.length; i++) {
      const a = new THREE.Box3().setFromObject(whites[i - 1].mesh);
      const b = new THREE.Box3().setFromObject(whites[i].mesh);
      if (a.max.x > b.min.x + 1e-6) fail(`${level}: white keys ${whites[i - 1].key.midi} and ${whites[i].key.midi} overlap`);
    }

    const blacks = built.filter((k) => k.key.black);
    const whiteTop = Math.max(...whites.map((w) => new THREE.Box3().setFromObject(w.mesh).max.y));
    if (whiteTop < WHITE_H) fail(`${level}: white keys only ${whiteTop} tall`);
    if (!PIANO_LEVELS[level].black && blacks.length) fail(`${level}: has black keys`);
    for (const k of blacks) {
      const pc = k.key.midi % 12;
      if (!BLACK_PCS.includes(pc)) fail(`${level}: ${k.key.midi} drawn as a black key`);
      // Between the white key below and the one above.
      const below = whiteSlot.get(k.key.midi - 1);
      const above = whiteSlot.get(k.key.midi + 1);
      if (below === undefined || above === undefined || above !== below + 1) {
        fail(`${level}: black key ${k.key.midi} isn't between two neighbouring white keys`);
        continue;
      }
      const p = k.mesh.getWorldPosition(new THREE.Vector3());
      const line = below + 1; // the line between the two white keys
      if (Math.abs(p.x - line) > 0.15) fail(`${level}: black key ${k.key.midi} at x=${p.x}, expected near ${line}`);
      const box = new THREE.Box3().setFromObject(k.mesh);
      // Its top stands clearly above the white keys' tops (its base sits
      // down between them, like a real piano).
      if (box.max.y < whiteTop + 0.2) fail(`${level}: black key ${k.key.midi} not raised above the white keys`);
      if (box.min.z > BACK_Z + 0.05 || box.max.z > FRONT_Z - 0.8) fail(`${level}: black key ${k.key.midi} not at the back`);
    }
    // Groups: in each octave black keys come 2 then 3 (none at E–F, B–C).
    if (PIANO_LEVELS[level].black) {
      const pattern = whites
        .slice(0, -1)
        .map((w) => (blacks.some((b) => b.key.midi === w.key.midi + 1) ? "■" : "·"))
        .join("");
      if (pattern !== "■■·■■■·■■·■■■·") fail(`${level}: black-key pattern ${pattern}`);
    }

    // Taps: a ray straight down onto each key picks that key.
    const ray = new THREE.Raycaster();
    const tapAt = (x: number, z: number) => {
      ray.set(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
      return pickKey(ray, built);
    };
    built.forEach((k, i) => {
      const x = k.key.x;
      if (k.key.black) {
        for (const dx of [0, -0.25, 0.25]) {
          if (tapAt(x + dx, BACK_Z + 0.9) !== i) fail(`${level}: tap at black key ${k.key.midi} (${dx >= 0 ? "+" : ""}${dx}) picks another key`);
        }
      } else {
        for (const dx of [0, -0.42, 0.42]) {
          if (tapAt(x + dx, FRONT_Z - 0.5) !== i) fail(`${level}: tap at the front of white key ${k.key.midi} (${dx}) picks another key`);
        }
      }
    });
    // Neighbouring black keys' tap targets never overlap.
    for (let i = 1; i < blacks.length; i++) {
      const a = new THREE.Box3().setFromObject(blacks[i - 1].hit);
      const b = new THREE.Box3().setFromObject(blacks[i].hit);
      if (a.max.x > b.min.x) fail(`${level}: tap targets of ${blacks[i - 1].key.midi} and ${blacks[i].key.midi} overlap`);
    }

    // Sounds: each key's tap target → the game's key sound → its pitch.
    for (const k of built) {
      started.length = 0;
      playKey(k.hit.userData.midi);
      const fundamental = started[0];
      if (fundamental === undefined || Math.abs(fundamental - hzOf(k.key.midi)) > 0.01) {
        fail(`${level}: key ${k.key.midi} (${NAMES_SHARP[k.key.midi % 12]}) plays ${fundamental} Hz, expected ${hzOf(k.key.midi).toFixed(3)}`);
      }
    }

    // Names and answers.
    for (const naming of ["letters", "solfege"] as const) {
      const say = (n: string) => (naming === "solfege" ? toSolfege(n) : n);
      for (let pc = 0; pc < 12; pc++) {
        const names = BLACK_PCS.includes(pc) ? [NAMES_SHARP[pc], NAMES_FLAT[pc]] : [NAMES_SHARP[pc]];
        const gameNames = BLACK_PCS.includes(pc)
          ? [questionName(pc, naming, "sharp"), questionName(pc, naming, "flat")]
          : [questionName(pc, naming)];
        if (JSON.stringify(gameNames) !== JSON.stringify(names.map(say))) fail(`${naming}: pitch ${pc} named ${gameNames}`);
        const right = keys.filter((k) => isRight(k, { pc, name: "" })).map((k) => k.midi);
        const expected = EXPECTED[level].filter((m) => m % 12 === pc);
        if (JSON.stringify(right) !== JSON.stringify(expected)) fail(`${level}: right keys for ${names.join("/")} are ${right}`);
      }
      // What the game asks: only names that exist on the level, the right
      // spelling for the pitch, never twice in a row.
      const supply = new PianoQuestionSupply(level, naming);
      let last = -1;
      const seen = new Set<string>();
      for (let n = 0; n < 3000; n++) {
        const q = supply.next();
        seen.add(q.name);
        if (q.pc === last) fail(`${level}: same note twice in a row`);
        last = q.pc;
        const ok = BLACK_PCS.includes(q.pc) ? [NAMES_SHARP[q.pc], NAMES_FLAT[q.pc]].map(say) : [say(NAMES_SHARP[q.pc])];
        if (!ok.includes(q.name)) fail(`${level}: asked "${q.name}" for pitch ${q.pc}`);
        if (!keys.some((k) => isRight(k, q))) fail(`${level}: asked "${q.name}", which has no key`);
        if (!PIANO_LEVELS[level].black && BLACK_PCS.includes(q.pc)) fail(`${level}: asked a black key`);
      }
      const expectedNames = PIANO_LEVELS[level].black ? 17 : 7; // 7 white + 5 black × 2 spellings
      if (seen.size !== expectedNames) fail(`${level} ${naming}: asked ${seen.size} different names, expected ${expectedNames}`);
    }

    console.log(
      `${level}: ${whites.length} white + ${blacks.length} black keys in place, taps and pitches right (${keys[0].midi}–${keys[keys.length - 1].midi}).`
    );
  }

  if (failures) {
    console.error(`\n${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("All Piano Hop keys are drawn in the right place and play the right pitch.");
}

main();
