import Link from "next/link";

export default function GamesTeacherDashboard() {
  const sections = [
    { label: "Create a Game", href: "/games/teacher/create-game" },
    { label: "My Games", href: "/games/teacher/library" },
  ];

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
      <h1 style={{ fontSize: "3rem", fontWeight: 800, margin: 0 }}>
        Games Dashboard
      </h1>
      <p style={{ fontSize: "1.1rem", opacity: 0.7, margin: 0 }}>
        Build Kahoot-style quiz games for your students
      </p>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
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
              fontWeight: 700,
              padding: "0.75rem 1rem",
              borderRadius: "8px",
              border: "1px solid #ddd",
              background: "#111",
              color: "#fff",
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
