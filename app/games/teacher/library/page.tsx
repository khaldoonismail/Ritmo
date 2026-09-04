"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { forkGame } from "@/lib/forkGame";
import { colors, radius, solidShadow } from "@/lib/theme";

interface MyGame {
  id: string;
  title: string;
  questions: unknown[];
  is_public: boolean;
  usage_count: number;
}

interface CommunityGame {
  id: string;
  title: string;
  questions: unknown[];
  usage_count: number;
  teachers: { name: string } | { name: string }[] | null;
}

function ownerNameOf(row: CommunityGame): string | null {
  if (Array.isArray(row.teachers)) return row.teachers[0]?.name ?? null;
  return row.teachers?.name ?? null;
}

// "Musical Dynamics" gets a bespoke cover: a grid of its own dynamics
// symbols, each in its own color. Everything else falls back to a
// solid-color cover (picked deterministically from the title) with the
// app's music-note glyph, matching the icon square already used in the
// play-page lobby.
const dynamicsCoverTiles = [
  { symbol: "p", bg: "#3B5CC4" },
  { symbol: "mf", bg: "#D9860F" },
  { symbol: "f", bg: "#C24444" },
  { symbol: "pp", bg: "#D85A30" },
  { symbol: "ff", bg: "#7F77DD" },
  { symbol: "mp", bg: "#2E9E8F" },
];

const coverPalette = [
  colors.greenCard,
  colors.blueText,
  colors.coralText,
  colors.classesText,
  "#7F77DD",
  "#2E9E8F",
];

function coverColorFor(title: string) {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  return coverPalette[hash % coverPalette.length];
}

