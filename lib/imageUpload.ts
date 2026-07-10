export const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
export const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export type ImageReadResult = { ok: true; url: string } | { ok: false; error: string };

// Validates a picked/dropped/pasted image file and converts it to a base64
// data URL, the same way for every place an image can be attached (the
// lesson canvas's Image block, and a question's optional attachment).
export function validateAndReadImage(file: File): Promise<ImageReadResult> {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return Promise.resolve({
      ok: false,
      error: "Only JPG, PNG, WEBP, or GIF images are supported.",
    });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Promise.resolve({ ok: false, error: "Image is too large — max 5MB." });
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ ok: true, url: reader.result as string });
    reader.readAsDataURL(file);
  });
}
