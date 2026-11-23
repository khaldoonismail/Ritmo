"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { colors, radius, solidShadow } from "@/lib/theme";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

// The Exit button every game shows in its top bar while playing, the same
// round ✕ in the same place (top right, after the round pause button,
// which is here too so the two always match), and the friendly "Leave the
// game?" confirm it opens.
//
//   const exit = useGameExit({ pause, resume, inRun: () => phase is playing/paused });
//   <ExitButton onClick={exit.ask} compact={compact} />
//   {exit.asking && <LeaveConfirm onStay={exit.stay} onLeave={exit.leave} />}
//
// Leaving goes back to where the child came from: the student dashboard
// for a signed-in student (and anything under /student), the games library
// for a signed-in teacher, otherwise the previous page (or the home page).

export const STUDENT_HOME = "/student/dashboard";
export const TEACHER_HOME = "/games/teacher/library";

// Where Exit leads from this page, or null for "the previous page".
async function findExitTarget(): Promise<string | null> {
  if (window.location.pathname.startsWith("/student/")) return STUDENT_HOME;
  try {
    const { data } = await createBrowserSupabaseClient().auth.getSession();
    if (data.session) return TEACHER_HOME;
  } catch {
    // no teacher session
  }
  try {
    const res = await fetch("/api/student/character", { cache: "no-store" });
    if (res.ok) return STUDENT_HOME;
  } catch {
    // offline: fall back to the previous page
  }
  return null;
}

// The pieces a game passes in. `inRun` says whether leaving would cut a
// run short (playing or paused): only then is the child asked first.
export interface GameExitOptions {
  pause?: () => void;
  resume?: () => void;
  inRun?: () => boolean;
  // Runs just before leaving (an assignment saves a run that has answers);
  // a returned promise is waited for (up to 4 s) so the save lands first.
  beforeLeave?: () => void | Promise<unknown>;
  // A fixed place to go instead of working it out.
  to?: string;
}

