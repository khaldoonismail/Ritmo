import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";
import LogoutButton from "./LogoutButton";

const sections = [
  {
    label: "My Classes",
    href: "/teacher/classes",
    icon: "👥",
    bg: colors.inProgressCardBg,
    shadow: colors.inProgressCardShadow,
    text: colors.classesText,
  },
  {
    label: "My Lessons",
    href: "/teacher/lessons",
    icon: "🎵",
    bg: colors.completedCardBg,
    shadow: colors.completedCardShadow,
    text: colors.lessonsText,
  },
  {
    label: "Assessment",
    href: "/academy/teacher/assessment",
    icon: "📊",
    bg: colors.coralBackground,
    shadow: colors.assessmentCardShadow,
    text: colors.coralText,
  },
  {
    label: "Games",
    href: "/games/teacher",
    icon: "🎮",
    bg: colors.blueBackground,
    shadow: colors.gamesCardShadow,
    text: colors.blueText,
  },
];

export default function TeacherDashboard() {
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
      <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>
        Teacher Dashboard
      </h1>
      <p style={{ fontSize: "1.05rem", fontWeight: 600, opacity: 0.7, margin: 0 }}>
        Manage your lessons, assessments, and activities
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(140px, 1fr))",
          gap: "1rem",
          width: "100%",
          maxWidth: "420px",
          marginTop: "1rem",
        }}
      >
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
              padding: "1.5rem 1rem",
              borderRadius: radius.card,
              background: s.bg,
              boxShadow: solidShadow(5, s.shadow),
              color: s.text,
              textDecoration: "none",
            }}
          >
            <span style={{ fontSize: "1.8rem" }} aria-hidden="true">
              {s.icon}
            </span>
            <span style={{ fontWeight: 800, fontSize: "0.95rem" }}>{s.label}</span>
          </Link>
        ))}
      </div>

      <Link
        href="/academy/teacher/activities"
        style={{
          fontSize: "0.9rem",
          fontWeight: 700,
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
          marginTop: "0.5rem",
        }}
      >
        Activities Library →
      </Link>

      <LogoutButton />
    </main>
  );
}
