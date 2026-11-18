"use client";

import { useEffect, useState } from "react";
import { colors, radius, solidShadow } from "@/lib/theme";
import CharacterPicker from "./CharacterPicker";
import SvgPuppet from "./SvgPuppet";
import {
  CHARACTER_KINDS,
  DEFAULT_CHARACTER,
  hasSavedCharacter,
  loadCharacter,
  saveCharacter,
  type CharacterChoice,
} from "./choice";

// The runner choice on a game's start page, shared by Note Runner and Up
// or Down: the saved choice (or the default boy), whether one was ever
// made on this device, and the picker screen.

export function useRunnerChoice() {
  const [runner, setRunner] = useState<CharacterChoice>(DEFAULT_CHARACTER);
  const [chosen, setChosen] = useState(true);
  // What the picker is open for: null, "change" (back to the page) or
  // "start" (then the game starts).
  const [picking, setPicking] = useState<null | "change" | "start">(null);
  useEffect(() => {
    setRunner(loadCharacter());
    setChosen(hasSavedCharacter());
  }, []);
  const save = (c: CharacterChoice) => {
    setRunner(c);
    saveCharacter(c);
    setChosen(true);
  };
  return { runner, chosen, picking, setPicking, save };
}

// Full-screen picker; `onDone` gets the confirmed choice.
export function RunnerPickerScreen({
  initial,
  mode,
  onDone,
}: {
  initial: CharacterChoice;
  mode: "change" | "start";
  onDone: (c: CharacterChoice) => void;
}) {
  const [draft, setDraft] = useState(initial);
  return (
    <CharacterPicker
      value={draft}
      onChange={setDraft}
      onDone={() => onDone(draft)}
      doneLabel={mode === "start" ? "Let’s run!" : "Done"}
    />
  );
}

// "Your runner" card for the start page.
export function RunnerCard({ runner, onChange }: { runner: CharacterChoice; onChange: () => void }) {
  const name = CHARACTER_KINDS.find((k) => k.kind === runner.kind)?.name ?? "";
  return (
    <section
      style={{
        background: colors.white,
        borderRadius: radius.card,
        padding: "0.6rem 1rem",
        boxShadow: solidShadow(4, colors.rosterCardShadow),
        display: "flex",
        alignItems: "center",
        gap: "0.9rem",
      }}
    >
      <div style={{ width: 84, height: 84, borderRadius: 14, background: "#E7F7FF", flexShrink: 0, overflow: "hidden" }}>
        <SvgPuppet choice={runner} style={{ width: "100%", height: "100%" }} label={`Your runner: ${name}`} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 900 }}>Your runner</div>
        <div style={{ fontWeight: 700, opacity: 0.7 }}>{name}</div>
      </div>
      <button
        type="button"
        onClick={onChange}
        style={{
          fontSize: "0.95rem",
          fontWeight: 800,
          padding: "0.55rem 0.9rem",
          borderRadius: "14px",
          border: `1px solid ${colors.neutralGray}`,
          background: colors.white,
          color: colors.textPrimary,
          cursor: "pointer",
        }}
      >
        Change
      </button>
    </section>
  );
}
