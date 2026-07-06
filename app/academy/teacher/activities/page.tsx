import Link from "next/link";

export default function ActivitiesPage() {
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
      <h1 style={{ fontSize: "2.25rem", fontWeight: 800, margin: 0 }}>
        Activities Library
      </h1>
      <p style={{ fontSize: "1rem", opacity: 0.7, maxWidth: "480px" }}>
        Activities library coming soon.
      </p>
      <Link
        href="/academy/teacher"
        style={{
          fontSize: "0.9rem",
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
          marginTop: "1rem",
        }}
      >
        ← Back to Teacher Dashboard
      </Link>
    </main>
  );
}
