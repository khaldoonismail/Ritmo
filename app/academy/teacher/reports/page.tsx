"use client";

import { useState } from "react";
import { colors, radius, solidShadow } from "@/lib/theme";
import StudentProgress from "../assessment/StudentProgress";
import WeeklyReport from "../weekly-report/WeeklyReport";
import AnalyticsReport from "../analytics/AnalyticsReport";

type Tab = "assessment" | "weekly" | "analytics";

const tabs: { value: Tab; label: string }[] = [
  { value: "assessment", label: "Assessment" },
  { value: "weekly", label: "Weekly Report" },
  { value: "analytics", label: "Analytics" },
];

// Combines the three previously-separate report pages (still reachable at
// their own routes) into one "Reports/Progress" destination for the
// sidebar, so a teacher doesn't have to know which of three pages has the
// number they want.
export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>("assessment");

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
      <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>Reports / Progress</h1>
      <p style={{ fontSize: "1rem", fontWeight: 600, opacity: 0.7, margin: 0, textAlign: "center" }}>
        Assessment scores, weekly activity, and struggle-rate analytics in one place.
      </p>

      <div
        style={{
          display: "flex",
          gap: "0.4rem",
          background: colors.white,
          borderRadius: radius.pill,
          boxShadow: solidShadow(3, colors.gamesCardShadow),
          padding: "0.3rem",
        }}
      >
        {tabs.map((t) => {
          const on = tab === t.value;
          return (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                padding: "0.5rem 1.1rem",
                borderRadius: radius.pill,
                border: "none",
                background: on ? colors.greenButton : "transparent",
                color: on ? colors.white : colors.textPrimary,
                cursor: "pointer",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "assessment" && <StudentProgress />}
      {tab === "weekly" && <WeeklyReport />}
      {tab === "analytics" && <AnalyticsReport />}
    </main>
  );
}
