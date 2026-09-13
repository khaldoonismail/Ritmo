"use client";

import Link from "next/link";
import { colors } from "@/lib/theme";
import AnalyticsReport from "./AnalyticsReport";

export default function AnalyticsPage() {
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
      <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>Analytics</h1>
      <p style={{ fontSize: "1rem", fontWeight: 600, opacity: 0.7, margin: 0, textAlign: "center" }}>
        Which lessons and games your students find hardest
      </p>

      <AnalyticsReport />

      <Link
        href="/academy/teacher/assessment"
        style={{
          fontSize: "0.9rem",
          fontWeight: 700,
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
          marginTop: "0.5rem",
        }}
      >
        ← Back to Assessment
      </Link>
    </main>
  );
}
