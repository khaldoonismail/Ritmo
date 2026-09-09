import type { SupabaseClient } from "@supabase/supabase-js";

export const GAME_COVER_BUCKET = "game-covers";
const MAX_COVER_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png"];
const COVER_WIDTH = 400;
const COVER_HEIGHT = 300;

export const coverIconGallery = [
  { key: "note", emoji: "♪", label: "Music note" },
  { key: "drum", emoji: "🥁", label: "Drum" },
  { key: "piano", emoji: "🎹", label: "Piano" },
  { key: "clef", emoji: "🎼", label: "Treble clef" },
] as const;

export type CoverIconKey = (typeof coverIconGallery)[number]["key"];

// A few distinct, on-brand fills to pick a default color from — same idea
// as the games-library hash-by-title fallback, kept local since it's only
// used here now.
const fallbackPalette = ["#4CAF6D", "#3B5CC4", "#C24444", "#B4650B", "#7F77DD", "#2E9E8F"];

function hashColorFor(title: string): string {
  let hash = 0;
  for (let i = 0; i < title.length; i++) hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  return fallbackPalette[hash % fallbackPalette.length];
}

// Resolves a game's cover_image value (plus its title, for the fallback)
// into what should actually be rendered — used by both the create-game
// preview and the library list thumbnail so they never drift apart.
export type CoverDisplay =
  | { kind: "image"; url: string }
  | { kind: "icon"; emoji: string; bg: string };

export function resolveCoverDisplay(coverImage: string | null, title: string): CoverDisplay {
  if (coverImage?.startsWith("icon:")) {
    const key = coverImage.slice("icon:".length);
    const found = coverIconGallery.find((i) => i.key === key);
    return { kind: "icon", emoji: found?.emoji ?? "♪", bg: hashColorFor(title) };
  }
  if (coverImage) {
    return { kind: "image", url: coverImage };
  }
  return { kind: "icon", emoji: "♪", bg: hashColorFor(title) };
}

export function validateCoverFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Only .jpg and .png images are allowed.";
  }
  if (file.size > MAX_COVER_BYTES) {
    return "That image is too large (max 2MB).";
  }
  return null;
}

// Center-crops/resizes to the recommended 400x300 cover size client-side,
// so an oversized upload never gets stored (or billed for) at full size.
function resizeCoverImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement("canvas");
      canvas.width = COVER_WIDTH;
      canvas.height = COVER_HEIGHT;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported"));
        return;
      }
      const scale = Math.max(COVER_WIDTH / img.width, COVER_HEIGHT / img.height);
      const sw = COVER_WIDTH / scale;
      const sh = COVER_HEIGHT / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, COVER_WIDTH, COVER_HEIGHT);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not process image"))),
        file.type,
        0.9
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not read image"));
    };
    img.src = objectUrl;
  });
}

export async function uploadGameCover(
  supabase: SupabaseClient,
  teacherId: string,
  file: File
): Promise<{ url: string } | { error: string }> {
  const validationError = validateCoverFile(file);
  if (validationError) return { error: validationError };

  let blob: Blob;
  try {
    blob = await resizeCoverImage(file);
  } catch {
    return { error: "Could not process that image." };
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const path = `${teacherId}/${Math.random().toString(36).slice(2)}.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from(GAME_COVER_BUCKET)
    .upload(path, blob, { upsert: true, contentType: file.type });

  if (uploadError) return { error: uploadError.message };

  const { data } = supabase.storage.from(GAME_COVER_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl };
}
