"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { GAMES, SKILLS, SKILL_ORDER, type GameEntry, type SkillArea } from "@/lib/gameRegistry";
import { GamePreview } from "@/components/island/GamePreview";
import { colors, radius, solidShadow } from "@/lib/theme";

// The Game Library: every Ritmo game, from lib/gameRegistry.ts (the same
// list as the students' Music Island), grouped by skill, with search and
// filters. Play demo opens the game's own page; Assign picks a class and
// opens that class's assign section with the game's settings ready
// (app/teacher/classes/[id], ?assign=<generator>), so assigning stays in
// one place. The teacher's own quizzes are under "My games & quizzes".

interface ClassRow {
  id: string;
  name: string;
}

export default function GameLibraryPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassRow[] | null>(null);
  // The shared game row of each generator (Note Reading's demo plays it).
  const [gameIdOf, setGameIdOf] = useState<Record<string, string>>({});
  const [skill, setSkill] = useState<SkillArea | "all">("all");
  const [query, setQuery] = useState("");
  const [assigning, setAssigning] = useState<GameEntry | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let cancelled = false;
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!session) {
        router.push("/accounts/login");
        return;
      }
      const [{ data: classRows }, { data: shared }] = await Promise.all([
        supabase.from("classes").select("id, name").order("created_at", { ascending: false }),
        supabase.from("games").select("id, generator").not("generator", "is", null),
      ]);
      if (cancelled) return;
      setClasses(classRows || []);
      const map: Record<string, string> = {};
      for (const g of shared || []) if (g.generator && !map[g.generator]) map[g.generator] = g.id;
      setGameIdOf(map);
    })().catch(() => setClasses([]));
    return () => {
      cancelled = true;
    };
  }, [router]);

  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () =>
      GAMES.filter((g) => skill === "all" || g.skill === skill).filter(
        (g) => !q || [g.title, g.description, g.teaches, SKILLS[g.skill].label, ...g.levels].some((t) => t.toLowerCase().includes(q))
      ),
    [skill, q]
  );

  const demoHref = (g: GameEntry): string | null => {
    if (g.skill === "class") return "/games/teacher/my-games";
    if (g.route) return g.route;
    return g.generator && gameIdOf[g.generator] ? `/games/play/${gameIdOf[g.generator]}` : null;
  };

  return (
    <main style={{ minHeight: "100dvh", background: colors.background, color: colors.textPrimary, padding: "1.25rem 16px 2.5rem" }}>
      <style>{`
        @keyframes lib-bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-5px) } }
        @keyframes lib-note { 0% { transform: translate(0, 0); opacity: 0 } 20% { opacity: 1 } 100% { transform: translate(14px, -46px); opacity: 0 } }
        @media (prefers-reduced-motion: reduce) { .lib-anim, .lib-anim * { animation: none !important } }
      `}</style>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div>
            <Link href="/games/teacher" style={{ color: "inherit", fontWeight: 800, opacity: 0.6, textDecoration: "none" }}>
              ← Games dashboard
            </Link>
            <h1 style={{ margin: "0.2rem 0 0", fontSize: "2rem", fontWeight: 900 }}>Game Library</h1>
            <p style={{ margin: "0.2rem 0 0", fontWeight: 600, opacity: 0.7 }}>Every Ritmo game, ready to demo in class or assign as homework.</p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/games/teacher/my-games" style={secondary}>
              My games &amp; quizzes
            </Link>
            <Link href="/games/teacher/create-game" style={primary}>
              + Create a quiz
            </Link>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ flex: "1 1 260px", display: "flex", alignItems: "center", gap: 8, background: colors.white, borderRadius: 14, border: `2px solid ${colors.neutralGray}`, padding: "0 0.9rem" }}>
            <span aria-hidden="true">🔍</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search games, skills, topics…"
              aria-label="Search games"
              style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: "1rem", fontWeight: 700, padding: "0.65rem 0", minWidth: 0, color: colors.textPrimary }}
            />
          </label>
          <div role="radiogroup" aria-label="Skill" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {(["all", ...SKILL_ORDER] as const).map((k) => {
              const on = skill === k;
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSkill(k)}
                  style={{
                    padding: "0.45rem 0.85rem",
                    minHeight: 40,
                    borderRadius: 999,
                    fontWeight: 800,
                    fontSize: 14,
                    border: `2px solid ${on ? colors.blueText : colors.neutralGray}`,
                    background: on ? colors.blueBackground : colors.white,
                    color: on ? colors.blueText : colors.textPrimary,
                    cursor: "pointer",
                  }}
                >
                  {k === "all" ? "All" : SKILLS[k].label}
                </button>
              );
            })}
          </div>
        </div>

        {visible.length === 0 && <p style={{ fontWeight: 700, opacity: 0.6, textAlign: "center" }}>No games match &ldquo;{query}&rdquo;.</p>}

        {SKILL_ORDER.map((k) => {
          const gs = visible.filter((g) => g.skill === k);
          if (gs.length === 0) return null;
          return (
            <section key={k} aria-labelledby={`skill-${k}`} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h2 id={`skill-${k}`} style={{ margin: 0, fontSize: "1.3rem", fontWeight: 900 }}>
                {SKILLS[k].label} <span style={{ fontWeight: 700, fontSize: "0.95rem", opacity: 0.55 }}>· {SKILLS[k].blurb}</span>
              </h2>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 230px), 1fr))", gap: 14 }}>
                {gs.map((g) => (
                  <Card key={g.id} g={g} demo={demoHref(g)} onAssign={() => setAssigning(g)} />
                ))}
              </div>
              {k !== "class" && !q && (
                <div style={{ alignSelf: "flex-start", border: `2px dashed ${colors.neutralGray}`, borderRadius: 999, padding: "0.25rem 0.8rem", fontWeight: 800, fontSize: 13, opacity: 0.6 }}>
                  More {SKILLS[k].label.toLowerCase()} games coming soon
                </div>
              )}
            </section>
          );
        })}
      </div>

      {assigning && <AssignDialog game={assigning} classes={classes} onClose={() => setAssigning(null)} />}
    </main>
  );
}

