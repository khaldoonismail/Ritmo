// Which runner a child plays as, shared by Note Runner and Up or Down.
// Stage 1 keeps the choice on the device (localStorage); stage 2 will
// save it to the student's profile.

export type CharacterKind = "boy" | "girl" | "cat" | "fox" | "note";

export interface CharacterChoice {
  kind: CharacterKind;
  skin: number; // index into SKIN_TONES (boy and girls)
  outfit: number; // index into OUTFITS (boy and girls)
}

export const CHARACTER_KINDS: { kind: CharacterKind; name: string; custom: boolean }[] = [
  { kind: "boy", name: "Boy", custom: true },
  { kind: "girl", name: "Girl", custom: true },
  { kind: "cat", name: "Cat", custom: false },
  { kind: "fox", name: "Fox", custom: false },
  { kind: "note", name: "Ritmo", custom: false },
];

export const SKIN_TONES = ["#FFE0C7", "#F7C49B", "#DDA06E", "#B07445", "#7A4A2A"];

// Main clothes colour, plus an accent (hair clip, collar, shoe stripes).
export const OUTFITS: { main: string; accent: string; name: string }[] = [
  { main: "#FF9F1C", accent: "#FF5A5F", name: "Orange" },
  { main: "#FF5A5F", accent: "#3D5AFE", name: "Red" },
  { main: "#2EA8FF", accent: "#FFD23F", name: "Blue" },
  { main: "#2BC48A", accent: "#FF9F1C", name: "Green" },
  { main: "#8B5CF6", accent: "#FF7AB6", name: "Purple" },
  { main: "#FF7AB6", accent: "#8B5CF6", name: "Pink" },
];

// The boy in orange until a choice is made.
export const DEFAULT_CHARACTER: CharacterChoice = { kind: "boy", skin: 1, outfit: 0 };

const STORAGE_KEY = "ritmo.runner.character";

export function loadCharacter(): CharacterChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CHARACTER;
    const c = JSON.parse(raw) as Partial<CharacterChoice>;
    const kind = CHARACTER_KINDS.find((k) => k.kind === c.kind)?.kind;
    if (!kind) return DEFAULT_CHARACTER;
    const skin = Number.isInteger(c.skin) && c.skin! >= 0 && c.skin! < SKIN_TONES.length ? c.skin! : DEFAULT_CHARACTER.skin;
    const outfit =
      Number.isInteger(c.outfit) && c.outfit! >= 0 && c.outfit! < OUTFITS.length ? c.outfit! : DEFAULT_CHARACTER.outfit;
    return { kind, skin, outfit };
  } catch {
    return DEFAULT_CHARACTER;
  }
}

export function saveCharacter(c: CharacterChoice): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
  } catch {
    // private mode / blocked storage: lasts for this visit only
  }
}

export function hasSavedCharacter(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}
