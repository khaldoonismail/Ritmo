import { toYouTubeEmbedUrl } from "@/lib/youtube";

export type VideoSource =
  | { kind: "iframe"; embedUrl: string }
  | { kind: "native"; url: string }
  | { kind: "needs-embed-link"; provider: string }
  | { kind: "unsupported" };

function toVimeoEmbedUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  let videoId: string | null = null;

  if (host === "player.vimeo.com") {
    videoId = segments[0] === "video" ? segments[1] ?? null : null;
  } else {
    // Handles vimeo.com/123456789, vimeo.com/channels/x/123456789,
    // vimeo.com/groups/x/videos/123456789, etc.
    videoId = [...segments].reverse().find((s) => /^\d+$/.test(s)) ?? null;
  }

  if (!videoId || !/^\d+$/.test(videoId)) return null;
  return `https://player.vimeo.com/video/${videoId}`;
}

function toGoogleDriveEmbedUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");
  if (host !== "drive.google.com") return null;

  const segments = parsed.pathname.split("/").filter(Boolean);
  let fileId: string | null = null;

  const dIndex = segments.indexOf("d");
  if (segments[0] === "file" && dIndex !== -1) {
    fileId = segments[dIndex + 1] ?? null;
  } else if (parsed.pathname === "/open" || parsed.pathname === "/uc") {
    fileId = parsed.searchParams.get("id");
  }

  if (!fileId || !/^[A-Za-z0-9_-]{10,}$/.test(fileId)) return null;
  return `https://drive.google.com/file/d/${fileId}/preview`;
}

// Microsoft doesn't expose a deterministic transform from a normal share
// link to an embeddable one — the embed URL (with its cid/resid/authkey or
// embed.aspx UniqueId) can only come from OneDrive/SharePoint's own "Embed"
// share option. So we only pass a link through if it's already in that
// shape, and otherwise ask the teacher to paste that specific link instead.
function resolveOneDriveOrSharePoint(rawUrl: string): VideoSource | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");
  const isOneDrive = host === "onedrive.live.com" || host === "1drv.ms";
  const isSharePoint = host.endsWith(".sharepoint.com");
  if (!isOneDrive && !isSharePoint) return null;

  const path = parsed.pathname.toLowerCase();
  const alreadyEmbed = path.includes("/embed") || path.includes("embed.aspx");

  if (alreadyEmbed) {
    return { kind: "iframe", embedUrl: rawUrl.trim() };
  }
  return { kind: "needs-embed-link", provider: "OneDrive/SharePoint" };
}

function isDirectVideoFile(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    return /\.(mp4|webm|mov)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function resolveVideoSource(rawUrl: string): VideoSource {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { kind: "unsupported" };

  const youtubeEmbed = toYouTubeEmbedUrl(trimmed);
  if (youtubeEmbed) return { kind: "iframe", embedUrl: youtubeEmbed };

  const vimeoEmbed = toVimeoEmbedUrl(trimmed);
  if (vimeoEmbed) return { kind: "iframe", embedUrl: vimeoEmbed };

  const driveEmbed = toGoogleDriveEmbedUrl(trimmed);
  if (driveEmbed) return { kind: "iframe", embedUrl: driveEmbed };

  const msResult = resolveOneDriveOrSharePoint(trimmed);
  if (msResult) return msResult;

  if (isDirectVideoFile(trimmed)) return { kind: "native", url: trimmed };

  return { kind: "unsupported" };
}

export const UNSUPPORTED_VIDEO_MESSAGE =
  "This link isn't supported. Try a YouTube, Google Drive, Vimeo, or direct video file link.";
