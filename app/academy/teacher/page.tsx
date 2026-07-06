import Link from "next/link";

export default function TeacherDashboard() {
  const sections = [
    { label: "Create a Lesson", href: "/academy/teacher/create-lesson" },
    { label: "Assessment", href: "/academy/teacher/assessment" },
    { label: "Activities Library", href: "/academy/teacher/activities" },
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
        Teacher Dashboard
      </h1>
      <p style={{ fontSize: "1.1rem", opacity: 0.7, margin: 0 }}>
        Manage your lessons, assessments, and activities
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
    </main>
  );
}
