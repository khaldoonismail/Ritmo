"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Gamepad2,
  BookOpen,
  Users,
  BarChart3,
  Settings,
  HelpCircle,
  type LucideIcon,
} from "lucide-react";
import { colors, solidShadow } from "@/lib/theme";
import LogoutButton from "@/app/academy/teacher/LogoutButton";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  // Extra path prefixes that should also count as "active" for this item,
  // for routes that live outside the item's own href (e.g. the lesson
  // creator, which isn't nested under /teacher/lessons).
  matchPrefixes?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    label: "Content",
    items: [
      { label: "Homepage", href: "/academy/teacher", icon: Home },
      { label: "Games", href: "/games/teacher", icon: Gamepad2 },
      {
        label: "Lessons",
        href: "/teacher/lessons",
        icon: BookOpen,
        matchPrefixes: ["/academy/teacher/create-lesson"],
      },
    ],
  },
  {
    label: "Management",
    items: [
      { label: "Students", href: "/teacher/classes", icon: Users },
      {
        label: "Reports/Progress",
        href: "/academy/teacher/reports",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Account",
    items: [
      { label: "Settings", href: "/academy/teacher/settings", icon: Settings },
      { label: "Help/Support", href: "/academy/teacher/help", icon: HelpCircle },
    ],
  },
];

function isActive(pathname: string, item: NavItem): boolean {
  if (item.href === "/academy/teacher") return pathname === item.href;
  const prefixes = [item.href, ...(item.matchPrefixes || [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export default function TeacherSidebar() {
  const pathname = usePathname();

  return (
    <nav className="teacher-sidebar" aria-label="Teacher navigation">
      <Link
        href="/academy/teacher"
        className="teacher-sidebar-brand"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          textDecoration: "none",
          color: colors.textPrimary,
          padding: "0 0.6rem",
        }}
      >
        <span
          style={{
            width: "34px",
            height: "34px",
            minWidth: "34px",
            borderRadius: "10px",
            background: colors.orange,
            boxShadow: solidShadow(3, colors.orangeShadow),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: colors.white,
            fontSize: "1.1rem",
          }}
        >
          ♪
        </span>
        <span style={{ fontWeight: 800, fontSize: "1.1rem" }}>Ritmo</span>
      </Link>

      {navGroups.map((group) => (
        <div className="teacher-sidebar-group" key={group.label}>
          <span className="teacher-sidebar-label">{group.label}</span>
          {group.items.map((item) => {
            const active = isActive(pathname, item);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="teacher-sidebar-item"
                aria-current={active ? "page" : undefined}
                style={{
                  background: active ? colors.blueBackground : "transparent",
                  color: active ? colors.blueText : colors.textPrimary,
                  borderLeft: `3px solid ${active ? colors.blueText : "transparent"}`,
                  borderBottom: `3px solid ${active ? colors.blueText : "transparent"}`,
                }}
              >
                <Icon size={18} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}

      <div className="teacher-sidebar-logout" style={{ marginTop: "auto", padding: "0 0.6rem" }}>
        <LogoutButton />
      </div>
    </nav>
  );
}
