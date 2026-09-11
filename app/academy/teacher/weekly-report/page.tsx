"use client";

import Link from "next/link";
import { colors } from "@/lib/theme";
import WeeklyReport from "./WeeklyReport";

export default function WeeklyReportPage() {
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
        Weekly Report
      </h1>
      <p style={{ fontSize: "1rem", fontWeight: 600, opacity: 0.7, margin: 0 }}>
        A quick summary of each class's activity over the last 7 days.
      </p>

      <WeeklyReport />

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
