"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { colors, radius, solidShadow } from "@/lib/theme";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    router.push("/accounts/login");
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
