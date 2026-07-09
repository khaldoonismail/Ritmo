// Plain JS (not .ts) so scripts/seed.mjs can import it directly with plain
// Node, while the Next.js app imports the same module via the "@/lib/..."
// path alias. Keeps the class join-code format identical everywhere.

export function randomJoinCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const prefix = Array.from(
    { length: 4 },
    () => letters[Math.floor(Math.random() * letters.length)]
  ).join("");
  const suffix =
    "K" +
    Array.from(
      { length: 3 },
      () => digits[Math.floor(Math.random() * digits.length)]
    ).join("");
  return `${prefix}-${suffix}`;
}
