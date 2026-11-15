"use client";

import { colors, radius } from "@/lib/theme";
import {
  CLEF_LABELS,
  MAX_QUESTIONS,
  NAMING_LABELS,
  NOTE_LEVEL_LABELS,
  type ClefChoice,
  type NamingSystem,
  type NoteLevel,
  type NoteReadingConfig,
} from "@/lib/noteReading";

// The settings a teacher picks every time the shared Note Reading game is
// played: Individual mode, Team Battle setup and Assign all use this same
// panel. Questions are generated from them at play time
// (lib/noteReading.ts), so nothing here is saved on the game itself.

function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <span style={{ fontSize: "0.8rem", fontWeight: 800, opacity: 0.7 }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {(Object.keys(options) as T[]).map((key) => {
          const active = key === value;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onChange(key)}
              aria-pressed={active}
              style={{
                fontSize: "0.82rem",
                fontWeight: 800,
                padding: "0.4rem 0.8rem",
                borderRadius: radius.pill,
                border: active ? "none" : `1px solid ${colors.inputBorder}`,
                background: active ? colors.blueText : colors.listRowBg,
                color: active ? colors.white : colors.textPrimary,
                cursor: "pointer",
              }}
            >
              {options[key]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function NoteReadingSettings({
  value,
  onChange,
  showCount = true,
}: {
  value: NoteReadingConfig;
  onChange: (next: NoteReadingConfig) => void;
  showCount?: boolean;
}) {
  const set = (patch: Partial<NoteReadingConfig>) => onChange({ ...value, ...patch });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", textAlign: "left" }}>
      <ChoiceRow<ClefChoice> label="Clef" value={value.clef} options={CLEF_LABELS} onChange={(clef) => set({ clef })} />
      <ChoiceRow<NoteLevel>
        label="Level"
        value={value.level}
        options={NOTE_LEVEL_LABELS}
        onChange={(level) => set({ level })}
      />
      {value.level === "hard" && (
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.88rem", fontWeight: 700 }}>
          <input
            type="checkbox"
            checked={value.accidentals}
            onChange={(e) => set({ accidentals: e.target.checked })}
          />
          Include sharps and flats (♯ ♭)
        </label>
      )}
      <ChoiceRow<NamingSystem>
        label="Note names"
        value={value.naming}
        options={NAMING_LABELS}
        onChange={(naming) => set({ naming })}
      />
      {showCount && (
        <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.88rem", fontWeight: 800 }}>
          Number of questions
          <input
            type="number"
            min={1}
            max={MAX_QUESTIONS}
            value={value.count || ""}
            // Clamped to the minimum only on blur, so typing "12" isn't
            // turned into "1" after the first keystroke.
            onChange={(e) => set({ count: Math.min(MAX_QUESTIONS, Number(e.target.value) || 0) })}
            onBlur={() => set({ count: Math.max(1, value.count) })}
            style={{
              width: "4rem",
              fontSize: "0.9rem",
              fontWeight: 700,
              padding: "0.3rem 0.5rem",
              borderRadius: "6px",
              border: `1px solid ${colors.inputBorder}`,
              direction: "ltr",
            }}
          />
        </label>
      )}
    </div>
  );
}
