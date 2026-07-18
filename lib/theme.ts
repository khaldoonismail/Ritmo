// Ritmo "3D" (Duolingo-style) design system tokens — chunky elements with a
// solid offset shadow (no blur) for a pressable, tactile feel. Rolled out
// page by page; see "مواصفات - نظام التصميم 3D لـ Ritmo.md" for the spec
// this is derived from.

export const colors = {
  background: "#FFF8EC",
  textPrimary: "#2B2B2B",

  orange: "#FFB94D",
  orangeShadow: "#D9860F",

  greenCard: "#4CAF6D",
  greenCardShadow: "#33884E",
  greenButton: "#67C687",
  greenButtonShadow: "#3E9160",

  coralBackground: "#FDEAEA",
  coralText: "#C24444",

  blueBackground: "#E9EEFC",
  blueText: "#3B5CC4",

  neutralGray: "#B9B6A8",
  neutralGrayShadow: "#93907F",

  white: "#FFFFFF",

  // Lesson-list status card backgrounds (light tint, distinct from the
  // solid badge/icon colors above).
  completedCardBg: "#EAF8EF",
  completedCardShadow: "#BFE6CC",
  inProgressCardBg: "#FFF3DF",
  inProgressCardShadow: "#F0D6A6",
  notStartedCardBg: "#F0EEE4",
  notStartedCardShadow: "#D6D3C4",
} as const;

export const radius = {
  button: "14px",
  card: "16px",
  iconSquare: "12px",
  pill: "999px",
} as const;

// Solid offset shadow, no blur. `depth` follows the spec's tiers:
// small icons (36-40px) -> 3, buttons/cards -> 4-5, large elements
// (logo, hero cards) -> 6.
export function solidShadow(depth: number, shadowColor: string): string {
  return `0 ${depth}px 0 ${shadowColor}`;
}

export const fontFamily = "var(--font-nunito), sans-serif";
