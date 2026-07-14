"use client";

import { useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { uploadStudentAvatar } from "@/lib/studentAvatar";

export default function StudentPhotoUploader({
  studentId,
  studentName,
  onUploaded,
  onCancel,
}: {
  studentId: string;
  studentName: string;
  onUploaded: (avatarUrl: string) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(true);

    const supabase = createBrowserSupabaseClient();
    const result = await uploadStudentAvatar(supabase, studentId, file);

    setBusy(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    onUploaded(result.path);
  }

  const buttonStyle: React.CSSProperties = {
    fontSize: "0.9rem",
    fontWeight: 700,
    padding: "0.55rem 1rem",
    borderRadius: "8px",
    border: "1px solid #ddd",
    background: "#fff",
    color: "#111",
    cursor: "pointer",
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
        border: "1px solid #ddd",
        borderRadius: "10px",
        padding: "0.9rem",
        marginTop: "-0.25rem",
        marginBottom: "0.25rem",
        background: "#fafafa",
        textAlign: "left",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <p style={{ fontSize: "0.85rem", fontWeight: 700, margin: 0 }}>
        Photo for {studentName}
      </p>

      {error && (
        <p style={{ color: "#c00", fontSize: "0.85rem", margin: 0 }}>{error}</p>
      )}

      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          onClick={() => cameraInputRef.current?.click()}
          disabled={busy}
          style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }}
        >
          📷 Take Photo
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
          style={{ ...buttonStyle, opacity: busy ? 0.6 : 1 }}
        >
          🖼 Upload from Device
        </button>
        <button onClick={onCancel} disabled={busy} style={buttonStyle}>
          Cancel
        </button>
      </div>

      {busy && (
        <p style={{ fontSize: "0.8rem", opacity: 0.6, margin: 0 }}>Uploading...</p>
      )}

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png"
        capture="user"
        onChange={(e) => handleFile(e.target.files?.[0])}
        style={{ display: "none" }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={(e) => handleFile(e.target.files?.[0])}
        style={{ display: "none" }}
      />
    </div>
  );
}
