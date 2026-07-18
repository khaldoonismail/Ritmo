import Link from "next/link";
import { colors, radius, solidShadow } from "@/lib/theme";

const links = [
  { label: "Log In (Teacher)", href: "/accounts/login", bg: colors.orange, shadow: colors.orangeShadow },
  { label: "Log In (Student)", href: "/student/login", bg: colors.orange, shadow: colors.orangeShadow },
  {
    label: "Academy — Teacher Dashboard",
    href: "/academy/teacher",
    bg: colors.greenButton,
    shadow: colors.greenButtonShadow,
  },
  {
    label: "Games — Teacher Dashboard",
    href: "/games/teacher",
    bg: colors.greenButton,
    shadow: colors.greenButtonShadow,
  },
];

export default function Home() {
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
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "20px",
          background: colors.orange,
          boxShadow: solidShadow(6, colors.orangeShadow),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: "2rem", color: colors.white, lineHeight: 1 }}>♪</span>
      </div>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 800, margin: 0 }}>Ritmo</h1>
      <p style={{ fontSize: "1.05rem", fontWeight: 600, opacity: 0.7, margin: 0 }}>
        Ritmo — Academy, Games, and Accounts for Music Education
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
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            style={{
              fontSize: "1rem",
              fontWeight: 800,
              padding: "0.85rem 1rem",
              borderRadius: radius.button,
              background: l.bg,
              boxShadow: solidShadow(5, l.shadow),
              color: colors.white,
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
