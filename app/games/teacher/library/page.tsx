"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

interface Game {
  id: string;
  title: string;
  questions: unknown[];
  created_at: string;
}

export default function GamesLibraryPage() {
  const router = useRouter();
  const [games, setGames] = useState<Game[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [deleteError, setDeleteError] = useState("");

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

      const { data, error } = await supabase
        .from("games")
        .select("id, title, questions, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        setLoadError(error.message);
        return;
      }

      setGames(data || []);
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

    setGames((prev) => (prev || []).filter((g) => g.id !== id));
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        gap: "1rem",
      }}
    >
      <h1 style={{ fontSize: "2.25rem", fontWeight: 800, margin: 0 }}>
        My Games
      </h1>
      <p style={{ fontSize: "1rem", opacity: 0.7, margin: 0 }}>
        Host a demo round of any game you've created
      </p>

      {loadError && <p style={{ color: "#c00", fontSize: "0.9rem" }}>{loadError}</p>}
      {deleteError && <p style={{ color: "#c00", fontSize: "0.9rem" }}>{deleteError}</p>}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%",
          maxWidth: "600px",
          marginTop: "1rem",
        }}
      >
        {games === null && !loadError && (
          <p style={{ opacity: 0.5, textAlign: "center" }}>Loading...</p>
        )}

        {games?.length === 0 && (
          <p style={{ opacity: 0.5, textAlign: "center" }}>
            No games yet. Create one to get started.
          </p>
        )}

        {games?.map((g) => (
          <div
            key={g.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              padding: "0.9rem 1.1rem",
              border: "1px solid #ddd",
              borderRadius: "10px",
              background: "#fff",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <div style={{ fontWeight: 700 }}>{g.title}</div>
              <div style={{ fontSize: "0.8rem", opacity: 0.6 }}>
                {g.questions.length} question
                {g.questions.length === 1 ? "" : "s"}
              </div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <Link
                href={`/games/play/${g.id}`}
                style={{
                  fontSize: "0.9rem",
                  fontWeight: 700,
                  padding: "0.5rem 0.9rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#111",
                  color: "#fff",
                  textDecoration: "none",
                }}
              >
                Play Demo
              </Link>
              <button
                onClick={() => deleteGame(g.id)}
                style={{
                  fontSize: "0.9rem",
                  padding: "0.5rem 0.9rem",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  background: "#fff",
                  color: "#c00",
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      <Link
        href="/games/teacher"
        style={{
          fontSize: "0.9rem",
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
          marginTop: "0.5rem",
        }}
      >
        ← Back to Games Dashboard
      </Link>
    </main>
  );
}
