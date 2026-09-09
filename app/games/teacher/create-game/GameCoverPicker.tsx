"use client";

import { useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { coverIconGallery, resolveCoverDisplay, uploadGameCover } from "@/lib/gameCover";
import { colors, radius, solidShadow } from "@/lib/theme";

const BOX_SIZE = 110;

export default function GameCoverPicker({
  value,
  title,
  teacherId,
  onChange,
}: {
  value: string | null;
  title: string;
  teacherId: string | null;
  onChange: (value: string | null) => void;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [tab, setTab] = useState<"upload" | "icons">("upload");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const display = resolveCoverDisplay(value, title || "Untitled game");

  async function handleFile(file: File | undefined) {
    if (!file || !teacherId) return;
    setError("");
    setBusy(true);

    const supabase = createBrowserSupabaseClient();
    const result = await uploadGameCover(supabase, teacherId, file);

    setBusy(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    onChange(result.url);
    setPanelOpen(false);
  }

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    fontSize: "0.8rem",
    fontWeight: 800,
    padding: "0.45rem 0.5rem",
    borderRadius: radius.button,
    border: "none",
    background: active ? colors.greenButton : colors.background,
    color: active ? colors.white : colors.textPrimary,
    cursor: "pointer",
  });

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setPanelOpen((v) => !v)}
        aria-label="Add cover image or icon"
        style={{
          width: BOX_SIZE,
          height: BOX_SIZE,
          borderRadius: radius.card,
          border: value ? "none" : `2px dashed ${colors.inputBorder}`,
          boxShadow: value ? solidShadow(4, colors.gamesCardShadow) : "none",
          background: value
            ? display.kind === "icon"
              ? display.bg
              : colors.white
            : colors.listRowBg,
          cursor: "pointer",
          padding: 0,
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!value && (
          <span
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.25rem",
              color: colors.textPrimary,
              opacity: 0.6,
            }}
          >
            <span style={{ fontSize: "1.4rem", fontWeight: 800, lineHeight: 1 }}>+</span>
            <span style={{ fontSize: "0.65rem", fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>
              Add Cover
              <br />
              Image
            </span>
          </span>
        )}
        {value && display.kind === "image" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={display.url}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        {value && display.kind === "icon" && (
          <span style={{ fontSize: "2.5rem", lineHeight: 1 }} aria-hidden="true">
            {display.emoji}
          </span>
        )}
      </button>

      {panelOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            marginTop: "0.5rem",
            width: "260px",
            borderRadius: radius.card,
            padding: "0.75rem",
            background: colors.white,
            boxShadow: solidShadow(4, colors.rosterCardShadow),
            zIndex: 9999,
            textAlign: "left",
          }}
        >
          <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.6rem" }}>
            <button type="button" onClick={() => setTab("upload")} style={tabButtonStyle(tab === "upload")}>
              Upload Image
            </button>
            <button type="button" onClick={() => setTab("icons")} style={tabButtonStyle(tab === "icons")}>
              Choose Icon
            </button>
          </div>

          {tab === "upload" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={busy || !teacherId}
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 800,
                  padding: "0.5rem 0.7rem",
                  borderRadius: radius.button,
                  border: "none",
                  background: colors.orange,
                  boxShadow: busy ? "none" : solidShadow(3, colors.orangeShadow),
                  color: colors.white,
                  cursor: busy ? "default" : "pointer",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {busy ? "Uploading..." : "Choose File"}
              </button>
              <p style={{ fontSize: "0.7rem", opacity: 0.6, margin: 0 }}>
                JPG or PNG, max 2MB. Auto-resized to 400×300.
              </p>
              {error && (
                <p style={{ color: colors.coralText, fontSize: "0.75rem", fontWeight: 600, margin: 0 }}>
                  {error}
                </p>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => handleFile(e.target.files?.[0])}
                style={{ display: "none" }}
              />
            </div>
          )}

          {tab === "icons" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem" }}>
              {coverIconGallery.map((icon) => (
                <button
                  key={icon.key}
                  type="button"
                  onClick={() => {
                    onChange(`icon:${icon.key}`);
                    setPanelOpen(false);
                  }}
                  aria-label={icon.label}
                  style={{
                    aspectRatio: "1",
                    fontSize: "1.3rem",
                    borderRadius: radius.iconSquare,
                    border: "none",
                    background: colors.background,
                    cursor: "pointer",
                  }}
                >
                  <span aria-hidden="true">{icon.emoji}</span>
                </button>
              ))}
            </div>
          )}

          {value && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setPanelOpen(false);
              }}
              style={{
                marginTop: "0.6rem",
                fontSize: "0.75rem",
                fontWeight: 700,
                background: "none",
                border: "none",
                color: colors.coralText,
                cursor: "pointer",
                padding: 0,
              }}
            >
              Remove cover
            </button>
          )}
        </div>
      )}
    </div>
  );
}
