"use client";

import Link from "next/link";
import { colors } from "@/lib/theme";
import StudentProgress from "./StudentProgress";

export default function AssessmentPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        gap: "1rem",
        background: colors.background,
        color: colors.textPrimary,
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>
        Assessment
      </h1>

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/academy/teacher/weekly-report"
          style={{
            fontSize: "0.85rem",
            fontWeight: 800,
            padding: "0.5rem 1rem",
            borderRadius: "999px",
            border: `1px solid ${colors.inputBorder}`,
            color: colors.textPrimary,
            textDecoration: "none",
          }}
        >
          📅 Weekly Report
        </Link>
        <Link
          href="/academy/teacher/analytics"
          style={{
            fontSize: "0.85rem",
            fontWeight: 800,
            padding: "0.5rem 1rem",
            borderRadius: "999px",
            border: `1px solid ${colors.inputBorder}`,
            color: colors.textPrimary,
            textDecoration: "none",
          }}
        >
          📈 Analytics
        </Link>
      </div>

      <h2 style={{ fontSize: "1.25rem", fontWeight: 800, margin: "0.5rem 0 0" }}>
        Student Progress
      </h2>
      <StudentProgress />

      <Link
        href="/academy/teacher"
        style={{
          fontSize: "0.9rem",
          fontWeight: 700,
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
          marginTop: "0.5rem",
        }}
      >
        ← Back to Teacher Dashboard
      </Link>
    </main>
  );
}
