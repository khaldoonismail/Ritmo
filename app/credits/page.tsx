import type { Metadata } from "next";
import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";
import { HARD_MELODIES, PIECES } from "@/lib/happyOrSad/pieces";
import { MELODIES as TRAIN_MELODIES, TRAPS } from "@/lib/fastOrSlow/music";
import { MELODIES as TOWN_MELODIES } from "@/lib/loudOrSoft/music";

// Credits: who made the sounds and music in Ritmo. A server page (no
// JavaScript sent), built from the games' own music lists, so it always
// matches what the games play. The details behind it are in the
// CREDITS.md files (public/sounds/piano, lib/happyOrSad, lib/fastOrSlow,
// lib/loudOrSoft). Behind the maintenance gate like every page.

export const metadata: Metadata = {
  title: "Credits · Ritmo",
  description: "The piano sounds, music and artwork used in Ritmo, and who made them.",
};

type Origin = "public-domain" | "traditional" | "original";
interface Tune {
  title: string;
  source: string;
  origin: Origin;
  reference?: string;
}

// One entry per title (a game may use a tune at several levels).
function unique(tunes: Tune[]): Tune[] {
  const seen = new Map<string, Tune>();
  for (const t of tunes) if (!seen.has(t.title)) seen.set(t.title, t);
  return [...seen.values()];
}

const GAMES: { name: string; about: string; tunes: Tune[] }[] = [
  {
    name: "Happy or Sad",
    about: "Short excerpts in major and minor keys.",
    tunes: unique([...PIECES, ...HARD_MELODIES]),
  },
  {
    name: "Music Train (Fast or Slow)",
    about: "The same tunes played at different speeds.",
    tunes: unique([...TRAIN_MELODIES, ...TRAPS]),
  },
  {
    name: "Sleepy Town (Loud or Soft)",
    about: "The same tunes played softly and loudly.",
    tunes: unique(TOWN_MELODIES),
  },
];

const ALL_ORIGINALS = unique(GAMES.flatMap((g) => g.tunes).filter((t) => t.origin === "original"));

const ORIGIN_LABEL: Record<Origin, string> = {
  "public-domain": "Public domain",
  traditional: "Traditional",
  original: "Original for Ritmo",
};
const ORIGIN_COLOR: Record<Origin, { bg: string; fg: string }> = {
  "public-domain": { bg: "#E6F0FF", fg: "#2F5FB3" },
  traditional: { bg: "#E8F6E1", fg: "#2E7A3D" },
  original: { bg: "#FFF0DC", fg: "#9A5A12" },
};

// "Mutopia Project, piece 246 (…)" → its page on mutopiaproject.org.
function mutopiaLink(reference: string): { id: string; href: string } | null {
  const m = /Mutopia Project, piece (\d+)/.exec(reference);
  return m ? { id: m[1], href: `https://www.mutopiaproject.org/cgibin/piece-info.cgi?id=${m[1]}` } : null;
}