function Card({ g, demo, onAssign }: { g: GameEntry; demo: string | null; onAssign: () => void }) {
  const chip: React.CSSProperties = { padding: "0.15rem 0.55rem", borderRadius: 999, background: "#F3EFE6", fontWeight: 800, fontSize: 12.5 };
  const isClass = g.skill === "class";
  return (
    <article style={{ background: colors.white, borderRadius: radius.card, boxShadow: solidShadow(4, colors.rosterCardShadow), overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <GamePreview game={g} height={118} />
      <div style={{ padding: "0.8rem 0.9rem 0.9rem", display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
        <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 900, display: "flex", alignItems: "center", gap: 6 }}>
          {g.title}
          {g.isNew && <span style={{ background: "#FF6B8A", color: "#FFFFFF", fontWeight: 900, fontSize: 11, padding: "0.1rem 0.45rem", borderRadius: 999 }}>New</span>}
        </h3>
        <p style={{ margin: 0, fontWeight: 600, opacity: 0.75, lineHeight: 1.35, fontSize: "0.92rem" }}>{g.description}</p>
        <p style={{ margin: 0, fontWeight: 600, fontSize: "0.85rem", lineHeight: 1.35 }}>
          <b>Teaches:</b> <span style={{ opacity: 0.8 }}>{g.teaches}</span>
        </p>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <span style={{ ...chip, background: colors.blueBackground, color: colors.blueText }}>{g.levels.join(" · ")}</span>
          <span style={chip}>Ages {g.ages[0]}–{g.ages[1]}</span>
          <span style={chip}>
            {g.roundLength} · ~{g.minutes} min
          </span>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: "auto", paddingTop: 6 }}>
          {demo ? (
            <Link href={demo} style={{ ...secondary, flex: 1, textAlign: "center", padding: "0.55rem 0.4rem" }}>
              {isClass ? "Pick a quiz" : "▶ Play demo"}
            </Link>
          ) : (
            <span style={{ ...secondary, flex: 1, textAlign: "center", padding: "0.55rem 0.4rem", opacity: 0.5 }}>▶ Play demo</span>
          )}
          {isClass ? (
            <Link href="/games/teacher/my-games" style={{ ...primary, flex: 1, textAlign: "center", padding: "0.6rem 0.4rem" }}>
              Host a battle
            </Link>
          ) : g.generator ? (
            <button type="button" onClick={onAssign} style={{ ...primary, flex: 1, padding: "0.6rem 0.4rem" }}>
              Assign
            </button>
          ) : (
            <span title="This game can't be assigned to a class yet" style={{ ...primary, flex: 1, textAlign: "center", padding: "0.6rem 0.4rem", background: colors.neutralGray, boxShadow: "none", color: colors.textPrimary, opacity: 0.7, fontSize: 13 }}>
              Assign soon
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function AssignDialog({ game, classes, onClose }: { game: GameEntry; classes: ClassRow[] | null; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={`Assign ${game.title}`} onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(43,39,69,0.45)", display: "grid", placeItems: "center", padding: 16, zIndex: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: colors.background, borderRadius: 20, padding: "1.2rem 1.3rem", width: "min(420px, 100%)", maxHeight: "90dvh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, boxShadow: "0 6px 0 rgba(0,0,0,0.15)" }}>
        <h2 style={{ margin: 0, fontSize: "1.35rem", fontWeight: 900 }}>Assign {game.title}</h2>
        <p style={{ margin: 0, fontWeight: 600, opacity: 0.7 }}>Choose a class. You&apos;ll pick the level and settings there.</p>
        {classes === null && <p style={{ fontWeight: 700, opacity: 0.6 }}>Loading your classes…</p>}
        {classes?.length === 0 && (
          <p style={{ fontWeight: 700 }}>
            No classes yet.{" "}
            <Link href="/teacher/classes" style={{ color: colors.blueText }}>
              Create a class
            </Link>{" "}
            first.
          </p>
        )}
        {classes?.map((c) => (
          <Link
            key={c.id}
            href={`/teacher/classes/${c.id}?assign=${encodeURIComponent(game.generator ?? "")}`}
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 0.9rem", minHeight: 48, borderRadius: 14, background: colors.white, border: `2px solid ${colors.neutralGray}`, color: colors.textPrimary, fontWeight: 800, textDecoration: "none" }}
          >
            {c.name} <span aria-hidden="true">→</span>
          </Link>
        ))}
        <button type="button" onClick={onClose} style={{ ...secondary, marginTop: 4 }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const primary: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 15,
  padding: "0.65rem 1rem",
  borderRadius: 14,
  border: "none",
  background: colors.greenButton,
  boxShadow: `0 4px 0 ${colors.greenButtonShadow}`,
  color: colors.white,
  cursor: "pointer",
  textDecoration: "none",
  whiteSpace: "nowrap",
  boxSizing: "border-box",
};
const secondary: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 15,
  padding: "0.6rem 1rem",
  borderRadius: 14,
  border: `2px solid ${colors.neutralGray}`,
  background: colors.white,
  color: colors.textPrimary,
  cursor: "pointer",
  textDecoration: "none",
  whiteSpace: "nowrap",
  boxSizing: "border-box",
};