function GameCover({ title }: { title: string }) {
  if (title === "Musical Dynamics") {
    return (
      <div
        style={{
          height: "96px",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: "4px",
          padding: "8px",
          background: colors.background,
        }}
      >
        {dynamicsCoverTiles.map((t) => (
          <div
            key={t.symbol}
            style={{
              borderRadius: "8px",
              background: t.bg,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontStyle: "italic",
              fontWeight: 800,
              fontSize: "0.8rem",
              color: colors.white,
            }}
          >
            {t.symbol}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        height: "96px",
        background: coverColorFor(title),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ fontSize: "2.2rem", color: colors.white, lineHeight: 1 }}>♪</span>
    </div>
  );
}

export default function GamesLibraryPage() {
  const router = useRouter();
  const [myTeacherId, setMyTeacherId] = useState<string | null>(null);
  const [myGames, setMyGames] = useState<MyGame[] | null>(null);
  const [communityGames, setCommunityGames] = useState<CommunityGame[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copyBusyId, setCopyBusyId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState("");
  const [publishBusyId, setPublishBusyId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/accounts/login");
        return;
      }

      const { data: teacherRow } = await supabase
        .from("teachers")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (!teacherRow) {
        setLoadError("Could not load your teacher account.");
        return;
      }
      setMyTeacherId(teacherRow.id);

      const { data: mine, error: mineError } = await supabase
        .from("games")
        .select("id, title, questions, is_public, usage_count")
        .eq("teacher_id", teacherRow.id)
        .order("created_at", { ascending: false });

      if (mineError) {
        setLoadError(mineError.message);
      } else {
        setMyGames(mine || []);
      }

      const { data: community, error: communityError } = await supabase
        .from("games")
        .select("id, title, questions, usage_count, teachers(name)")
        .eq("is_public", true)
        .neq("teacher_id", teacherRow.id)
        .order("created_at", { ascending: false });

      if (communityError) {
        setLoadError(communityError.message);
      } else {
        setCommunityGames((community as unknown as CommunityGame[]) || []);
      }
    }

    load();
  }, [router]);

  async function deleteGame(id: string) {
    setDeleteError("");
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from("games").delete().eq("id", id);

    if (error) {
      setDeleteError(error.message);
      return;
    }

    setMyGames((prev) => (prev || []).filter((g) => g.id !== id));
  }

  async function togglePublic(game: MyGame) {
    setPublishError("");
    setPublishBusyId(game.id);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from("games")
      .update({ is_public: !game.is_public })
      .eq("id", game.id);

    setPublishBusyId(null);

    if (error) {
      setPublishError(error.message);
      return;
    }

    setMyGames((prev) =>
      (prev || []).map((g) => (g.id === game.id ? { ...g, is_public: !g.is_public } : g))
    );
  }

  async function handleCopy(game: CommunityGame) {
    if (!myTeacherId) return;
    setCopyError("");
    setCopyBusyId(game.id);

    const supabase = createBrowserSupabaseClient();
    const result = await forkGame(supabase, myTeacherId, game);

    setCopyBusyId(null);

    if ("error" in result) {
      setCopyError(result.error);
      return;
    }

    setMyGames((prev) => [
      {
        id: result.id,
        title: game.title,
        questions: game.questions,
        is_public: false,
        usage_count: 0,
      },
      ...(prev || []),
    ]);
  }

  const gridStyle: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: "1rem",
    width: "100%",
  };

  const cardStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    borderRadius: radius.card,
    overflow: "hidden",
    background: colors.white,
    boxShadow: solidShadow(4, colors.rosterCardShadow),
  };

  const cardBodyStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
    padding: "0.7rem 0.85rem 0.85rem",
    textAlign: "left",
  };

  const primaryButtonStyle: React.CSSProperties = {
    fontSize: "0.82rem",
    fontWeight: 800,
    padding: "0.5rem 0.6rem",
    borderRadius: radius.button,
    border: "none",
    background: colors.orange,
    boxShadow: solidShadow(3, colors.orangeShadow),
    color: colors.white,
    cursor: "pointer",
    textDecoration: "none",
    textAlign: "center",
    whiteSpace: "nowrap",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...primaryButtonStyle,
    flex: 1,
    fontSize: "0.75rem",
    padding: "0.4rem 0.4rem",
  };

  const dangerButtonStyle: React.CSSProperties = {
    ...secondaryButtonStyle,
    background: colors.coralText,
    boxShadow: "none",
  };

  function questionCountLabel(count: number) {
    return `${count} question${count === 1 ? "" : "s"}`;
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        gap: "1.5rem",
        background: colors.background,
        color: colors.textPrimary,
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>Games Library</h1>
      <p style={{ fontSize: "1rem", fontWeight: 600, opacity: 0.7, margin: 0 }}>
        Host a demo round of any game you own or copy from the community
      </p>

      {loadError && <p style={{ color: colors.coralText, fontSize: "0.9rem", fontWeight: 600 }}>{loadError}</p>}

      <Link
        href="/games/teacher/create-game"
        style={{
          fontSize: "1rem",
          fontWeight: 800,
          padding: "0.85rem 1.4rem",
          borderRadius: radius.button,
          border: "none",
          background: colors.orange,
          boxShadow: solidShadow(5, colors.orangeShadow),
          color: colors.white,
          textDecoration: "none",
        }}
      >
        Create New Game +
      </Link>

      <section style={{ width: "100%", maxWidth: "1100px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.75rem" }}>My Games</h2>

        {deleteError && (
          <p style={{ color: colors.coralText, fontSize: "0.85rem", marginBottom: "0.5rem" }}>{deleteError}</p>
        )}
        {publishError && (
          <p style={{ color: colors.coralText, fontSize: "0.85rem", marginBottom: "0.5rem" }}>{publishError}</p>
        )}

        <div style={gridStyle}>
          {myGames === null && !loadError && (
            <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>Loading...</p>
          )}

          {myGames?.length === 0 && (
            <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>
              No games yet. Create one, or copy one from the community below.
            </p>
          )}

          {myGames?.map((g) => (
            <div key={g.id} style={cardStyle}>
              <GameCover title={g.title} />
              <div style={cardBodyStyle}>
                <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{g.title}</div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, opacity: 0.6 }}>
                  {g.is_public ? "Public" : "Private"} · {questionCountLabel(g.questions.length)} · used{" "}
                  {g.usage_count} time
                  {g.usage_count === 1 ? "" : "s"}
                </div>
                <Link href={`/games/play/${g.id}`} style={primaryButtonStyle}>
                  Play Demo
                </Link>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button
                    onClick={() => togglePublic(g)}
                    disabled={publishBusyId === g.id}
                    style={{
                      ...secondaryButtonStyle,
                      background: g.is_public ? colors.white : colors.greenButton,
                      boxShadow: g.is_public ? "none" : solidShadow(3, colors.greenButtonShadow),
                      color: g.is_public ? colors.textPrimary : colors.white,
                      border: g.is_public ? `1px solid ${colors.rosterCardShadow}` : "none",
                    }}
                  >
                    {publishBusyId === g.id ? "..." : g.is_public ? "Unpublish" : "Publish"}
                  </button>
                  <button onClick={() => deleteGame(g.id)} style={dangerButtonStyle}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ width: "100%", maxWidth: "1100px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.75rem" }}>Community Games</h2>
        <p style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.6, margin: "0 0 0.75rem" }}>
          Ready-made games shared by other teachers — copy one into My Games to keep and host your own.
        </p>

        {copyError && (
          <p style={{ color: colors.coralText, fontSize: "0.85rem", marginBottom: "0.5rem" }}>{copyError}</p>
        )}

        <div style={gridStyle}>
          {communityGames === null && !loadError && (
            <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>Loading...</p>
          )}

          {communityGames?.length === 0 && (
            <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>No public games yet.</p>
          )}

          {communityGames?.map((g) => (
            <div key={g.id} style={cardStyle}>
              <GameCover title={g.title} />
              <div style={cardBodyStyle}>
                <div style={{ fontWeight: 800, fontSize: "0.95rem" }}>{g.title}</div>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, opacity: 0.6 }}>
                  by {ownerNameOf(g) || "another teacher"} · {questionCountLabel(g.questions.length)} · used{" "}
                  {g.usage_count} time
                  {g.usage_count === 1 ? "" : "s"}
                </div>
                <Link href={`/games/play/${g.id}`} style={primaryButtonStyle}>
                  Play Demo
                </Link>
                <button
                  onClick={() => handleCopy(g)}
                  disabled={copyBusyId === g.id}
                  style={{ ...primaryButtonStyle, background: colors.greenButton, boxShadow: solidShadow(3, colors.greenButtonShadow) }}
                >
                  {copyBusyId === g.id ? "Copying..." : "Copy to My Games"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Link
        href="/games/teacher"
        style={{
          fontSize: "0.9rem",
          fontWeight: 700,
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
        }}
      >
        ← Back to Games Dashboard
      </Link>
    </main>
  );
}
