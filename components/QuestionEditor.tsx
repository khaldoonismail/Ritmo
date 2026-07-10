"use client";

import { useState } from "react";
import {
  QuestionData,
  QuestionType,
  QUESTION_TYPE_LABELS,
  BLANK_MARKER,
  defaultQuestionData,
  countBlanks,
} from "@/lib/questionTypes";
import { validateAndReadImage } from "@/lib/imageUpload";
import { resolveVideoSource, UNSUPPORTED_VIDEO_MESSAGE } from "@/lib/videoEmbed";

const inputStyle: React.CSSProperties = {
  fontSize: "0.9rem",
  padding: "0.4rem 0.6rem",
  borderRadius: "6px",
  border: "1px solid #ddd",
  outline: "none",
  direction: "ltr",
  textAlign: "left",
  fontFamily: "inherit",
  width: "100%",
};

const smallButtonStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: "0.75rem",
  fontWeight: 700,
  padding: "0.3rem 0.6rem",
  borderRadius: "6px",
  border: "1px solid #111",
  background: "#fff",
  color: "#111",
  cursor: "pointer",
};

// Self-contained authoring UI for one question: pick a type, optionally
// attach an image/video/audio, fill in the type-specific fields. Emits
// patches via onChange so the caller (a lesson block today, an assessment
// item later) owns where the QuestionData actually lives.
export default function QuestionEditor({
  value,
  onChange,
}: {
  value: QuestionData;
  onChange: (patch: Partial<QuestionData>) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [imageError, setImageError] = useState("");

  function handleTypeChange(questionType: QuestionType) {
    onChange(defaultQuestionData(questionType, value.prompt));
  }

  function handlePromptChange(prompt: string) {
    const patch: Partial<QuestionData> = { prompt };
    if (value.questionType === "fill_blank") {
      const count = countBlanks(prompt);
      const blanks = [...(value.blanks || [])];
      while (blanks.length < count) blanks.push("");
      blanks.length = count;
      patch.blanks = blanks;
    }
    onChange(patch);
  }

  async function handleAttachmentImageFile(file: File) {
    const result = await validateAndReadImage(file);
    if (!result.ok) {
      setImageError(result.error);
      return;
    }
    setImageError("");
    onChange({ attachmentUrl: result.url });
  }

  function handleAttachmentAudioFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => onChange({ attachmentUrl: reader.result as string });
    reader.readAsDataURL(file);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
      <select
        value={value.questionType}
        onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
        style={inputStyle}
      >
        {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((t) => (
          <option key={t} value={t}>
            {QUESTION_TYPE_LABELS[t]}
          </option>
        ))}
      </select>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.7rem", fontSize: "0.75rem" }}>
          {(["none", "image", "video", "audio"] as const).map((opt) => (
            <label key={opt} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <input
                type="radio"
                checked={opt === "none" ? !value.attachmentType : value.attachmentType === opt}
                onChange={() =>
                  onChange({
                    attachmentType: opt === "none" ? undefined : opt,
                    attachmentUrl: "",
                  })
                }
              />
              {opt === "none" ? "No attachment" : opt[0].toUpperCase() + opt.slice(1)}
            </label>
          ))}
        </div>

        {value.attachmentType === "image" && (
          <div
            tabIndex={0}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleAttachmentImageFile(file);
            }}
            onPaste={(e) => {
              const item = Array.from(e.clipboardData.items).find((i) =>
                i.type.startsWith("image/")
              );
              const file = item?.getAsFile();
              if (file) handleAttachmentImageFile(file);
            }}
            style={{
              minHeight: "90px",
              border: dragOver ? "2px dashed #111" : "2px dashed #ccc",
              background: dragOver ? "#eef5ff" : "#fafafa",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              outline: "none",
              overflow: "hidden",
            }}
          >
            {value.attachmentUrl ? (
              <div style={{ position: "relative", width: "100%" }}>
                <img
                  src={value.attachmentUrl}
                  alt=""
                  style={{ maxWidth: "100%", maxHeight: "150px", display: "block", margin: "0 auto" }}
                />
                <button
                  onClick={() => onChange({ attachmentUrl: "" })}
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    border: "none",
                    background: "rgba(0,0,0,0.65)",
                    color: "#fff",
                    fontSize: "0.65rem",
                    cursor: "pointer",
                  }}
                  title="Remove image"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "0.5rem" }}>
                <p style={{ fontSize: "0.72rem", opacity: 0.6, margin: "0 0 0.4rem" }}>
                  Drag an image, paste (⌘+V), or upload
                </p>
                <label style={smallButtonStyle}>
                  Upload Image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAttachmentImageFile(file);
                      e.target.value = "";
                    }}
                  />
                </label>
                {imageError && (
                  <p style={{ color: "#c00", fontSize: "0.7rem", margin: "0.3rem 0 0" }}>
                    {imageError}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {value.attachmentType === "video" && (
          <>
            <input
              type="text"
              placeholder="Video URL (YouTube, Google Drive, Vimeo, OneDrive/SharePoint, or direct file)"
              value={value.attachmentUrl || ""}
              onChange={(e) => onChange({ attachmentUrl: e.target.value })}
              style={inputStyle}
            />
            {value.attachmentUrl &&
              (() => {
                const source = resolveVideoSource(value.attachmentUrl!);
                if (source.kind === "iframe") {
                  return (
                    <iframe
                      src={source.embedUrl}
                      title="Video player"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      style={{ width: "100%", aspectRatio: "16 / 9", border: "none", borderRadius: "6px" }}
                    />
                  );
                }
                if (source.kind === "native") {
                  return (
                    <video
                      src={source.url}
                      controls
                      style={{ maxWidth: "100%", borderRadius: "6px" }}
                    />
                  );
                }
                if (source.kind === "needs-embed-link") {
                  return (
                    <p style={{ fontSize: "0.75rem", color: "#a66300" }}>
                      Needs a {source.provider} Embed link.
                    </p>
                  );
                }
                return (
                  <p style={{ fontSize: "0.75rem", color: "#c00" }}>{UNSUPPORTED_VIDEO_MESSAGE}</p>
                );
              })()}
          </>
        )}

        {value.attachmentType === "audio" && (
          <>
            <input
              type="text"
              placeholder="Audio URL (SoundCloud or direct MP3 link)"
              value={value.attachmentUrl || ""}
              onChange={(e) => onChange({ attachmentUrl: e.target.value })}
              style={inputStyle}
            />
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAttachmentAudioFile(file);
              }}
              style={{ fontSize: "0.75rem" }}
            />
            {value.attachmentUrl && (
              <audio src={value.attachmentUrl} controls style={{ width: "100%" }} />
            )}
          </>
        )}
      </div>

      <textarea
        placeholder={
          value.questionType === "fill_blank"
            ? `Question text (use ${BLANK_MARKER} for each blank)`
            : "Question text"
        }
        value={value.prompt}
        onChange={(e) => handlePromptChange(e.target.value)}
        style={{ ...inputStyle, minHeight: "50px", resize: "none" }}
      />

      {value.questionType === "multiple_choice" &&
        (value.options || []).map((opt, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <input
              type="radio"
              checked={value.correctIndex === i}
              onChange={() => onChange({ correctIndex: i })}
            />
            <input
              type="text"
              placeholder={`Option ${i + 1}`}
              value={opt}
              onChange={(e) => {
                const next = [...(value.options || [])];
                next[i] = e.target.value;
                onChange({ options: next });
              }}
              style={inputStyle}
            />
          </div>
        ))}

      {value.questionType === "true_false" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {["True", "False"].map((label, i) => (
            <label
              key={label}
              style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem" }}
            >
              <input
                type="radio"
                checked={value.correctIndex === i}
                onChange={() => onChange({ correctIndex: i })}
              />
              {label} is correct
            </label>
          ))}
        </div>
      )}

      {value.questionType === "fill_blank" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          {(value.blanks || []).length === 0 && (
            <p style={{ fontSize: "0.75rem", opacity: 0.5, margin: 0 }}>
              Add {BLANK_MARKER} to the question text above to create a blank.
            </p>
          )}
          {(value.blanks || []).map((answer, i) => (
            <input
              key={i}
              type="text"
              placeholder={`Answer for blank ${i + 1}`}
              value={answer}
              onChange={(e) => {
                const next = [...(value.blanks || [])];
                next[i] = e.target.value;
                onChange({ blanks: next });
              }}
              style={inputStyle}
            />
          ))}
        </div>
      )}

      {value.questionType !== "short_answer" && (
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem" }}>
          <input
            type="checkbox"
            checked={!!value.showCorrectAnswer}
            onChange={(e) => onChange({ showCorrectAnswer: e.target.checked })}
          />
          Show correct answer after submission
        </label>
      )}
    </div>
  );
}
