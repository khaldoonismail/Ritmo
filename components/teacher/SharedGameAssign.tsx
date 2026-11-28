"use client";

import { useState } from "react";
import { colors, radius } from "@/lib/theme";
import { NAMING_LABELS, settingsLabel, type NamingSystem } from "@/lib/noteReading";
import { PIANO_LEVELS, type PianoLevel } from "@/lib/pianoHop";
import { HAPPY_OR_SAD_LABELS, HAPPY_OR_SAD_LEVELS, type Labels } from "@/lib/happyOrSad/round";
import type { HappyOrSadLevel } from "@/lib/happyOrSad/pieces";
import { LEVELS as TRAIN_LEVELS, type TrainLevel } from "@/lib/fastOrSlow/music";
import { LEVELS as TOWN_LEVELS, type DynLevel } from "@/lib/loudOrSoft/music";
import {
  ALL_METERS,
  LEVELS as RHYTHM_LEVELS,
  MODE_LABELS,
  NOTE_VALUES,
  PRESET_CHOICES,
  REST_VALUES,
  TEMPOS,
  TEMPO_LABELS,
  bpmFor,
  choiceProblem,
  presetOf,
  type RhythmChoice,
  type RhythmLevel,
  type RhythmMode,
  type RhythmValue,
  type Tempo,
} from "@/lib/rhythmJump";
import { ValueSymbol } from "@/components/rhythmJump/Notation";
import {
  normalizeHappyOrSadSettings,
  normalizeLoudOrSoftSettings,
  normalizeMusicTrainSettings,
  normalizePianoHopSettings,
  normalizeRhythmJumpSettings,
  rhythmPlayLevel,
  type SharedGameSettings,
} from "@/lib/sharedGames";

// The Assign panel for Piano Hop, Happy or Sad, Rhythm Jump, Music Train
// and Sleepy Town (the class page's "Choose settings…"). Hands back normalized
// settings (lib/sharedGames.ts), saved on the assignment.

const LEVEL_KEYS = ["easy", "medium", "hard"] as const;

const panelStyle: React.CSSProperties = {
  flexBasis: "100%",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
  padding: "0.75rem",
  borderRadius: "12px",
  background: "#FFFFFF",
};

const note: React.CSSProperties = { fontSize: "0.8rem", fontWeight: 600, opacity: 0.7 };
const heading: React.CSSProperties = { fontSize: "0.8rem", fontWeight: 800, opacity: 0.7 };

function OptionList<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string; detail?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }} role="radiogroup" aria-label={label}>
      <span style={heading}>{label}</span>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.key)}
            style={{
              textAlign: "left",
              padding: "0.5rem 0.75rem",
              borderRadius: radius.iconSquare,
              border: `2px solid ${on ? colors.blueText : colors.inputBorder}`,
              background: on ? colors.blueBackground : colors.white,
              color: colors.textPrimary,
              cursor: "pointer",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: "0.88rem" }}>{o.label}</div>
            {o.detail && <div style={{ fontWeight: 600, fontSize: "0.75rem", opacity: 0.7 }}>{o.detail}</div>}
          </button>
        );
      })}
    </div>
  );
}

