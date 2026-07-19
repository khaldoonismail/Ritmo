"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { getAvatarSignedUrl } from "@/lib/studentAvatar";
import { colors } from "@/lib/theme";

const SIZE = 36;

export default function StudentThumbnail({
  avatarUrl,
}: {
  avatarUrl: string | null;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!avatarUrl) {
      setSignedUrl(null);
      return;
    }
    const supabase = createBrowserSupabaseClient();
    getAvatarSignedUrl(supabase, avatarUrl).then((url) => {
      if (!cancelled) setSignedUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  const baseStyle: React.CSSProperties = {
    width: SIZE,
    height: SIZE,
    borderRadius: "50%",
    flexShrink: 0,
    background: colors.background,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  };

  if (signedUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={signedUrl}
        alt=""
        style={{ ...baseStyle, objectFit: "cover" }}
      />
    );
  }

  return (
    <div style={baseStyle} aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" fill={colors.neutralGray} />
        <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" fill={colors.neutralGray} />
      </svg>
    </div>
  );
}
