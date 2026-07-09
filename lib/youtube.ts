const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

// Converts any pasted YouTube URL (watch?v=, youtu.be short links, shorts,
// live, m.youtube.com, or an already-correct embed link — with or without
// extra query params like list=/start_radio=/t=) into the canonical
// https://www.youtube.com/embed/VIDEO_ID form required to actually play in
// an <iframe>. Returns null if the URL isn't a recognizable YouTube link,
// so callers can fall back to treating it as a direct video file.
export function toYouTubeEmbedUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^(www\.|m\.)/, "");
  let videoId: string | null = null;

  if (host === "youtu.be") {
    videoId = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (parsed.pathname === "/watch") {
      videoId = parsed.searchParams.get("v");
    } else if (segments[0] === "embed" || segments[0] === "shorts" || segments[0] === "live") {
      videoId = segments[1] ?? null;
    }
  } else {
    return null;
  }

  if (!videoId || !VIDEO_ID_PATTERN.test(videoId)) return null;
  return `https://www.youtube.com/embed/${videoId}`;
}