function Pills<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }} role="radiogroup" aria-label={label}>
      <span style={heading}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {options.map((o) => {
          const on = o.key === value;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.key)}
              style={{
                fontSize: "0.82rem",
                fontWeight: 800,
                padding: "0.4rem 0.8rem",
                borderRadius: radius.pill,
                border: on ? "none" : `1px solid ${colors.inputBorder}`,
                background: on ? colors.blueText : colors.listRowBg,
                color: on ? colors.white : colors.textPrimary,
                cursor: "pointer",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Check({ label, detail, checked, onChange }: { label: string; detail?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "0.6rem", cursor: "pointer" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 20, height: 20, accentColor: colors.blueText }} />
      <span>
        <span style={{ fontWeight: 800, fontSize: "0.88rem" }}>{label}</span>
        {detail && <span style={{ display: "block", fontWeight: 600, fontSize: "0.75rem", opacity: 0.7 }}>{detail}</span>}
      </span>
    </label>
  );
}

const namingOptions = (["solfege", "letters"] as NamingSystem[]).map((k) => ({ key: k, label: NAMING_LABELS[k] }));

export default function SharedGameAssign({
  generator,
  busy,
  onAssign,
}: {
  generator: SharedGameSettings["game"];
  busy: boolean;
  onAssign: (settings: SharedGameSettings) => void;
}) {
  // Piano Hop
  const [pianoLevel, setPianoLevel] = useState<PianoLevel>("easy");
  const [naming, setNaming] = useState<NamingSystem>("solfege");
  // Happy or Sad
  const [happyLevel, setHappyLevel] = useState<HappyOrSadLevel>("easy");
  const [labels, setLabels] = useState<Labels>("mood");
  // Music Train
  const [trainLevel, setTrainLevel] = useState<TrainLevel>("easy");
  const [italian, setItalian] = useState(false);
  // Sleepy Town
  const [townLevel, setTownLevel] = useState<DynLevel>("easy");
  const [markings, setMarkings] = useState(false);
  // Rhythm Jump
  const [rhythms, setRhythms] = useState<RhythmLevel | "custom">("easy");
  const [choice, setChoice] = useState<RhythmChoice>(PRESET_CHOICES.easy);
  const [mode, setMode] = useState<RhythmMode>("read");
  const [tempo, setTempo] = useState<Tempo>("normal");
  const [syllables, setSyllables] = useState(true);

  let settings: SharedGameSettings;
  let intro: string;
  let problem: string | null = null;
  let body: React.ReactNode;

  if (generator === "piano_hop") {
    settings = normalizePianoHopSettings({ level: pianoLevel, naming });
    intro = "An endless run: 3 hearts. Students can play as often as they like; their best run (most points) counts.";
    body = (
      <>
        <OptionList
          label="Level"
          value={pianoLevel}
          onChange={setPianoLevel}
          options={LEVEL_KEYS.map((k) => ({ key: k, label: PIANO_LEVELS[k].label, detail: PIANO_LEVELS[k].detail }))}
        />
        <Pills label="Note names" value={naming} onChange={setNaming} options={namingOptions} />
      </>
    );
  } else if (generator === "happy_or_sad") {
    settings = normalizeHappyOrSadSettings({ level: happyLevel, labels });
    intro = "Rounds of 10 pieces. Students can play as often as they like; their best round (most right) counts.";
    body = (
      <>
        <OptionList label="Level" value={happyLevel} onChange={setHappyLevel} options={HAPPY_OR_SAD_LEVELS} />
        <Pills label="Answer words" value={labels} onChange={setLabels} options={HAPPY_OR_SAD_LABELS} />
      </>
    );
  } else if (generator === "music_train") {
    settings = normalizeMusicTrainSettings({ level: trainLevel, italian });
    intro = "Rounds of 10 pieces. Students can play as often as they like; their best round (most right) counts.";
    body = (
      <>
        <OptionList
          label="Level"
          value={trainLevel}
          onChange={setTrainLevel}
          options={LEVEL_KEYS.map((k) => ({ key: k, label: TRAIN_LEVELS[k].label, detail: TRAIN_LEVELS[k].detail }))}
        />
        <Check label="Italian tempo words" detail="Largo, Andante, Allegro… on the buttons" checked={italian} onChange={setItalian} />
      </>
    );
  } else if (generator === "loud_or_soft") {
    settings = normalizeLoudOrSoftSettings({ level: townLevel, markings });
    intro = "Rounds of 10 pieces. Students can play as often as they like; their best round (most right) counts.";
    body = (
      <>
        <OptionList
          label="Level"
          value={townLevel}
          onChange={setTownLevel}
          options={LEVEL_KEYS.map((k) => ({ key: k, label: TOWN_LEVELS[k].label, detail: TOWN_LEVELS[k].detail }))}
        />
        <Check
          label="Dynamic markings"
          detail="pp, p, mf, f, ff, cresc. and dim. next to the answers (phones always show the short marking)"
          checked={markings}
          onChange={setMarkings}
        />
      </>
    );
  } else {
    const custom = rhythms === "custom";
    problem = custom ? choiceProblem(choice) : null;
    settings = normalizeRhythmJumpSettings({ rhythms, custom: choice, mode, tempo, syllables });
    intro = "Rounds of 8 rhythms. Students can play as often as they like; their best round (best timing) counts.";
    const pick = (r: RhythmLevel | "custom") => {
      setRhythms(r);
      if (r !== "custom") setChoice(PRESET_CHOICES[r]);
    };
    const toggle = (next: RhythmChoice) => {
      setChoice(next);
      setRhythms(presetOf(next) ?? "custom");
    };
    const toggleValue = (v: RhythmValue) =>
      toggle({ ...choice, values: choice.values.includes(v.key) ? choice.values.filter((k) => k !== v.key) : [...choice.values, v.key] });
    const toggleMeter = (m: number) =>
      toggle({ ...choice, meters: choice.meters.includes(m) ? choice.meters.filter((x) => x !== m) : [...choice.meters, m].sort() });
    body = (
      <>
        <OptionList
          label="Rhythms"
          value={rhythms}
          onChange={pick}
          options={[
            ...LEVEL_KEYS.map((k) => ({ key: k as RhythmLevel | "custom", label: RHYTHM_LEVELS[k].label, detail: RHYTHM_LEVELS[k].detail })),
            { key: "custom", label: "Custom", detail: "Choose exactly which notes, rests and time signatures appear" },
          ]}
        />
        {custom && (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
            <ValueToggles title="Note values" values={NOTE_VALUES} chosen={choice.values} onToggle={toggleValue} />
            <ValueToggles title="Rests" values={REST_VALUES} chosen={choice.values} onToggle={toggleValue} />
            <span style={heading}>Time signatures</span>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              {ALL_METERS.map((m) => (
                <label key={m} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontWeight: 800, cursor: "pointer" }}>
                  <input type="checkbox" checked={choice.meters.includes(m)} onChange={() => toggleMeter(m)} style={{ accentColor: colors.blueText }} />
                  {m}/4
                </label>
              ))}
            </div>
            {problem && (
              <div role="alert" style={{ fontSize: "0.8rem", fontWeight: 700, color: colors.coralText }}>
                {problem}
              </div>
            )}
          </div>
        )}
        <Pills
          label="Mode"
          value={mode}
          onChange={setMode}
          options={(["read", "echo"] as RhythmMode[]).map((k) => ({ key: k, label: MODE_LABELS[k] }))}
        />
        <Pills
          label={`Tempo (${bpmFor(rhythmPlayLevel(settings), tempo)} beats a minute)`}
          value={tempo}
          onChange={setTempo}
          options={TEMPOS.map((t) => ({ key: t, label: TEMPO_LABELS[t] }))}
        />
        <Check label="Rhythm syllables" detail="Ta, Ti-ti, Ta-a, Sh under the notes" checked={syllables} onChange={setSyllables} />
      </>
    );
  }

  return (
    <div style={panelStyle}>
      <span style={note}>{intro}</span>
      {body}
      <div>
        <button
          type="button"
          onClick={() => onAssign(settings)}
          disabled={busy || !!problem}
          style={{
            fontSize: "0.85rem",
            fontWeight: 800,
            padding: "0.5rem 1rem",
            borderRadius: radius.button,
            border: "none",
            background: problem ? colors.neutralGray : colors.blueText,
            color: colors.white,
            cursor: busy || problem ? "default" : "pointer",
            textAlign: "left",
          }}
        >
          {problem ? "Assign" : `Assign ${settingsLabel(settings)}`}
        </button>
      </div>
    </div>
  );
}

function ValueToggles({
  title,
  values,
  chosen,
  onToggle,
}: {
  title: string;
  values: RhythmValue[];
  chosen: string[];
  onToggle: (v: RhythmValue) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
      <span style={heading}>{title}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {values.map((v) => {
          const on = chosen.includes(v.key);
          return (
            <button
              key={v.key}
              type="button"
              aria-pressed={on}
              title={v.label}
              onClick={() => onToggle(v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.3rem",
                padding: "0.2rem 0.55rem",
                borderRadius: radius.iconSquare,
                border: `2px solid ${on ? colors.blueText : colors.inputBorder}`,
                background: on ? colors.blueBackground : colors.white,
                color: colors.textPrimary,
                cursor: "pointer",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              <ValueSymbol tokens={v.tokens} height={30} />
              {v.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
