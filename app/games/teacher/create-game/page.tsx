"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { colors, radius, solidShadow } from "@/lib/theme";
import GameCoverPicker from "./GameCoverPicker";

type MediaType = "text" | "image" | "video" | "audio";

interface Question {
  id: string;
  mediaType: MediaType;
  prompt: string;
  mediaContent: string;
  options: string[];
  correctIndex: number;
  timeLimit: number;
}

const typeLabels: Record<MediaType, string> = {
  text: "Text Question",
  image: "Image Question",
  video: "Video Question",
  audio: "Audio Question",
};

function newQuestion(mediaType: MediaType): Question {
  const id = Math.random().toString(36).slice(2);
  return {
    id,
    mediaType,
    prompt: "",
    mediaContent: "",
    options: ["", "", "", ""],
    correctIndex: 0,
    timeLimit: 20,
  };
}

const answerColors = ["#e21b3c", "#1368ce", "#d89e00", "#26890c"];

const typeAccent: Record<MediaType, { bg: string; icon: string }> = {
  text: { bg: colors.blueBackground, icon: "📝" },
  image: { bg: colors.completedCardBg, icon: "🖼️" },
  video: { bg: colors.coralBackground, icon: "🎬" },
  audio: { bg: colors.inProgressCardBg, icon: "🔊" },
};

export default function CreateGamePage() {
  const router = useRouter();
  const [gameTitle, setGameTitle] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
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
    const q = newQuestion(mediaType);
    setQuestions((prev) => [...prev, q]);
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
      cover_image: coverImage,
      questions,
    });

    setSaveBusy(false);

    if (error) {
      setSaveError(error.message);
      return;
    }

    router.push("/games/teacher/library");
  }

  // Kept as-is: this is the exact style already used by the answer-options
  // inputs below, which are staying unchanged.
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

  // Theme-styled counterpart for everything else on the card (prompt, media
  // URL, time limit) so those pick up the app's Kahoot-style look.
  const fieldStyle: React.CSSProperties = {
    ...inputStyle,
    borderRadius: radius.button,
    border: `1px solid ${colors.inputBorder}`,
    background: colors.listRowBg,
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
      <div
        style={{
          width: "56px",
          height: "56px",
          borderRadius: "18px",
          background: colors.orange,
          boxShadow: solidShadow(5, colors.orangeShadow),
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: "1.7rem", color: colors.white, lineHeight: 1 }}>♪</span>
      </div>

      <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>
        Create a Game
      </h1>

      <div
        style={{
          display: "flex",
          gap: "0.75rem",
          alignItems: "flex-start",
          width: "100%",
          maxWidth: "700px",
        }}
      >
        <GameCoverPicker
          value={coverImage}
          title={gameTitle}
          teacherId={myTeacherId}
          onChange={setCoverImage}
        />

        <div style={{ display: "flex", gap: "0.5rem", flex: 1 }}>
          <input
            type="text"
            placeholder="Game title"
            value={gameTitle}
            onChange={(e) => setGameTitle(e.target.value)}
            style={{
              ...fieldStyle,
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

      {questions.length === 0 && (
        <p
          style={{
            opacity: 0.6,
            fontWeight: 700,
            fontSize: "0.9rem",
            margin: 0,
          }}
        >
          Click "+ Add Question" to add your first question
        </p>
      )}

      <div
        style={{
          width: "100%",
          maxWidth: "1000px",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        {questions.map((q, index) => (
          <div
            key={q.id}
            style={{
              width: "320px",
              background: colors.white,
              borderRadius: radius.card,
              boxShadow: solidShadow(4, colors.gamesCardShadow),
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "0.5rem 0.7rem",
                background: typeAccent[q.mediaType].bg,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  color: colors.textPrimary,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "20px",
                    height: "20px",
                    borderRadius: radius.pill,
                    background: colors.orange,
                    color: colors.white,
                    fontSize: "0.7rem",
                    flexShrink: 0,
                  }}
                >
                  {index + 1}
                </span>
                <span aria-hidden="true">{typeAccent[q.mediaType].icon}</span>
                {typeLabels[q.mediaType]}
              </span>
              <button
                onClick={() => removeQuestion(q.id)}
                style={{
                  width: "22px",
                  height: "22px",
                  borderRadius: radius.pill,
                  border: "none",
                  background: "rgba(255,255,255,0.6)",
                  color: colors.coralText,
                  cursor: "pointer",
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                padding: "0.6rem",
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
                style={{ ...fieldStyle, fontWeight: 700 }}
              />

              {q.mediaType === "text" && (
                <textarea
                  placeholder="Text shown to players (e.g. a passage or lyric)"
                  value={q.mediaContent}
                  onChange={(e) =>
                    updateQuestion(q.id, { mediaContent: e.target.value })
                  }
                  style={{ ...fieldStyle, minHeight: "60px", resize: "none" }}
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
                    style={fieldStyle}
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
                    style={fieldStyle}
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
                    style={fieldStyle}
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
                <label style={{ fontSize: "0.8rem", fontWeight: 700, opacity: 0.7 }}>
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
                  style={{ ...fieldStyle, width: "70px" }}
                />
              </div>
            </div>
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
