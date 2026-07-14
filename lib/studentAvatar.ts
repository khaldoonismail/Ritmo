import type { SupabaseClient } from "@supabase/supabase-js";

export const AVATAR_BUCKET = "student-avatars";
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/jpeg", "image/png"];

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Only .jpg and .png images are allowed.";
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return "That image is too large (max 2MB).";
  }
  return null;
}

export function avatarStoragePath(studentId: string): string {
  return `${studentId}/avatar`;
}

export async function uploadStudentAvatar(
  supabase: SupabaseClient,
  studentId: string,
  file: File
): Promise<{ path: string } | { error: string }> {
  const validationError = validateAvatarFile(file);
  if (validationError) {
    return { error: validationError };
  }

  const path = avatarStoragePath(studentId);
  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: updateError } = await supabase
    .from("students")
    .update({ avatar_url: path })
    .eq("id", studentId);

  if (updateError) {
    return { error: updateError.message };
  }

  return { path };
}

export async function getAvatarSignedUrl(
  supabase: SupabaseClient,
  path: string
): Promise<string | null> {
  const { data } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
