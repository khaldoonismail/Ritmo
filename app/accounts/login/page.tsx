"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { colors, radius, solidShadow } from "@/lib/theme";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const supabase = createBrowserSupabaseClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setLoading(false);
    if (signInError) {
      setError(signInError.message);
      return;
    }
    router.push("/academy/teacher");
  }

  const inputStyle: React.CSSProperties = {
    fontSize: "1rem",
    padding: "0.75rem 1rem",
    borderRadius: radius.iconSquare,
    border: `1px solid #E5DFC8`,
    outline: "none",
    direction: "ltr",
    textAlign: "left",
    fontFamily: "inherit",
    background: colors.white,
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        textAlign: "center",
        padding: "2rem",
        background: colors.background,
        color: colors.textPrimary,
      }}
    >
      <Link
        href="/"
        style={{
          fontSize: "0.9rem",
          fontWeight: 600,
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
        }}
      >
        ← Back to Home
      </Link>

      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "20px",
          background: colors.orange,
          boxShadow: solidShadow(6, colors.orangeShadow),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginTop: "0.5rem",
        }}
      >
        <span style={{ fontSize: "2rem", color: colors.white, lineHeight: 1 }}>
          ♪
        </span>
      </div>

      <h1 style={{ fontSize: "2.25rem", fontWeight: 800, margin: 0 }}>Ritmo</h1>

      <form
        onSubmit={handleLogin}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          width: "100%",
          maxWidth: "320px",
          marginTop: "1rem",
        }}
      >
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password"
          placeholder="Password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={inputStyle}
        />
        {error && (
          <p style={{ color: colors.coralText, fontSize: "0.85rem", margin: 0 }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            fontSize: "1rem",
            fontWeight: 800,
            padding: "0.85rem 1rem",
            borderRadius: radius.button,
            border: "none",
            background: colors.orange,
            boxShadow: loading ? "none" : solidShadow(6, colors.orangeShadow),
            color: colors.white,
            cursor: loading ? "default" : "pointer",
            opacity: loading ? 0.7 : 1,
            marginTop: "0.25rem",
          }}
        >
          {loading ? "Logging in..." : "Log in"}
        </button>
      </form>

      <Link
        href="/accounts/signup"
        style={{
          fontSize: "1rem",
          fontWeight: 800,
          padding: "0.85rem 1.5rem",
          borderRadius: radius.button,
          background: colors.greenButton,
          boxShadow: solidShadow(6, colors.greenButtonShadow),
          color: colors.white,
          textDecoration: "none",
          marginTop: "0.75rem",
        }}
      >
        Create a teacher account
      </Link>
    </main>
  );
}