export function useGameExit(options: GameExitOptions = {}) {
  const router = useRouter();
  const opts = useRef(options);
  opts.current = options;
  const [asking, setAsking] = useState(false);
  // For the games' keyboard handlers: while the confirm is open, game keys
  // (Esc / P / Space resume, arrows move) must do nothing.
  const askingRef = useRef(false);
  const target = useRef<Promise<string | null> | null>(null);

  useEffect(() => {
    const t = options.to ? Promise.resolve(options.to) : findExitTarget();
    target.current = t;
    t.then((to) => to && router.prefetch(to)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setAsk = (v: boolean) => {
    askingRef.current = v;
    setAsking(v);
  };

  const go = useCallback(async () => {
    const to = await (target.current ?? Promise.resolve(null)).catch(() => null);
    if (to) router.push(to);
    else if (window.history.length > 1) router.back();
    else router.push("/");
  }, [router]);

  const leave = useCallback(async () => {
    setAsk(false);
    let before: void | Promise<unknown> = undefined;
    try {
      before = opts.current.beforeLeave?.();
    } catch {
      // leave anyway
    }
    if (before) await Promise.race([before.catch(() => {}), new Promise((r) => window.setTimeout(r, 4000))]);
    go();
  }, [go]);

  // The ✕ was tapped: pause and ask, or (nothing to lose) just leave.
  const ask = useCallback(() => {
    const o = opts.current;
    if (o.inRun && !o.inRun()) {
      leave();
      return;
    }
    o.pause?.();
    setAsk(true);
  }, [leave]);

  const stay = useCallback(() => {
    setAsk(false);
    opts.current.resume?.();
  }, []);

  return { asking, askingRef, ask, stay, leave };
}

// The round top-bar buttons (✕ and pause): 48 px (44 px in the compact
// phone layout), as big as a child's fingertip, white on the 3D games and
// see-through on the dark/green quiz screens. Same look in every game.
function roundStyle(compact: boolean, dark: boolean, style?: CSSProperties): CSSProperties {
  const size = compact ? 44 : 48;
  return {
    width: size,
    height: size,
    flex: "0 0 auto",
    borderRadius: "50%",
    border: "none",
    display: "grid",
    placeItems: "center",
    padding: 0,
    cursor: "pointer",
    pointerEvents: "auto",
    fontSize: compact ? "1.15rem" : "1.3rem",
    fontWeight: 900,
    lineHeight: 1,
    background: dark ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.92)",
    color: dark ? colors.white : colors.textPrimary,
    boxShadow: dark ? "none" : "0 3px 0 rgba(0,0,0,0.12)",
    ...style,
  };
}

type RoundProps = {
  onClick: () => void;
  compact?: boolean;
  // On a dark/green background (the quiz screens): a see-through button.
  dark?: boolean;
  style?: CSSProperties;
};

export function ExitButton({ onClick, compact = false, dark = false, style }: RoundProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Exit the game"
      title="Exit"
      data-game-exit=""
      style={roundStyle(compact, dark, style)}
    >
      <span aria-hidden="true">✕</span>
    </button>
  );
}

// Pause (two bars), or Resume (a triangle) when `paused` (the Note Reading quiz toggles
// its pause with the same button).
export function PauseButton({ onClick, compact = false, dark = false, style, paused = false }: RoundProps & { paused?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={paused ? "Resume" : "Pause"}
      title={paused ? "Resume" : "Pause"}
      style={roundStyle(compact, dark, style)}
    >
      {/* Drawn, not typed: a font's ❚❚ can merge into one block, and iOS
          shows ▶ as a colour emoji. */}
      <svg aria-hidden="true" width="0.95em" height="0.95em" viewBox="0 0 16 16" fill="currentColor" style={{ display: "block" }}>
        {paused ? <path d="M4.5 2.5v11l9-5.5z" /> : <><rect x="3" y="2.5" width="3.6" height="11" rx="1" /><rect x="9.4" y="2.5" width="3.6" height="11" rx="1" /></>}
      </svg>
    </button>
  );
}

// "Leave the game?": Keep playing (big, focused, the default) or Leave.
// Esc keeps playing. Covers the whole screen, above the game's own panels.
export function LeaveConfirm({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  const stayRef = useRef<HTMLButtonElement>(null);
  const onStayRef = useRef(onStay);
  onStayRef.current = onStay;
  useEffect(() => {
    stayRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        onStayRef.current();
      }
    };
    // Capture phase: runs before the game's own key handler.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="leave-game-title"
      data-leave-confirm=""
      onClick={(e) => {
        // A tap on the dimmed background keeps playing.
        if (e.target === e.currentTarget) onStay();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        background: "rgba(43,43,43,0.45)",
      }}
    >
      <div
        style={{
          background: colors.background,
          color: colors.textPrimary,
          borderRadius: "20px",
          padding: "min(1.5rem, 5vh) 1.25rem",
          width: "min(360px, 100%)",
          maxHeight: "100%",
          overflowY: "auto",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "min(0.85rem, 3vh)",
          textAlign: "center",
          boxShadow: "0 6px 0 rgba(0,0,0,0.15)",
        }}
      >
        <div style={{ fontSize: "2.2rem", lineHeight: 1 }} aria-hidden="true">
          🚪
        </div>
        <h2 id="leave-game-title" style={{ margin: 0, fontSize: "1.5rem", fontWeight: 900 }}>
          Leave the game?
        </h2>
        <button
          ref={stayRef}
          type="button"
          onClick={onStay}
          style={{
            fontSize: "1.2rem",
            fontWeight: 900,
            padding: "0.95rem",
            minHeight: 56,
            borderRadius: radius.button,
            border: "none",
            background: colors.greenButton,
            boxShadow: solidShadow(4, colors.greenButtonShadow),
            color: colors.white,
            cursor: "pointer",
          }}
        >
          Keep playing
        </button>
        <button
          type="button"
          onClick={onLeave}
          style={{
            fontSize: "1rem",
            fontWeight: 800,
            padding: "0.7rem",
            minHeight: 46,
            borderRadius: radius.button,
            border: `2px solid ${colors.coralText}`,
            background: colors.white,
            color: colors.coralText,
            cursor: "pointer",
          }}
        >
          Leave
        </button>
      </div>
    </div>
  );
}
