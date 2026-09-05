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

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    padding: "0.9rem 1.1rem",
    borderRadius: radius.card,
    background: colors.white,
    boxShadow: solidShadow(4, colors.rosterCardShadow),
  };

  const primaryButtonStyle: React.CSSProperties = {
    fontSize: "0.9rem",
    fontWeight: 800,
    padding: "0.5rem 0.9rem",
    borderRadius: radius.button,
    border: "none",
    background: colors.orange,
    boxShadow: solidShadow(3, colors.orangeShadow),
    color: colors.white,
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
  };

  const dangerButtonStyle: React.CSSProperties = {
    ...primaryButtonStyle,
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

      <section style={{ width: "100%", maxWidth: "650px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.75rem" }}>My Games</h2>

        {deleteError && (
          <p style={{ color: colors.coralText, fontSize: "0.85rem", marginBottom: "0.5rem" }}>{deleteError}</p>
        )}
        {publishError && (
          <p style={{ color: colors.coralText, fontSize: "0.85rem", marginBottom: "0.5rem" }}>{publishError}</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {myGames === null && !loadError && (
            <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>Loading...</p>
          )}

          {myGames?.length === 0 && (
            <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>
              No games yet. Create one, or copy one from the community below.
            </p>
          )}

          {myGames?.map((g) => (
            <div key={g.id} style={rowStyle}>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 800 }}>{g.title}</div>
                <div style={{ fontSize: "0.78rem", fontWeight: 600, opacity: 0.6 }}>
                  {g.is_public ? "Public" : "Private"} · {questionCountLabel(g.questions.length)} · used{" "}
                  {g.usage_count} time
                  {g.usage_count === 1 ? "" : "s"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Link href={`/games/play/${g.id}`} style={primaryButtonStyle}>
                  Play Demo
                </Link>
                <button
                  onClick={() => togglePublic(g)}
                  disabled={publishBusyId === g.id}
                  style={{
                    ...primaryButtonStyle,
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
          ))}
        </div>
      </section>

      <section style={{ width: "100%", maxWidth: "650px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.75rem" }}>Community Games</h2>
        <p style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.6, margin: "0 0 0.75rem" }}>
          Ready-made games shared by other teachers — copy one into My Games to keep and host your own.
        </p>

        {copyError && (
          <p style={{ color: colors.coralText, fontSize: "0.85rem", marginBottom: "0.5rem" }}>{copyError}</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {communityGames === null && !loadError && (
            <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>Loading...</p>
          )}

          {communityGames?.length === 0 && (
            <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>No public games yet.</p>
          )}

          {communityGames?.map((g) => (
            <div key={g.id} style={rowStyle}>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: 800 }}>{g.title}</div>
                <div style={{ fontSize: "0.78rem", fontWeight: 600, opacity: 0.6 }}>
                  by {ownerNameOf(g) || "another teacher"} · {questionCountLabel(g.questions.length)} · used{" "}
                  {g.usage_count} time
                  {g.usage_count === 1 ? "" : "s"}
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
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
