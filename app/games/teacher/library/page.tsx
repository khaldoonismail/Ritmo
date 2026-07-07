"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Game {
  id: string;
  title: string;
  questions: unknown[];
  createdAt: number;
}

const STORAGE_KEY = "ritmo_games";

export default function GamesLibraryPage() {
  const [games, setGames] = useState<Game[]>([]);

  useEffect(() => {
    const stored: Game[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    setGames(stored.sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  function deleteGame(id: string) {
    const remaining = games.filter((g) => g.id !== id);
    setGames(remaining);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
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
        {games.length === 0 && (
          <p style={{ opacity: 0.5, textAlign: "center" }}>
            No games yet. Create one to get started.
          </p>
        )}

        {games.map((g) => (
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
