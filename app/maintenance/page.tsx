import type { Metadata } from "next";
import { colors, radius, solidShadow } from "@/lib/theme";

// Shown to every visitor while MAINTENANCE_MODE=true (see middleware.ts).

export const metadata: Metadata = {
  title: "Ritmo — Coming Soon",
  description: "Ritmo is under construction. Please check back soon.",
  robots: { index: false, follow: false },
};

export default function MaintenancePage() {
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
        padding: "2rem 1rem",
        background: colors.background,
        color: colors.textPrimary,
      }}
    >
      <div
        style={{
          width: "80px",
          height: "80px",
          borderRadius: "24px",
          background: colors.orange,
          boxShadow: solidShadow(6, colors.orangeShadow),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: "2.5rem", color: colors.white, lineHeight: 1 }}>♪</span>
      </div>
      <p style={{ fontSize: "1.5rem", fontWeight: 800, margin: "0.5rem 0 0" }}>Ritmo</p>
      <h1 style={{ fontSize: "2.5rem", fontWeight: 800, margin: 0 }}>Coming Soon</h1>
      <p
        style={{
          fontSize: "1.05rem",
          fontWeight: 600,
          opacity: 0.7,
          margin: 0,
          maxWidth: "420px",
        }}
      >
        We&apos;re putting the finishing touches on Ritmo. The site is under
        construction right now — please check back soon!
      </p>
      <p
        dir="rtl"
        lang="ar"
        style={{
          fontSize: "1.05rem",
          fontWeight: 600,
          opacity: 0.7,
          margin: 0,
          maxWidth: "420px",
        }}
      >
        الموقع قيد التطوير حاليًا، ترقّبوا الإطلاق قريبًا!
      </p>
      <span
        style={{
          marginTop: "0.75rem",
          fontSize: "0.9rem",
          fontWeight: 800,
          padding: "0.5rem 1rem",
          borderRadius: radius.pill,
          background: colors.white,
          boxShadow: solidShadow(4, colors.inputBorder),
        }}
      >
        🚧 Under Construction
      </span>
    </main>
  );
}
