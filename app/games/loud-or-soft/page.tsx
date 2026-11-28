"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";
import { unlockNoteAudio } from "@/lib/playNote";
import { RunnerCard, RunnerPickerScreen, useRunnerChoice } from "@/components/characters/RunnerChoice";
import { usePianoSamples } from "@/lib/usePianoSamples";
import { AnswerIcon, Hairpin } from "@/components/loudOrSoft/icons";
import { LEVELS, type DynLevel } from "@/lib/loudOrSoft/music";

// Sleepy Town (Loud or Soft): dynamics by ear. Free practice and the
// teachers' Play demo (nothing saved); assigned rounds are played from
// app/student/game/[assignmentId] (SharedGamePlayer). 2D (SVG and CSS),
// light for old tablets. Before the first round on a device: "Set your
// volume".

const loadGame = () => import("@/components/loudOrSoft/SleepyTownGame");
const SleepyTownGame = dynamic(loadGame, {
  ssr: false,
  loading: () => (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", background: "#262A5C", color: "#FFFFFF" }}>
      <p style={{ fontWeight: 800 }}>Loading Sleepy Town…</p>
    </main>
  ),
});
const loadVolume = () => import("@/components/loudOrSoft/VolumeStep");
const VolumeStep = dynamic(loadVolume, { ssr: false });

const LEVEL_KEYS: DynLevel[] = ["easy", "medium", "hard"];
const SETTINGS_KEY = "ritmo.sleepyTown.settings";

type Screen = "settings" | "volume" | "game";

