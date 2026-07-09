import Link from "next/link";

export default function Home() {
  const links = [
    { label: "Log In (Teacher)", href: "/accounts/login" },
    { label: "Log In (Student)", href: "/student/login" },
    { label: "Academy — Teacher Dashboard", href: "/academy/teacher" },
    { label: "Games — Teacher Dashboard", href: "/games/teacher" },
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
      <h1 style={{ fontSize: "3rem", fontWeight: 800, margin: 0 }}>Ritmo</h1>
      <p style={{ fontSize: "1.1rem", opacity: 0.7, margin: 0 }}>
        Ritmo — Academy, Games, and Accounts for Music Education
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
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
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
            {l.label}
          </Link>
        ))}
      </div>
    </main>
  );
}
