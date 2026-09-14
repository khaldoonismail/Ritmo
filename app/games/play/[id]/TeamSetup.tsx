"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { colors, radius, solidShadow } from "@/lib/theme";
import { defaultTeamColor, shadowForColor, teamColorPalette } from "@/lib/teamColors";

interface ClassRow {
  id: string;
  name: string;
}

interface StudentRow {
  id: string;
  name: string;
}

interface TeamDraft {
  name: string;
  color: string;
}

export interface TeamSetupConfig {
  classId: string;
  teams: TeamDraft[];
  // One entry per roster student who will be pre-assigned to a team before
  // the session starts (see TeamBattleHost.handleStart).
  assignments: { studentId: string; teamIndex: number }[];
  timerEnabled: boolean;
  timeLimitSeconds: number;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const fieldCardStyle = {
  width: "100%",
  maxWidth: "560px",
  background: colors.white,
  borderRadius: radius.card,
  boxShadow: solidShadow(4, colors.gamesCardShadow),
  padding: "1rem 1.25rem",
  textAlign: "left" as const,
};

export default function TeamSetup({
  onStart,
  starting,
}: {
  onStart: (config: TeamSetupConfig) => void;
  starting: boolean;
}) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState("");
  const [roster, setRoster] = useState<StudentRow[]>([]);
  const [loadingRoster, setLoadingRoster] = useState(false);

  const [teamCount, setTeamCount] = useState(2);
  const [teams, setTeams] = useState<TeamDraft[]>([
    { name: "Team 1", color: defaultTeamColor(0).hex },
    { name: "Team 2", color: defaultTeamColor(1).hex },
  ]);

  const [assignMode, setAssignMode] = useState<"auto" | "manual">("auto");
  const [manualAssignments, setManualAssignments] = useState<Record<string, number>>({});