export default function CreditsPage() {
  return (
    <main style={{ minHeight: "100dvh", background: colors.background, color: colors.textPrimary, padding: "1.25rem 16px 2.5rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "min(720px, 100%)", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        <Link href="/" style={{ color: "inherit", fontWeight: 800, textDecoration: "none", opacity: 0.7 }}>
          ← Ritmo
        </Link>
        <header style={{ textAlign: "center" }}>
          <h1 style={{ margin: "0.2rem 0", fontSize: "2.2rem", fontWeight: 900 }}>Credits</h1>
          <p style={{ margin: 0, fontWeight: 600, opacity: 0.75, lineHeight: 1.5 }}>
            Thank you to everyone whose work helps Ritmo sound and look the way it does. Here is where our piano sounds, music and
            pictures come from.
          </p>
        </header>

        <section style={card} aria-labelledby="piano">
          <h2 id="piano" style={h2}>
            🎹 Piano sounds
          </h2>
          <p style={p}>
            The piano you hear in every Ritmo game is a real grand piano: the <b>Salamander Grand Piano</b> by <b>Alexander Holm</b>{" "}
            (a Yamaha C5, recorded note by note). It is shared under the{" "}
            <a href="https://creativecommons.org/licenses/by/3.0/" style={a} rel="license noopener" target="_blank">
              Creative Commons Attribution 3.0 licence (CC BY 3.0)
            </a>
            .
          </p>
          <p style={p}>
            <b>What we changed:</b> we kept 22 of the notes, then trimmed each recording to 4 seconds with a gentle fade, converted it to
            mono, evened out the loudness, compressed it to small MP3 files and corrected each note&apos;s pitch so it is exactly in tune.
            The notes in between are made by playing the nearest recording slightly faster or slower.
          </p>
          <p style={{ ...p, fontSize: "0.9rem", opacity: 0.7 }}>
            Original sample set:{" "}
            <a href="https://freepats.zenvoid.org/Piano/acoustic-grand-piano.html" style={a} rel="noopener" target="_blank">
              freepats.zenvoid.org
            </a>{" "}
            (the MP3 versions we started from are hosted by the{" "}
            <a href="https://github.com/Tonejs/audio/tree/master/salamander" style={a} rel="noopener" target="_blank">
              Tone.js project
            </a>
            ). Alexander Holm does not endorse Ritmo.
          </p>
        </section>

        <section style={card} aria-labelledby="music">
          <h2 id="music" style={h2}>
            🎵 Music in the games
          </h2>
          <p style={p}>
            Every tune is a short excerpt in a simple arrangement written for Ritmo and played live by the piano above. We don&apos;t use
            any recordings of these pieces, and we didn&apos;t copy any modern edition&apos;s arrangement. Each one is:
          </p>
          <ul style={{ ...p, margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: 4 }}>
            <li>
              <Badge origin="public-domain" /> written long ago by a composer who died long ago, so it now belongs to everyone;
            </li>
            <li>
              <Badge origin="traditional" /> a folk or children&apos;s song with no known author;
            </li>
            <li>
              <Badge origin="original" /> written for Ritmo.
            </li>
          </ul>
          <p style={p}>
            A few pieces were checked note by note against free public-domain editions from the{" "}
            <a href="https://www.mutopiaproject.org" style={a} rel="noopener" target="_blank">
              Mutopia Project
            </a>
            ; they are marked below.
          </p>

          {GAMES.map((g) => (
            <div key={g.name} style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 900 }}>{g.name}</h3>
              <p style={{ ...p, margin: 0, fontSize: "0.9rem", opacity: 0.7 }}>{g.about}</p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
                {g.tunes.map((t) => {
                  const mut = t.reference ? mutopiaLink(t.reference) : null;
                  return (
                    <li key={t.title} style={row}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 800 }}>{t.title}</div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", opacity: 0.7 }}>
                          {t.origin === "original" ? "Written for Ritmo" : t.source}
                          {mut && (
                            <>
                              {" · notes checked against "}
                              <a href={mut.href} style={a} rel="noopener" target="_blank">
                                Mutopia piece {mut.id}
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge origin={t.origin} />
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          <p style={{ ...p, fontSize: "0.9rem", opacity: 0.7 }}>
            Note Reading, Note Runner, Up or Down, Piano Hop and Rhythm Jump play single notes and rhythms made up by the game itself, on
            the same piano.
          </p>
        </section>

        <section style={card} aria-labelledby="originals">
          <h2 id="originals" style={h2}>
            ✏️ Made for Ritmo
          </h2>
          <p style={p}>These were all made especially for Ritmo:</p>
          <ul style={{ ...p, margin: 0, paddingLeft: "1.2rem", display: "flex", flexDirection: "column", gap: 6 }}>
            <li>
              <b>Original tunes:</b> {ALL_ORIGINALS.map((t) => t.title).join(", ")}, and the calm music-box tune behind Note Runner.
            </li>
            <li>
              <b>Characters:</b> the boy, the girl, the cat, the fox and Ritmo the eighth note, plus every animal in the games, drawn in
              code in our own cartoon style.
            </li>
            <li>
              <b>Pictures and scenes:</b> the pond, the village, the train, Sleepy Town and all the answer pictures and icons.
            </li>
            <li>
              <b>Sound effects:</b> the little &ldquo;ding&rdquo; and &ldquo;bump&rdquo; sounds are made in the browser, not recorded.
            </li>
          </ul>
        </section>

        <p style={{ margin: 0, textAlign: "center", fontSize: "0.85rem", fontWeight: 700, opacity: 0.6 }}>
          Spotted a mistake in these credits? Please let us know and we&apos;ll fix it.
        </p>
      </div>
    </main>
  );
}

function Badge({ origin }: { origin: Origin }) {
  const c = ORIGIN_COLOR[origin];
  return (
    <span
      style={{
        display: "inline-block",
        background: c.bg,
        color: c.fg,
        fontWeight: 800,
        fontSize: "0.78rem",
        padding: "0.15rem 0.55rem",
        borderRadius: 999,
        whiteSpace: "nowrap",
        flex: "0 0 auto",
      }}
    >
      {ORIGIN_LABEL[origin]}
    </span>
  );
}

const card: React.CSSProperties = {
  background: colors.white,
  borderRadius: radius.card,
  padding: "1.1rem 1.2rem",
  boxShadow: solidShadow(4, colors.rosterCardShadow),
  display: "flex",
  flexDirection: "column",
  gap: "0.7rem",
};
const h2: React.CSSProperties = { margin: 0, fontSize: "1.4rem", fontWeight: 900 };
const p: React.CSSProperties = { margin: 0, fontWeight: 600, lineHeight: 1.55 };
const a: React.CSSProperties = { color: colors.blueText, fontWeight: 800 };
const row: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 12,
  padding: "0.5rem 0",
  borderBottom: `1px solid ${colors.neutralGray}`,
};
