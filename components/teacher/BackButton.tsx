"use client";

import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { colors, radius, solidShadow } from "@/lib/theme";

const HOME_PATH = "/academy/teacher";

// Sensible parent per route, used only when there's no real browser history
// to go back to (e.g. a direct link/refresh landed here). Ordered by
// specificity — first match wins. Anything unmatched falls back to the
// homepage rather than nowhere.
const PARENT_RULES: { test: (path: string) => boolean; parent: string }[] = [
  { test: (p) => /^\/teacher\/classes\/[^/]+/.test(p), parent: "/teacher/classes" },
  { test: (p) => /^\/teacher\/lessons\/[^/]+/.test(p), parent: "/teacher/lessons" },
  { test: (p) => p === "/academy/teacher/create-lesson", parent: "/teacher/lessons" },
  { test: (p) => p === "/academy/teacher/assessment", parent: "/academy/teacher/reports" },
  { test: (p) => p === "/academy/teacher/weekly-report", parent: "/academy/teacher/reports" },
  { test: (p) => p === "/academy/teacher/analytics", parent: "/academy/teacher/reports" },
  { test: (p) => p === "/games/teacher/create-game", parent: "/games/teacher" },
  { test: (p) => p === "/games/teacher/library", parent: "/games/teacher" },
];

function getParentPath(pathname: string): string {
  return PARENT_RULES.find((rule) => rule.test(pathname))?.parent ?? HOME_PATH;
}

// Rendered once by TeacherShell, above every wrapped teacher page's own
// content — not duplicated per page. Hidden on the homepage itself, since
// there's no sensible "back" from there.
export default function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === HOME_PATH) return null;

  function handleClick() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(getParentPath(pathname));
    }
  }

  return (
    <button
      onClick={handleClick}
      className="teacher-back-button"
      aria-label="Back"
      title="Back"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        border: "none",
        borderRadius: radius.pill,
        background: colors.white,
        boxShadow: solidShadow(3, colors.gamesCardShadow),
        color: colors.textPrimary,
        fontWeight: 700,
        fontSize: "0.85rem",
        padding: "0.5rem 0.9rem",
        cursor: "pointer",
      }}
    >
      <ArrowLeft size={16} aria-hidden="true" />
      <span className="teacher-back-button-label">Back</span>
    </button>
  );
}
