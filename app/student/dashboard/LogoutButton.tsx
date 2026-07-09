"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/student/logout", { method: "POST" });
    router.push("/student/login");
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
