import { colors, radius, solidShadow } from "@/lib/theme";

const faqs = [
  {
    q: "How do I create a class for my students?",
    a: "Go to Students in the sidebar, then \"Create Class\". You'll get a join code students use to log in.",
  },
  {
    q: "How does Team Battle mode work?",
    a: "From Games, open \"Play Demo\" on any game and switch the Play Mode toggle to \"Team Battle\". You can set up teams, assign students, and share a PIN for them to join live on their own devices.",
  },
  {
    q: "Where can I see how my students are doing?",
    a: "Reports/Progress in the sidebar brings together assessment scores, weekly activity, and struggle-rate analytics.",
  },
];

// Minimal placeholder — a short FAQ plus a contact point, so the sidebar's
// "Help/Support" item has a real destination.
export default function HelpPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        gap: "1.25rem",
        background: colors.background,
        color: colors.textPrimary,
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>Help & Support</h1>

      <div style={{ width: "100%", maxWidth: "560px", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        {faqs.map((item) => (
          <div
            key={item.q}
            style={{
              background: colors.white,
              borderRadius: radius.card,
              boxShadow: solidShadow(4, colors.gamesCardShadow),
              padding: "1rem 1.25rem",
              textAlign: "left",
            }}
          >
            <p style={{ fontWeight: 800, margin: "0 0 0.4rem" }}>{item.q}</p>
            <p style={{ margin: 0, opacity: 0.8, lineHeight: 1.5 }}>{item.a}</p>
          </div>
        ))}
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: "560px",
          background: colors.blueBackground,
          borderRadius: radius.card,
          padding: "1rem 1.25rem",
          textAlign: "left",
        }}
      >
        <p style={{ fontWeight: 800, margin: "0 0 0.3rem", color: colors.blueText }}>
          Still need help?
        </p>
        <p style={{ margin: 0, color: colors.blueText }}>
          Email us at{" "}
          <a href="mailto:support@ritmo.app" style={{ color: "inherit", fontWeight: 700 }}>
            support@ritmo.app
          </a>{" "}
          and we'll get back to you.
        </p>
      </div>
    </main>
  );
}
