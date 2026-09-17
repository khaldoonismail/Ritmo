"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { colors, radius, solidShadow } from "@/lib/theme";

// `compact` renders a round icon-only button with a hover tooltip, for the
// sidebar's collapsed state — same handleLogout, just a different shell.
export default function LogoutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/accounts/login");
  }

  if (compact) {
    return (
      <div className="teacher-sidebar-item" style={{ justifyContent: "center", cursor: "pointer" }}>
        <button
          onClick={handleLogout}
          aria-label="Log out"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "34px",
            height: "34px",
            borderRadius: "50%",
            border: "none",
            background: colors.neutralGray,
            boxShadow: solidShadow(3, colors.neutralGrayShadow),
            color: colors.white,
            cursor: "pointer",
          }}
        >
          <LogOut size={16} aria-hidden="true" />
        </button>
        <span className="teacher-sidebar-tooltip" role="tooltip">
          Log out
        </span>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        fontSize: "0.9rem",
        fontWeight: 800,
        padding: "0.7rem 1.4rem",
        borderRadius: radius.button,
        border: "none",
        background: colors.neutralGray,
        boxShadow: solidShadow(4, colors.neutralGrayShadow),
        color: colors.white,
        cursor: "pointer",
        marginTop: "0.5rem",
      }}
    >
      Log out
    </button>
  );
}
