import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";

const sections = [
  { label: "Create a Game", href: "/games/teacher/create-game" },
  { label: "My Games", href: "/games/teacher/library" },
];

export default function GamesTeacherDashboard() {
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
        Games Dashboard
      </h1>
      <p style={{ fontSize: "1.05rem", fontWeight: 600, opacity: 0.7, margin: 0 }}>
        Build Kahoot-style quiz games for your students
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem",
          width: "100%",
          maxWidth: "320px",
          marginTop: "1rem",
        }}
      >
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            style={{
              fontSize: "1rem",
              fontWeight: 800,
              padding: "0.85rem 1rem",
              borderRadius: radius.button,
              background: colors.blueBackground,
              boxShadow: solidShadow(5, colors.gamesCardShadow),
              color: colors.blueText,
              textDecoration: "none",
            }}
          >
            {s.label}
          </Link>
        ))}
      </div>

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
        Go to Academy Dashboard →
      </Link>
    </main>
  );
}
