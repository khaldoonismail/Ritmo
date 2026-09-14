"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { colors, radius, solidShadow } from "@/lib/theme";

export default function JoinSessionForm() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/student/session/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not join game");
        setLoading(false);
        return;
      }
      router.push(`/student/play/${data.sessionId}`);
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.25rem",
        textAlign: "center",
        padding: "2rem",
        background: colors.background,
        color: colors.textPrimary,
      }}
    >
      <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>Join a Game</h1>
      <p style={{ opacity: 0.7, fontWeight: 600, margin: 0 }}>
        Enter the game PIN your teacher shared.
      </p>
      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "0.85rem", alignItems: "center" }}
      >
        <input
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder="123456"
          style={{
            fontSize: "1.5rem",
            fontWeight: 800,
            letterSpacing: "0.2em",
            textAlign: "center",
            direction: "ltr",
            width: "220px",
            padding: "0.6rem 1rem",
            borderRadius: radius.card,
            border: `1px solid ${colors.inputBorder}`,
          }}
        />
        {error && <p style={{ color: colors.coralText, fontWeight: 700, margin: 0 }}>{error}</p>}
        <button
          type="submit"
          disabled={pin.length !== 6 || loading}
          style={{
            fontSize: "1.05rem",
            fontWeight: 800,
            padding: "0.75rem 2rem",
            borderRadius: radius.button,
            border: "none",
            background: colors.greenButton,
            boxShadow: solidShadow(4, colors.greenButtonShadow),
            color: colors.white,
            cursor: pin.length === 6 && !loading ? "pointer" : "default",
            opacity: pin.length === 6 && !loading ? 1 : 0.5,
          }}
        >
          {loading ? "Joining…" : "Join"}
        </button>
      </form>
    </main>
  );
}
