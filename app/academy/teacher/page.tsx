import Link from "next/link";
import { colors } from "@/lib/theme";
import TeacherDashboard from "./TeacherDashboard";

export default function TeacherHomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "1rem",
        textAlign: "center",
        padding: "2rem",
        background: colors.background,
        color: colors.textPrimary,
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>Teacher Dashboard</h1>
      <p style={{ fontSize: "1.05rem", fontWeight: 600, opacity: 0.7, margin: 0 }}>
        Manage your lessons, assessments, and activities
      </p>

      <TeacherDashboard />

      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center", marginTop: "0.5rem" }}>
        <Link
          href="/teacher/schedule"
          style={{ fontSize: "0.9rem", fontWeight: 700, opacity: 0.7, color: "inherit", textDecoration: "underline" }}
        >
          My Schedule →
        </Link>
        <Link
          href="/academy/teacher/activities"
          style={{ fontSize: "0.9rem", fontWeight: 700, opacity: 0.7, color: "inherit", textDecoration: "underline" }}
        >
          Activities Library →
        </Link>
      </div>
    </main>
  );
}
