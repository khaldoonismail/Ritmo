"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Step = "details" | "pin";

export default function StudentLoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const inputStyle: React.CSSProperties = {
    fontSize: "1rem",
    padding: "0.75rem 1rem",
    borderRadius: "8px",
    border: "1px solid #ddd",
    outline: "none",
    direction: "ltr",
    textAlign: "left",
    fontFamily: "inherit",
  };

  async function handleContinue(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/student/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, joinCode }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error || "Could not find that student.");
      return;
    }
    setStep("pin");
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await fetch("/api/student/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, joinCode, pin }),
    });
    setLoading(false);
    if (!res.ok) {
      const json = await res.json().catch(() => null);
      setError(json?.error || "Wrong PIN. Try again.");
      return;
    }
    router.push("/student/dashboard");
  }

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
      }}
    >
      <Link
        href="/"
        style={{
          fontSize: "0.9rem",
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
        }}
      >
        ← Back to Home
      </Link>
      <h1 style={{ fontSize: "3rem", fontWeight: 800, margin: 0 }}>Ritmo</h1>
      <p style={{ fontSize: "1.1rem", opacity: 0.7, margin: 0 }}>
        Student Login
      </p>

      {step === "details" && (
        <form
          onSubmit={handleContinue}
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
            type="text"
            placeholder="Your name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Class join code (e.g. MATH7-K3F2)"
            required
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            style={{ ...inputStyle, textTransform: "uppercase" }}
          />
          {error && (
            <p style={{ color: "#c00", fontSize: "0.85rem", margin: 0 }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              border: "none",
              background: "#111",
              color: "#fff",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.6 : 1,
              marginTop: "0.25rem",
            }}
          >
            {loading ? "Checking..." : "Continue"}
          </button>
        </form>
      )}

      {step === "pin" && (
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
          <p style={{ fontSize: "0.9rem", opacity: 0.7, margin: 0 }}>
            Hi <strong>{name}</strong> — enter your 4-digit PIN to confirm it's
            you.
          </p>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            placeholder="4-digit PIN"
            required
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
            style={{ ...inputStyle, textAlign: "center", letterSpacing: "0.3em" }}
          />
          {error && (
            <p style={{ color: "#c00", fontSize: "0.85rem", margin: 0 }}>
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            style={{
              fontSize: "1rem",
              fontWeight: 700,
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              border: "none",
              background: "#111",
              color: "#fff",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.6 : 1,
              marginTop: "0.25rem",
            }}
          >
            {loading ? "Logging in..." : "Log in"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("details");
              setPin("");
              setError("");
            }}
            style={{
              fontSize: "0.85rem",
              opacity: 0.7,
              background: "none",
              border: "none",
              color: "inherit",
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            ← Not you? Go back
          </button>
        </form>
      )}

      <Link
        href="/accounts/login"
        style={{
          fontSize: "0.9rem",
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
          marginTop: "0.5rem",
        }}
      >
        Teacher? Log in here
      </Link>
    </main>
  );
}
