// Reads a Standard MIDI File and prints its notes bar by bar (pitch,
// start and length in beats), with tempo, time and key signatures. Used to
// copy the exact notes of public-domain pieces (music-sources/, from the
// Mutopia Project) into lib/happyOrSad/pieces.ts.
//
//   npx tsx scripts/read-midi.ts music-sources/02-lamortdase.mid [bars=8]

import { readFileSync } from "node:fs";

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const noteName = (m: number) => `${NAMES[m % 12]}${Math.floor(m / 12) - 1}`;

export interface MidiNote {
  track: number;
  channel: number;
  midi: number;
  start: number; // beats (quarter notes)
  dur: number;
  vel: number;
}

export interface MidiInfo {
  ppq: number;
  tempos: { beat: number; bpm: number }[];
  timeSigs: { beat: number; num: number; den: number }[];
  keySigs: { beat: number; sf: number; minor: boolean }[];
  notes: MidiNote[];
  trackNames: string[];
}

export function readMidi(buf: Buffer): MidiInfo {
  let p = 0;
  const u32 = () => ((buf[p++] << 24) | (buf[p++] << 16) | (buf[p++] << 8) | buf[p++]) >>> 0;
  const u16 = () => (buf[p++] << 8) | buf[p++];
  const vlq = () => {
    let v = 0;
    let b;
    do {
      b = buf[p++];
      v = (v << 7) | (b & 0x7f);
    } while (b & 0x80);
    return v;
  };
  if (buf.toString("ascii", 0, 4) !== "MThd") throw new Error("not a MIDI file");
  p = 4;
  const hlen = u32();
  u16(); // format
  const ntracks = u16();
  const ppq = u16();
  p = 8 + hlen;
  const info: MidiInfo = { ppq, tempos: [], timeSigs: [], keySigs: [], notes: [], trackNames: [] };
  for (let t = 0; t < ntracks; t++) {
    if (buf.toString("ascii", p, p + 4) !== "MTrk") throw new Error("bad track");
    p += 4;
    const len = u32();
    const end = p + len;
    let tick = 0;
    let status = 0;
    const on = new Map<string, { tick: number; vel: number }>();
    while (p < end) {
      tick += vlq();
      let b = buf[p];
      if (b & 0x80) {
        status = b;
        p++;
      } else b = status;
      const type = status & 0xf0;
      const ch = status & 0x0f;
      if (status === 0xff) {
        const meta = buf[p++];
        const mlen = vlq();
        const data = buf.subarray(p, p + mlen);
        p += mlen;
        const beat = tick / ppq;
        if (meta === 0x51) info.tempos.push({ beat, bpm: 60000000 / ((data[0] << 16) | (data[1] << 8) | data[2]) });
        if (meta === 0x58) info.timeSigs.push({ beat, num: data[0], den: 2 ** data[1] });
        if (meta === 0x59) info.keySigs.push({ beat, sf: (data[0] << 24) >> 24, minor: data[1] === 1 });
        if (meta === 0x03) info.trackNames[t] = data.toString("latin1");
      } else if (status === 0xf0 || status === 0xf7) {
        p += vlq();
      } else if (type === 0x90 || type === 0x80) {
        const note = buf[p++];
        const vel = buf[p++];
        const key = `${ch}:${note}`;
        if (type === 0x90 && vel > 0) on.set(key, { tick, vel });
        else {
          const s = on.get(key);
          if (s) {
            info.notes.push({ track: t, channel: ch, midi: note, start: s.tick / ppq, dur: (tick - s.tick) / ppq, vel: s.vel });
            on.delete(key);
          }
        }
      } else if (type === 0xa0 || type === 0xb0 || type === 0xe0) p += 2;
      else if (type === 0xc0 || type === 0xd0) p += 1;
      else throw new Error(`unknown status ${status.toString(16)} at ${p}`);
    }
    p = end;
  }
  info.notes.sort((a, b) => a.start - b.start || b.midi - a.midi);
  return info;
}

if (process.argv[1] && /read-midi/.test(process.argv[1])) {
  const file = process.argv[2];
  const bars = Number(process.argv[3] ?? 8);
  const m = readMidi(readFileSync(file));
  const ts = m.timeSigs[0] ?? { num: 4, den: 4 };
  const barBeats = (ts.num * 4) / ts.den;
  console.log(`ppq ${m.ppq} · tempo ${m.tempos.map((t) => `${t.bpm.toFixed(1)}@${t.beat}`).join(", ")} · time ${m.timeSigs.map((t) => `${t.num}/${t.den}@${t.beat}`).join(", ")} · key ${m.keySigs.map((k) => `${k.sf}${k.minor ? " minor" : " major"}@${k.beat}`).join(", ")}`);
  console.log(`tracks: ${m.trackNames.map((n, i) => `${i}=${n ?? "?"}`).join(", ")}`);
  // The first note may come after a pickup; bars counted from beat 0.
  const tracks = [...new Set(m.notes.map((n) => n.track))];
  for (const t of tracks) {
    console.log(`\n--- track ${t} ${m.trackNames[t] ?? ""}`);
    for (let b = 0; b < bars; b++) {
      const inBar = m.notes.filter((n) => n.track === t && n.start >= b * barBeats - 1e-6 && n.start < (b + 1) * barBeats - 1e-6);
      console.log(
        `bar ${b + 1}: ` +
          inBar.map((n) => `${noteName(n.midi)}@${(n.start - b * barBeats).toFixed(2)}/${n.dur.toFixed(2)}`).join("  ")
      );
    }
  }
}
