"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { colors } from "@/lib/theme";

// The small footer under every page: a link to the Credits page. Full-
// screen games (position: fixed) cover it while playing. Nothing in it may
// make a stacking context (no opacity, transform or position), or the
// browser would paint it on top of those games. Hidden on the maintenance page,
// where every link leads back to the same page anyway: by path, and (as
// the gate rewrites other URLs to it) by CSS in app/globals.css.

export default function SiteFooter() {
  const pathname = usePathname();
  if (pathname === "/maintenance") return null;
  return (
    <footer className="site-footer" style={{ background: colors.background, color: colors.textPrimary, textAlign: "center", padding: "0.75rem 16px calc(0.75rem + env(safe-area-inset-bottom))", fontSize: "0.85rem", fontWeight: 700 }}>
      <Link href="/credits" style={{ color: "#8A8378", textDecoration: "underline", textUnderlineOffset: 3 }}>
        Credits
      </Link>
    </footer>
  );
}
