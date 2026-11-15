"use client";

import NoteStaff from "@/components/NoteStaff";
import { colors, radius, solidShadow } from "@/lib/theme";
import {
  CLEF_LABELS,
  MAX_QUESTIONS,
  NAMING_LABELS,
  NOTE_LEVEL_LABELS,
  type ClefChoice,
  type NamingSystem,
  type NoteLevel,
  type NoteReadingQuestion,
  type NoteReadingSettings,
} from "@/lib/noteReading";

// Settings + preview for an auto-generated Note Reading game on Create Game.
// The page owns the state; this only renders the controls and the
// generated questions (correct answer marked) so the teacher can check them
// and regenerate before saving.

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
              style={{
                fontSize: "0.85rem",
                fontWeight: 800,
                padding: "0.45rem 0.85rem",
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

export default function NoteReadingSetup({
  settings,
  onChange,
  questions,
  onGenerate,
}: {
  settings: NoteReadingSettings;
  onChange: (patch: Partial<NoteReadingSettings>) => void;
  questions: NoteReadingQuestion[];
  onGenerate: () => void;
}) {
  const numberStyle: React.CSSProperties = {
    fontSize: "0.9rem",
    padding: "0.4rem 0.6rem",
    borderRadius: radius.button,
    border: `1px solid ${colors.inputBorder}`,
    background: colors.listRowBg,
    width: "80px",
    fontFamily: "inherit",
  };

  return (
    <div style={{ width: "100%", maxWidth: "1000px", display: "flex", flexDirection: "column", gap: "1rem" }}>
      <div
        style={{
          width: "100%",
          maxWidth: "700px",
          alignSelf: "center",
          background: colors.white,
          borderRadius: radius.card,
          boxShadow: solidShadow(4, colors.gamesCardShadow),
          padding: "1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.9rem",
          textAlign: "left",
        }}
      >
        <ChoiceRow<ClefChoice>
          label="Clef"
          value={settings.clef}
          options={CLEF_LABELS}
          onChange={(clef) => onChange({ clef })}
        />
        <ChoiceRow<NoteLevel>
          label="Level"
          value={settings.level}
          options={NOTE_LEVEL_LABELS}
          onChange={(level) => onChange({ level })}
        />
        {settings.level === "hard" && (
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", fontWeight: 700 }}>
            <input
              type="checkbox"
              checked={settings.accidentals}
              onChange={(e) => onChange({ accidentals: e.target.checked })}
            />
            Include sharps and flats (♯ ♭)
          </label>
        )}
        <ChoiceRow<NamingSystem>
          label="Note names"
          value={settings.naming}
          options={NAMING_LABELS}
          onChange={(naming) => onChange({ naming })}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.25rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 700 }}>
            Questions
            <input
              type="number"
              min={1}
              max={MAX_QUESTIONS}
              value={settings.count}
              onChange={(e) =>
                onChange({ count: Math.max(1, Math.min(MAX_QUESTIONS, Number(e.target.value) || 1)) })
              }
              style={numberStyle}
            />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", fontWeight: 700 }}>
            Time per question (sec)
            <input
              type="number"
              min={5}
              max={120}
              value={settings.timeLimit}
              onChange={(e) =>
                onChange({ timeLimit: Math.max(5, Math.min(120, Number(e.target.value) || 20)) })
              }
              style={numberStyle}
            />
          </label>
        </div>
        <div>
          <button
            type="button"
            onClick={onGenerate}
            style={{
              fontSize: "0.95rem",
              fontWeight: 800,
              padding: "0.6rem 1rem",
              borderRadius: radius.button,
              border: "none",
              background: colors.greenButton,
              boxShadow: solidShadow(3, colors.greenButtonShadow),
              color: colors.white,
              cursor: "pointer",
            }}
          >
            {questions.length > 0 ? "↻ Regenerate questions" : "Generate questions"}
          </button>
        </div>
      </div>

      {questions.length === 0 ? (
        <p style={{ opacity: 0.6, fontWeight: 700, fontSize: "0.9rem", margin: 0, textAlign: "center" }}>
          Pick the settings, then click &quot;Generate questions&quot;
        </p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "center" }}>
          {questions.map((q, index) => (
            <div
              key={q.id}
              data-testid="note-preview"
              style={{
                width: "180px",
                background: colors.white,
                borderRadius: radius.card,
                boxShadow: solidShadow(3, colors.gamesCardShadow),
                padding: "0.5rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              <span style={{ fontSize: "0.75rem", fontWeight: 800, opacity: 0.6 }}>
                {index + 1}. {q.note.clef === "treble" ? "Treble" : "Bass"}
              </span>
              <NoteStaff note={q.note} maxWidth={170} />
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", justifyContent: "center" }}>
                {q.options.map((opt, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 800,
                      padding: "0.15rem 0.5rem",
                      borderRadius: radius.pill,
                      background: i === q.correctIndex ? colors.greenButton : colors.listRowBg,
                      color: i === q.correctIndex ? colors.white : colors.textPrimary,
                    }}
                  >
                    {opt}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
