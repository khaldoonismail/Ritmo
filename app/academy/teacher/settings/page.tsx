"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { colors, radius, solidShadow } from "@/lib/theme";

interface TeacherInfo {
  name: string;
  email: string;
}

// Minimal placeholder — read-only account info for now. Editing settings
// isn't wired up yet; this just gives the sidebar's "Settings" item a real
// destination instead of a dead link.
export default function SettingsPage() {
  const [teacher, setTeacher] = useState<TeacherInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("teachers")
        .select("name, email")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();
      setTeacher(data);
      setLoading(false);
    });
  }, []);

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
      <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>Settings</h1>

      <div
        style={{
          width: "100%",
          maxWidth: "480px",
          background: colors.white,
          borderRadius: radius.card,
          boxShadow: solidShadow(4, colors.gamesCardShadow),
          padding: "1.25rem",
          textAlign: "left",
          display: "flex",
          flexDirection: "column",
          gap: "0.9rem",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>Account</div>
        {loading ? (
          <p style={{ margin: 0, opacity: 0.7 }}>Loading…</p>
        ) : teacher ? (
          <>
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, opacity: 0.6 }}>Name</div>
              <div style={{ fontSize: "1rem", fontWeight: 700 }}>{teacher.name}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, opacity: 0.6 }}>Email</div>
              <div style={{ fontSize: "1rem", fontWeight: 700 }}>{teacher.email}</div>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, opacity: 0.7 }}>Sign in to view your account.</p>
        )}
      </div>

      <p style={{ fontSize: "0.85rem", opacity: 0.6, maxWidth: "420px", textAlign: "center", margin: 0 }}>
        More settings — notifications, class defaults, theme — are coming soon.
      </p>
    </main>
  );
}
