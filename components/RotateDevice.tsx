"use client";

import { useEffect, useState } from "react";
import { colors } from "@/lib/theme";

// Phones play the runner games in landscape only (the road needs the
// width). A phone is a touch screen whose short side is under 600 CSS px:
// every iPhone (Pro Max: 430) and most Android phones, but no iPad (the
// mini is 744), so tablets keep both orientations.
const PHONE_SHORT_SIDE = 600;

function isPhonePortrait(): boolean {
  if (typeof window === "undefined") return false;
  const touch = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
  if (!touch) return false;
  const shortSide = Math.min(window.screen.width, window.screen.height);
  if (shortSide >= PHONE_SHORT_SIDE) return false;
  return window.innerHeight > window.innerWidth;
}

// True while a phone is held upright. Follows turns of the device.
export function usePhonePortrait(): boolean {
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const update = () => setPortrait(isPhonePortrait());
    update();
    const queries = [window.matchMedia("(orientation: portrait)"), window.matchMedia("(pointer: coarse)")];
    queries.forEach((mq) => mq.addEventListener("change", update));
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    // iOS can report the new size a moment after the turn.
    window.screen.orientation?.addEventListener?.("change", update);
    return () => {
      queries.forEach((mq) => mq.removeEventListener("change", update));
      window.screen.orientation?.removeEventListener?.("change", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
  return portrait;
}

// Full-screen "turn your phone" card, shown over the game.
export function RotateDeviceOverlay() {
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Please rotate your device to landscape to play"
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        padding: "24px",
        background: colors.background,
        color: colors.textPrimary,
        textAlign: "center",
        touchAction: "none",
      }}
    >
      <style>
        {`@keyframes ritmoRotatePhone{0%,15%{transform:rotate(0deg)}45%,70%{transform:rotate(-90deg)}100%{transform:rotate(0deg)}}
@media (prefers-reduced-motion: reduce){.ritmo-rotate-phone{animation:none!important;transform:rotate(-45deg)}}`}
      </style>
      <div
        className="ritmo-rotate-phone"
        aria-hidden="true"
        style={{
          width: 74,
          height: 124,
          borderRadius: 16,
          border: `6px solid ${colors.textPrimary}`,
          background: "#BFE3F5",
          position: "relative",
          animation: "ritmoRotatePhone 2.4s ease-in-out infinite",
        }}
      >
        {/* the speaker slot, so it reads as a phone */}
        <div
          style={{
            position: "absolute",
            top: 6,
            left: "50%",
            width: 22,
            height: 5,
            marginLeft: -11,
            borderRadius: 3,
            background: colors.textPrimary,
          }}
        />
        <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", fontSize: "1.8rem" }}>
          🏃
        </div>
      </div>
      <div>
        <div style={{ fontSize: "1.6rem", fontWeight: 900, lineHeight: 1.2 }}>Please rotate your device 🔄</div>
        <div style={{ marginTop: "0.5rem", fontWeight: 700, opacity: 0.7, lineHeight: 1.4 }}>
          Turn your phone sideways to play. The game is paused.
        </div>
      </div>
    </div>
  );
}
