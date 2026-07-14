"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

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
        fontWeight: 700,
        padding: "0.6rem 1.2rem",
        borderRadius: "8px",
        border: "1px solid #ddd",
        background: "#fff",
        color: "#111",
        cursor: "pointer",
      }}
    >
      Log out
    </button>
  );
}
