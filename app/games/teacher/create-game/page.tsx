"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { colors, radius, solidShadow } from "@/lib/theme";

type MediaType = "text" | "image" | "video" | "audio";

interface Question {
  id: string;
  mediaType: MediaType;
  x: number;
  y: number;
  width: number;
  height: number;
  prompt: string;
  mediaContent: string;
  options: string[];
  correctIndex: number;
  timeLimit: number;
}

let zCounter = 1;

const typeLabels: Record<MediaType, string> = {
  text: "Text Question",
  image: "Image Question",
  video: "Video Question",
  audio: "Audio Question",
};

function newQuestion(mediaType: MediaType, x: number, y: number): Question {
  const id = Math.random().toString(36).slice(2);
  return {
    id,
    mediaType,
    x,
    y,
    width: 320,
    height: 420,
    prompt: "",
    mediaContent: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    timeLimit: 20,
  };
}

const answerColors = ["#e21b3c", "#1368ce", "#d89e00", "#26890c"];

export default function CreateGamePage() {
  const router = useRouter();
  const [gameTitle, setGameTitle] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zOrder, setZOrder] = useState<Record<string, number>>({});
  const [myTeacherId, setMyTeacherId] = useState<string | null>(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/accounts/login");
        return;
      }

      const { data: teacherRow } = await supabase
        .from("teachers")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();
      if (teacherRow) setMyTeacherId(teacherRow.id);
    }

    load();
  }, [router]);

  function addQuestion(mediaType: MediaType) {
    const x = 40 + Math.random() * 60;
    const y = 40 + Math.random() * 60;
    const q = newQuestion(mediaType, x, y);
    setQuestions((prev) => [...prev, q]);
    setZOrder((prev) => ({ ...prev, [q.id]: zCounter++ }));
    setPickerOpen(false);
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  function updateQuestion(id: string, patch: Partial<Question>) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, ...patch } : q))
    );
  }

  function bringToFront(id: string) {
    setZOrder((prev) => ({ ...prev, [id]: zCounter++ }));
  }

  function handleDragStart(e: React.MouseEvent, q: Question) {
    e.preventDefault();
    bringToFront(q.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = q.x;
    const originY = q.y;

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      updateQuestion(q.id, {
        x: Math.max(0, originX + dx),
        y: Math.max(0, originY + dy),
      });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleResizeStart(e: React.MouseEvent, q: Question) {
    e.preventDefault();
    e.stopPropagation();
    bringToFront(q.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const originW = q.width;
    const originH = q.height;

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      updateQuestion(q.id, {
        width: Math.max(240, originW + dx),
        height: Math.max(300, originH + dy),
      });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function saveGame() {
    if (!gameTitle.trim() || questions.length === 0) {
      alert("Add a game title and at least one question before saving.");
      return;
    }
    if (!myTeacherId) return;

    setSaveError("");
    setSaveBusy(true);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from("games").insert({
      teacher_id: myTeacherId,
      title: gameTitle.trim(),
      questions,
    });

    setSaveBusy(false);

    if (error) {
      setSaveError(error.message);
      return;
    }

    router.push("/games/teacher/library");
  }

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

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        gap: "1rem",
        background: colors.background,
        color: colors.textPrimary,
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>
        Create a Game
      </h1>

      <div
        style={{
          display: "flex",
          gap: "0.5rem",
          width: "100%",
          maxWidth: "700px",
        }}
      >
        <input
          type="text"
          placeholder="Game title"
          value={gameTitle}
          onChange={(e) => setGameTitle(e.target.value)}
          style={{
            ...inputStyle,
            fontSize: "1.1rem",
            fontWeight: 700,
            padding: "0.6rem 0.8rem",
          }}
        />
        <button
          onClick={saveGame}
          disabled={saveBusy}
          style={{
            fontSize: "0.95rem",
            fontWeight: 800,
            padding: "0.6rem 1.2rem",
            borderRadius: radius.button,
            border: "none",
            background: colors.orange,
            boxShadow: saveBusy ? "none" : solidShadow(4, colors.orangeShadow),
            color: colors.white,
            cursor: saveBusy ? "default" : "pointer",
            opacity: saveBusy ? 0.7 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {saveBusy ? "Saving..." : "Save Game"}
        </button>
      </div>

      {saveError && (
        <p style={{ color: colors.coralText, fontSize: "0.85rem", width: "100%", maxWidth: "700px" }}>
          {saveError}
        </p>
      )}

      <div style={{ position: "relative", width: "100%", maxWidth: "700px" }}>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          style={{
            fontSize: "0.95rem",
            fontWeight: 800,
            padding: "0.6rem 1rem",
            borderRadius: radius.button,
            border: "none",
            background: colors.greenButton,
            boxShadow: solidShadow(3, colors.greenButtonShadow),
            color: colors.white,
            cursor: "pointer",
          }}
        >
          + Add Question
        </button>

        {pickerOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: "0.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.25rem",
              borderRadius: radius.card,
              padding: "0.5rem",
              background: colors.white,
              boxShadow: solidShadow(4, colors.rosterCardShadow),
              minWidth: "200px",
              zIndex: 9999,
            }}
          >
            {(Object.keys(typeLabels) as MediaType[]).map((t) => (
              <button
                key={t}
                onClick={() => addQuestion(t)}
                className="theme-picker-item"
                style={{
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  padding: "0.55rem 0.8rem",
                  borderRadius: radius.iconSquare,
                  border: "none",
                  background: "transparent",
                  color: colors.textPrimary,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                {typeLabels[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "1000px",
          height: "600px",
          border: "2px dashed #ddd",
          borderRadius: "12px",
          background:
            "repeating-linear-gradient(0deg, #fafafa, #fafafa 24px, #f3f3f3 25px), repeating-linear-gradient(90deg, transparent, transparent 24px, #f0f0f0 25px)",
          overflow: "hidden",
        }}
      >
        {questions.length === 0 && (
          <span
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              opacity: 0.4,
              fontSize: "0.9rem",
            }}
          >
            Click "+ Add Question" to place your first question
          </span>
        )}

        {questions.map((q) => (
          <div
            key={q.id}
            onMouseDown={() => bringToFront(q.id)}
            style={{
              position: "absolute",
              left: q.x,
              top: q.y,
              width: q.width,
              height: q.height,
              zIndex: zOrder[q.id] || 1,
              background: "#fff",
              border: "1px solid #ddd",
              borderRadius: "10px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              onMouseDown={(e) => handleDragStart(e, q)}
              style={{
                cursor: "grab",
                padding: "0.4rem 0.6rem",
                background: "#f5f5f5",
                borderBottom: "1px solid #eee",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                userSelect: "none",
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  opacity: 0.6,
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                {typeLabels[q.mediaType]}
              </span>
              <button
                onClick={() => removeQuestion(q.id)}
                style={{
                  border: "none",
                  background: "none",
                  color: colors.coralText,
                  cursor: "pointer",
                  fontSize: "0.8rem",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                flex: 1,
                padding: "0.6rem",
                overflow: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
                textAlign: "left",
              }}
            >
              <input
                type="text"
                placeholder="Question prompt"
                value={q.prompt}
                onChange={(e) =>
                  updateQuestion(q.id, { prompt: e.target.value })
                }
                style={inputStyle}
              />

              {q.mediaType === "text" && (
                <textarea
                  placeholder="Text shown to players (e.g. a passage or lyric)"
                  value={q.mediaContent}
                  onChange={(e) =>
                    updateQuestion(q.id, { mediaContent: e.target.value })
                  }
                  style={{ ...inputStyle, minHeight: "60px", resize: "none" }}
                />
              )}

              {q.mediaType === "image" && (
                <>
                  <input
                    type="text"
                    placeholder="Image URL"
                    value={q.mediaContent}
                    onChange={(e) =>
                      updateQuestion(q.id, { mediaContent: e.target.value })
                    }
                    style={inputStyle}
                  />
                  {q.mediaContent && (
                    <img
                      src={q.mediaContent}
                      alt="Preview"
                      style={{ maxWidth: "100%", borderRadius: "6px" }}
                    />
                  )}
                </>
              )}

              {q.mediaType === "video" && (
                <>
                  <input
                    type="text"
                    placeholder="Video URL"
                    value={q.mediaContent}
                    onChange={(e) =>
                      updateQuestion(q.id, { mediaContent: e.target.value })
                    }
                    style={inputStyle}
                  />
                  {q.mediaContent && (
                    <video
                      src={q.mediaContent}
                      controls
                      style={{ maxWidth: "100%", borderRadius: "6px" }}
                    />
                  )}
                </>
              )}

              {q.mediaType === "audio" && (
                <>
                  <input
                    type="text"
                    placeholder="Audio URL"
                    value={q.mediaContent}
                    onChange={(e) =>
                      updateQuestion(q.id, { mediaContent: e.target.value })
                    }
                    style={inputStyle}
                  />
                  {q.mediaContent && (
                    <audio
                      src={q.mediaContent}
                      controls
                      style={{ width: "100%" }}
                    />
                  )}
                </>
              )}

              {q.options.map((opt, i) => (
                <div
                  key={i}
                  style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
                >
                  <span
                    style={{
                      width: "10px",
                      height: "10px",
                      borderRadius: "2px",
                      background: answerColors[i],
                      flexShrink: 0,
                    }}
                  />
                  <input
                    type="radio"
                    checked={q.correctIndex === i}
                    onChange={() => updateQuestion(q.id, { correctIndex: i })}
                  />
                  <input
                    type="text"
                    placeholder={`Answer ${i + 1}`}
                    value={opt}
                    onChange={(e) => {
                      const newOptions = [...q.options];
                      newOptions[i] = e.target.value;
                      updateQuestion(q.id, { options: newOptions });
                    }}
                    style={inputStyle}
                  />
                </div>
              ))}

              <div
                style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
              >
                <label style={{ fontSize: "0.8rem", opacity: 0.7 }}>
                  Time limit (sec)
                </label>
                <input
                  type="number"
                  min={5}
                  max={120}
                  value={q.timeLimit}
                  onChange={(e) =>
                    updateQuestion(q.id, {
                      timeLimit: Number(e.target.value) || 20,
                    })
                  }
                  style={{ ...inputStyle, width: "70px" }}
                />
              </div>
            </div>

            <div
              onMouseDown={(e) => handleResizeStart(e, q)}
              style={{
                position: "absolute",
                right: 0,
                bottom: 0,
                width: "16px",
                height: "16px",
                cursor: "nwse-resize",
                background:
                  "linear-gradient(135deg, transparent 50%, #bbb 50%)",
              }}
            />
          </div>
        ))}
      </div>

      <Link
        href="/games/teacher"
        style={{
          fontSize: "0.9rem",
          fontWeight: 700,
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
          marginTop: "0.5rem",
        }}
      >
        ← Back to Games Dashboard
      </Link>
    </main>
  );
}