export default function LoudOrSoftPage() {
  usePianoSamples();
  const [level, setLevel] = useState<DynLevel>("easy");
  const [markings, setMarkings] = useState(false);
  const [screen, setScreen] = useState<Screen>("settings");
  const [afterVolume, setAfterVolume] = useState<"game" | "settings">("game");
  const [volumeSet, setVolumeSet] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const { runner, chosen, picking, setPicking, save } = useRunnerChoice();

  useEffect(() => {
    loadGame().catch(() => {});
    loadVolume()
      .then((m) => setVolumeSet(m.volumeIsSet()))
      .catch(() => {});
    try {
      const saved = JSON.parse(window.localStorage.getItem(SETTINGS_KEY) ?? "null") as { level?: DynLevel; markings?: boolean } | null;
      if (saved?.level && LEVEL_KEYS.includes(saved.level)) setLevel(saved.level);
      if (typeof saved?.markings === "boolean") setMarkings(saved.markings);
    } catch {
      // nothing saved
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ level, markings }));
    } catch {
      // private mode
    }
  }, [loaded, level, markings]);

  const go = () => {
    if (!volumeSet) {
      setAfterVolume("game");
      setScreen("volume");
      return;
    }
    setRunKey(Date.now());
    setScreen("game");
  };
  const play = () => {
    unlockNoteAudio();
    if (!chosen) {
      setPicking("start");
      return;
    }
    go();
  };

  if (screen === "game") {
    return <SleepyTownGame key={runKey} level={level} markings={markings} character={runner} autoStart onChangeSettings={() => setScreen("settings")} />;
  }

  if (screen === "volume") {
    return (
      <VolumeStep
        onDone={() => {
          setVolumeSet(true);
          if (afterVolume === "game") {
            setRunKey(Date.now());
            setScreen("game");
          } else setScreen("settings");
        }}
        onCancel={() => setScreen("settings")}
      />
    );
  }

  if (picking) {
    return (
      <RunnerPickerScreen
        initial={runner}
        mode={picking}
        onDone={(c) => {
          unlockNoteAudio();
          save(c);
          setPicking(null);
          if (picking === "start") go();
        }}
      />
    );
  }

  return (
    <main style={{ minHeight: "100dvh", background: colors.background, color: colors.textPrimary, padding: "1.25rem 16px 2.5rem", display: "flex", flexDirection: "column", alignItems: "center" }}>
      <div style={{ width: "min(520px, 100%)", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <Link href="/" style={{ color: "inherit", fontWeight: 800, textDecoration: "none", opacity: 0.7 }}>
          ✕ Exit
        </Link>
        <div style={{ textAlign: "center" }}>
          <div style={{ display: "flex", justifyContent: "center", gap: 10 }} aria-hidden="true">
            <AnswerIcon answer="p" size={64} />
            <AnswerIcon answer="f" size={64} />
          </div>
          <h1 style={{ margin: "0.4rem 0 0.2rem", fontSize: "2rem", fontWeight: 900 }}>Sleepy Town</h1>
          <p style={{ margin: 0, fontWeight: 600, opacity: 0.75, lineHeight: 1.45 }}>
            Loud or soft? First a normal tune plays, then listen to the music: is it softer or louder? Tiptoe past the sleeping houses,
            or bang the drum and wake everyone up! Every right answer lights up the town. 10 pieces a round, up to 3 stars.
          </p>
        </div>

        <section style={card} role="radiogroup" aria-label="Level">
          <div style={{ fontWeight: 900 }}>Level</div>
          {LEVEL_KEYS.map((key) => (
            <button key={key} type="button" role="radio" aria-checked={key === level} onClick={() => setLevel(key)} style={option(key === level)}>
              <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>{LEVELS[key].label}</div>
              <div style={{ fontWeight: 600, fontSize: "0.9rem", opacity: 0.75 }}>{LEVELS[key].detail}</div>
            </button>
          ))}
        </section>

        <section style={card}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.75rem", cursor: "pointer" }}>
            <input type="checkbox" checked={markings} onChange={(e) => setMarkings(e.target.checked)} style={{ width: 24, height: 24, accentColor: colors.blueText, flex: "0 0 auto" }} />
            <span>
              <span style={{ fontWeight: 900 }}>Dynamic markings</span>
              <span style={{ display: "block", fontWeight: 600, fontSize: "0.85rem", opacity: 0.7 }}>
                Show the real markings next to the answers:{" "}
                <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontWeight: 900 }}>pp p mf f ff</span>, cresc.{" "}
                <Hairpin dir="cresc" height={10} /> and dim. <Hairpin dir="dim" height={10} /> (phones always show the short marking)
              </span>
            </span>
          </label>
        </section>

        <RunnerCard runner={runner} onChange={() => setPicking("change")} />

        <section style={{ ...card, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
          <div>
            <div style={{ fontWeight: 900 }}>🔉 Volume check</div>
            <div style={{ fontWeight: 600, fontSize: "0.85rem", opacity: 0.7 }}>
              {volumeSet ? "Done on this device. Do it again if the sound changed." : "Not done on this device yet (it runs before your first game)."}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              unlockNoteAudio();
              setAfterVolume("settings");
              setScreen("volume");
            }}
            style={{ ...option(false), textAlign: "center", fontWeight: 800, whiteSpace: "nowrap" }}
          >
            {volumeSet ? "Check again" : "Do it now"}
          </button>
        </section>

        <button
          type="button"
          onClick={play}
          style={{
            fontSize: "1.25rem",
            fontWeight: 900,
            padding: "0.95rem",
            borderRadius: radius.button,
            border: "none",
            background: colors.greenButton,
            boxShadow: solidShadow(4, colors.greenButtonShadow),
            color: colors.white,
            cursor: "pointer",
          }}
        >
          Into town!
        </button>
        <p style={{ margin: 0, textAlign: "center", fontSize: "0.85rem", fontWeight: 700, opacity: 0.6 }}>Sound on 🔊 · Headphones or a quiet room help</p>
      </div>
    </main>
  );
}

const card: React.CSSProperties = {
  background: colors.white,
  borderRadius: radius.card,
  padding: "1rem",
  boxShadow: solidShadow(4, colors.rosterCardShadow),
  display: "flex",
  flexDirection: "column",
  gap: "0.6rem",
};

function option(on: boolean): React.CSSProperties {
  return {
    textAlign: "left",
    padding: "0.75rem 0.9rem",
    borderRadius: "14px",
    border: `2px solid ${on ? colors.blueText : colors.neutralGray}`,
    background: on ? colors.blueBackground : colors.white,
    color: colors.textPrimary,
    cursor: "pointer",
  };
}
