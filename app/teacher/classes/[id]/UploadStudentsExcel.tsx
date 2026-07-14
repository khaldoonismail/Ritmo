"use client";

import { useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { parseRosterFile } from "@/lib/parseStudentRoster";
import { generateUniquePins } from "@/lib/studentPin";

type Stage = "idle" | "preview" | "success";

interface NewStudent {
  id: string;
  name: string;
  pin: string;
}

export default function UploadStudentsExcel({
  classId,
  onAdded,
  onDone,
}: {
  classId: string;
  onAdded: (students: { id: string; name: string }[]) => void;
  onDone: () => void;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [names, setNames] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [added, setAdded] = useState<NewStudent[]>([]);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const duplicateCount = names.length - new Set(names.map((n) => n.toLowerCase())).size;

  function resetAll() {
    setStage("idle");
    setNames([]);
    setError("");
    setAdded([]);
    setCopied(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");

    const result = await parseRosterFile(file);
    if ("error" in result) {
      setError(result.error);
      setStage("idle");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setNames(result.names);
    setStage("preview");
  }

  async function handleConfirm() {
    setConfirmBusy(true);
    setError("");

    const supabase = createBrowserSupabaseClient();

    const { data: existing, error: existingError } = await supabase
      .from("students")
      .select("pin")
      .eq("class_id", classId);

    if (existingError) {
      setConfirmBusy(false);
      setError(existingError.message);
      return;
    }

    const pins = generateUniquePins(
      names.length,
      (existing || []).map((s) => s.pin)
    );

    const rows = names.map((name, i) => ({
      class_id: classId,
      name,
      pin: pins[i],
    }));

    const { data, error: insertError } = await supabase
      .from("students")
      .insert(rows)
      .select("id, name, pin");

    setConfirmBusy(false);

    if (insertError || !data) {
      setError(insertError?.message || "Could not add students.");
      return;
    }

    setAdded(data);
    setStage("success");
    onAdded(data.map((s) => ({ id: s.id, name: s.name })));
  }

  async function handleCopyList() {
    const text = added.map((s) => `${s.name}: ${s.pin}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const inputStyle: React.CSSProperties = {
    fontSize: "0.95rem",
    padding: "0.55rem 0.75rem",
    borderRadius: "8px",
    border: "1px solid #ddd",
    outline: "none",
    fontFamily: "inherit",
    width: "100%",
  };

  const primaryButtonStyle: React.CSSProperties = {
    fontSize: "0.9rem",
    fontWeight: 700,
    padding: "0.55rem 1rem",
    borderRadius: "8px",
    border: "none",
    background: "#111",
    color: "#fff",
    cursor: "pointer",
  };

  const secondaryButtonStyle: React.CSSProperties = {
    ...primaryButtonStyle,
    background: "#fff",
    color: "#111",
    border: "1px solid #ddd",
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
        marginBottom: "0.75rem",
        background: "#fff",
        textAlign: "left",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {stage !== "success" && (
        <>
          <label style={{ fontSize: "0.85rem", opacity: 0.7 }}>
            Upload a .xlsx or .csv file with a "Name" column (header row required)
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={handleFileChange}
            style={inputStyle}
          />
        </>
      )}

      {error && (
        <p style={{ color: "#c00", fontSize: "0.85rem", margin: 0 }}>{error}</p>
      )}

      {stage === "preview" && (
        <>
          <p style={{ fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>
            {names.length} student{names.length === 1 ? "" : "s"} will be added
          </p>
          {duplicateCount > 0 && (
            <p style={{ fontSize: "0.8rem", opacity: 0.7, margin: 0 }}>
              Note: {duplicateCount} duplicate name{duplicateCount === 1 ? "" : "s"}{" "}
              found in this file — they'll be added separately.
            </p>
          )}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              maxHeight: "200px",
              overflowY: "auto",
              border: "1px solid #eee",
              borderRadius: "8px",
              padding: "0.5rem 0.7rem",
            }}
          >
            {names.map((name, i) => (
              <span key={i} style={{ fontSize: "0.85rem" }}>
                {name}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={handleConfirm}
              disabled={confirmBusy}
              style={{ ...primaryButtonStyle, opacity: confirmBusy ? 0.6 : 1 }}
            >
              {confirmBusy ? "Adding..." : "Confirm & Add"}
            </button>
            <button
              onClick={resetAll}
              disabled={confirmBusy}
              style={secondaryButtonStyle}
            >
              Cancel
            </button>
          </div>
        </>
      )}

      {stage === "success" && (
        <>
          <p style={{ fontSize: "0.9rem", fontWeight: 700, margin: 0 }}>
            Added {added.length} student{added.length === 1 ? "" : "s"} — give each
            one their PIN below.
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
              maxHeight: "260px",
              overflowY: "auto",
              border: "1px solid #eee",
              borderRadius: "8px",
              padding: "0.6rem 0.8rem",
            }}
          >
            {added.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: "0.9rem",
                }}
              >
                <span>{s.name}</span>
                <strong style={{ direction: "ltr", display: "inline-block" }}>
                  {s.pin}
                </strong>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button onClick={handleCopyList} style={secondaryButtonStyle}>
              {copied ? "Copied!" : "Copy list"}
            </button>
            <button
              onClick={() => {
                resetAll();
                onDone();
              }}
              style={primaryButtonStyle}
            >
              Done
            </button>
          </div>
        </>
      )}

      {stage === "idle" && (
        <button onClick={onDone} style={secondaryButtonStyle}>
          Cancel
        </button>
      )}
    </div>
  );
}