  const [timerEnabled, setTimerEnabled] = useState(true);
  const [timeLimitSeconds, setTimeLimitSeconds] = useState(20);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;
      const { data: teacherRow } = await supabase
        .from("teachers")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();
      if (!teacherRow) return;
      const { data } = await supabase
        .from("classes")
        .select("id, name")
        .eq("teacher_id", teacherRow.id)
        .order("name");
      setClasses(data || []);
      if (data && data.length > 0) setClassId(data[0].id);
    }
    load();
  }, []);

  useEffect(() => {
    if (!classId) {
      setRoster([]);
      return;
    }
    const supabase = createBrowserSupabaseClient();
    setLoadingRoster(true);
    supabase
      .from("students")
      .select("id, name")
      .eq("class_id", classId)
      .order("name")
      .then(({ data }) => {
        setRoster(data || []);
        setManualAssignments({});
        setLoadingRoster(false);
      });
  }, [classId]);

  function updateTeamCount(next: number) {
    const clamped = Math.max(2, Math.min(6, next));
    setTeamCount(clamped);
    setTeams((prev) => {
      const copy = [...prev];
      while (copy.length < clamped) {
        copy.push({ name: `Team ${copy.length + 1}`, color: defaultTeamColor(copy.length).hex });
      }
      return copy.slice(0, clamped);
    });
    setManualAssignments((prev) => {
      const next2: Record<string, number> = {};
      for (const [studentId, teamIndex] of Object.entries(prev)) {
        if (teamIndex < clamped) next2[studentId] = teamIndex;
      }
      return next2;
    });
  }

  function updateTeamName(index: number, name: string) {
    setTeams((prev) => prev.map((t, i) => (i === index ? { ...t, name } : t)));
  }

  function updateTeamColor(index: number, color: string) {
    setTeams((prev) => prev.map((t, i) => (i === index ? { ...t, color } : t)));
  }

  function assignStudent(studentId: string, teamIndex: number) {
    setManualAssignments((prev) => ({ ...prev, [studentId]: teamIndex }));
  }

  function autoFillRemaining() {
    setManualAssignments((prev) => {
      const next = { ...prev };
      const unassigned = roster.filter((s) => next[s.id] === undefined);
      const counts = new Array(teamCount).fill(0);
      for (const teamIndex of Object.values(next)) counts[teamIndex]++;
      for (const student of shuffle(unassigned)) {
        let smallest = 0;
        for (let i = 1; i < teamCount; i++) if (counts[i] < counts[smallest]) smallest = i;
        next[student.id] = smallest;
        counts[smallest]++;
      }
      return next;
    });
  }

  const readyToStart = useMemo(() => {
    if (!classId || roster.length === 0) return false;
    if (teams.some((t) => !t.name.trim())) return false;
    if (assignMode === "manual") {
      return roster.every((s) => manualAssignments[s.id] !== undefined);
    }
    return true;
  }, [classId, roster, teams, assignMode, manualAssignments]);

  function handleStart() {
    let assignments: { studentId: string; teamIndex: number }[];
    if (assignMode === "auto") {
      const counts = new Array(teamCount).fill(0);
      assignments = shuffle(roster).map((s) => {
        let smallest = 0;
        for (let i = 1; i < teamCount; i++) if (counts[i] < counts[smallest]) smallest = i;
        counts[smallest]++;
        return { studentId: s.id, teamIndex: smallest };
      });
    } else {
      assignments = roster
        .filter((s) => manualAssignments[s.id] !== undefined)
        .map((s) => ({ studentId: s.id, teamIndex: manualAssignments[s.id] }));
    }
    onStart({ classId, teams, assignments, timerEnabled, timeLimitSeconds });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
      <div style={fieldCardStyle}>
        <div style={{ fontWeight: 800, marginBottom: "0.6rem" }}>Class</div>
        {classes.length === 0 ? (
          <p style={{ margin: 0, opacity: 0.7, fontSize: "0.9rem" }}>
            You need a class with students to host Team Battle.
          </p>
        ) : (
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            style={{
              width: "100%",
              fontSize: "0.95rem",
              fontWeight: 700,
              padding: "0.5rem 0.6rem",
              borderRadius: "8px",
              border: `1px solid ${colors.inputBorder}`,
            }}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div style={fieldCardStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "0.75rem",
          }}
        >
          <span style={{ fontWeight: 800 }}>Number of teams</span>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <button
              onClick={() => updateTeamCount(teamCount - 1)}
              disabled={teamCount <= 2}
              style={stepperButtonStyle}
            >
              −
            </button>
            <span style={{ fontWeight: 800, minWidth: "1.5rem", textAlign: "center" }}>
              {teamCount}
            </span>
            <button
              onClick={() => updateTeamCount(teamCount + 1)}
              disabled={teamCount >= 6}
              style={stepperButtonStyle}
            >
              +
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {teams.map((team, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <input
                value={team.name}
                onChange={(e) => updateTeamName(i, e.target.value)}
                style={{
                  flex: 1,
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  padding: "0.4rem 0.6rem",
                  borderRadius: "8px",
                  border: `1px solid ${colors.inputBorder}`,
                }}
              />
              <div style={{ display: "flex", gap: "0.25rem" }}>
                {teamColorPalette.map((c) => (
                  <button
                    key={c.hex}
                    onClick={() => updateTeamColor(i, c.hex)}
                    aria-label={c.name}
                    style={{
                      width: "22px",
                      height: "22px",
                      borderRadius: "50%",
                      background: c.hex,
                      border:
                        team.color === c.hex ? `2px solid ${colors.textPrimary}` : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={fieldCardStyle}>
        <div style={{ fontWeight: 800, marginBottom: "0.6rem" }}>Time per question</div>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={!timerEnabled}
            onChange={(e) => setTimerEnabled(!e.target.checked)}
          />
          No time limit
        </label>
        {timerEnabled && (
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginTop: "0.6rem" }}>
            <input
              type="number"
              min={5}
              max={120}
              value={timeLimitSeconds}
              onChange={(e) =>
                setTimeLimitSeconds(Math.max(5, Math.min(Number(e.target.value) || 5, 120)))
              }
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
            <span style={{ fontSize: "0.85rem", opacity: 0.7 }}>seconds</span>
          </div>
        )}
      </div>

      {classId && (
        <div style={fieldCardStyle}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.75rem",
            }}
          >
            <span style={{ fontWeight: 800 }}>Team assignment</span>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              {(["auto", "manual"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setAssignMode(mode)}
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    padding: "0.35rem 0.7rem",
                    borderRadius: radius.pill,
                    border: "none",
                    background: assignMode === mode ? colors.greenButton : colors.background,
                    color: assignMode === mode ? colors.white : colors.textPrimary,
                    cursor: "pointer",
                  }}
                >
                  {mode === "auto" ? "Auto-assign randomly" : "Manual assignment"}
                </button>
              ))}
            </div>
          </div>

          {loadingRoster ? (
            <p style={{ margin: 0, opacity: 0.7, fontSize: "0.9rem" }}>Loading roster…</p>
          ) : roster.length === 0 ? (
            <p style={{ margin: 0, opacity: 0.7, fontSize: "0.9rem" }}>
              This class has no students yet.
            </p>
          ) : assignMode === "auto" ? (
            <p style={{ margin: 0, opacity: 0.7, fontSize: "0.9rem" }}>
              All {roster.length} students in this class will be shuffled evenly across{" "}
              {teamCount} teams when you start.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {roster.map((student) => (
                <div
                  key={student.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                  }}
                >
                  <span style={{ fontSize: "0.9rem", fontWeight: 700 }}>{student.name}</span>
                  <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                    {teams.map((team, i) => {
                      const selected = manualAssignments[student.id] === i;
                      return (
                        <button
                          key={i}
                          onClick={() => assignStudent(student.id, i)}
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            padding: "0.25rem 0.55rem",
                            borderRadius: radius.pill,
                            border: selected ? `2px solid ${colors.textPrimary}` : "2px solid transparent",
                            background: team.color,
                            boxShadow: selected ? solidShadow(2, shadowForColor(team.color)) : "none",
                            color: colors.white,
                            cursor: "pointer",
                          }}
                        >
                          {team.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                onClick={autoFillRemaining}
                style={{
                  alignSelf: "flex-start",
                  marginTop: "0.4rem",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  background: "none",
                  border: "none",
                  color: colors.blueText,
                  cursor: "pointer",
                  padding: 0,
                }}
              >
                Auto-assign remaining students
              </button>
            </div>
          )}
        </div>
      )}

      <button
        onClick={handleStart}
        disabled={!readyToStart || starting}
        style={{
          fontSize: "1.1rem",
          fontWeight: 800,
          padding: "0.85rem 2rem",
          borderRadius: radius.button,
          border: "none",
          background: colors.greenButton,
          boxShadow: solidShadow(5, colors.greenButtonShadow),
          color: colors.white,
          cursor: readyToStart && !starting ? "pointer" : "default",
          opacity: readyToStart && !starting ? 1 : 0.5,
        }}
      >
        {starting ? "Creating session…" : "Start Team Battle Session"}
      </button>
    </div>
  );
}

const stepperButtonStyle: CSSProperties = {
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  border: "none",
  background: colors.background,
  fontWeight: 800,
  fontSize: "1rem",
  cursor: "pointer",
};
