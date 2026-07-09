"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { resolveVideoSource, UNSUPPORTED_VIDEO_MESSAGE } from "@/lib/videoEmbed";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type BlockType = "text" | "question" | "image" | "video" | "audio" | "ai";

interface Block {
  id: string;
  type: BlockType;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  options?: string[];
  correctIndex?: number;
  url?: string;
  topic?: string;
  generated?: string;
}

let zCounter = 1;

function newBlock(type: BlockType, x: number, y: number): Block {
  const id = Math.random().toString(36).slice(2);
  const base = { id, type, x, y, width: 280, height: 200 };
  if (type === "question") {
    return { ...base, height: 260, text: "", options: ["", "", "", ""], correctIndex: 0 };
  }
  return { ...base, text: "", url: "", topic: "", generated: "" };
}

const typeLabels: Record<BlockType, string> = {
  text: "Text",
  question: "Question",
  image: "Image",
  video: "Video",
  audio: "Audio",
  ai: "AI Suggestion",
};

const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export default function CreateLessonPage() {
  return (
    <Suspense fallback={<main style={{ minHeight: "100vh" }} />}>
      <CreateLessonEditor />
    </Suspense>
  );
}

function CreateLessonEditor() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const lessonIdParam = searchParams.get("lessonId");

  const [lessonTitle, setLessonTitle] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zOrder, setZOrder] = useState<Record<string, number>>({});
  const [saveNotice, setSaveNotice] = useState("");
  const [dragOverImageId, setDragOverImageId] = useState<string | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, string>>({});
  const canvasRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [notOwner, setNotOwner] = useState(false);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [lessonId, setLessonId] = useState<string | null>(lessonIdParam);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Auth guard + load the teacher's own record, then (if editing) the lesson.
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

      const { data: teacherRow, error: teacherError } = await supabase
        .from("teachers")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (teacherError || !teacherRow) {
        setLoadError(teacherError?.message || "Could not load your teacher account.");
        setLoading(false);
        return;
      }
      setTeacherId(teacherRow.id);

      if (lessonIdParam) {
        const { data: lessonRow, error: lessonError } = await supabase
          .from("lessons")
          .select("id, teacher_id, title, blocks")
          .eq("id", lessonIdParam)
          .maybeSingle();

        if (lessonError || !lessonRow) {
          setLoadError("Lesson not found.");
          setLoading(false);
          return;
        }

        if (lessonRow.teacher_id !== teacherRow.id) {
          setNotOwner(true);
          setLoading(false);
          return;
        }

        setLessonTitle(lessonRow.title);
        const loadedBlocks = (lessonRow.blocks as Block[]) || [];
        setBlocks(loadedBlocks);
        setZOrder((prev) => {
          const next = { ...prev };
          for (const b of loadedBlocks) next[b.id] = zCounter++;
          return next;
        });
      }

      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonIdParam]);

  function openPublishConfirm() {
    if (!lessonTitle.trim()) {
      setSaveError("Add a lesson title before saving.");
      return;
    }
    setSaveError("");
    setShowPublishModal(true);
  }

  async function performSave(isPublic: boolean) {
    if (!teacherId) return;
    setSaving(true);
    setSaveError("");

    const supabase = createBrowserSupabaseClient();

    if (lessonId) {
      const { error } = await supabase
        .from("lessons")
        .update({ title: lessonTitle, blocks, is_public: isPublic })
        .eq("id", lessonId);

      setSaving(false);
      if (error) {
        setSaveError(error.message);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("lessons")
        .insert({
          teacher_id: teacherId,
          title: lessonTitle,
          blocks,
          is_public: isPublic,
        })
        .select("id")
        .single();

      setSaving(false);
      if (error || !data) {
        setSaveError(error?.message || "Could not save lesson.");
        return;
      }
      setLessonId(data.id);
      router.replace(`/academy/teacher/create-lesson?lessonId=${data.id}`);
    }

    setShowPublishModal(false);
    setSaveNotice("Saved!");
    setTimeout(() => setSaveNotice(""), 1500);
  }

  function addBlock(type: BlockType) {
    const x = 40 + Math.random() * 60;
    const y = 40 + Math.random() * 60;
    const block = newBlock(type, x, y);
    setBlocks((prev) => [...prev, block]);
    setZOrder((prev) => ({ ...prev, [block.id]: zCounter++ }));
    setPickerOpen(false);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function updateBlock(id: string, patch: Partial<Block>) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );
  }

  function bringToFront(id: string) {
    setZOrder((prev) => ({ ...prev, [id]: zCounter++ }));
  }

  function generateAiSuggestion(id: string, topic: string) {
    const fake = `Suggested outline for "${topic || "your topic"}": 1) Introduce the concept with a simple example. 2) Demonstrate with a short exercise. 3) Recap key points. (Review and edit before publishing to students.)`;
    updateBlock(id, { generated: fake });
  }

  function handleAudioFileUpload(id: string, file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      updateBlock(id, { url: reader.result as string });
    };
    reader.readAsDataURL(file);
  }

  function setImageError(id: string, message: string) {
    setImageErrors((prev) => ({ ...prev, [id]: message }));
  }

  function clearImageError(id: string) {
    setImageErrors((prev) => {
      if (!(id in prev)) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function validateAndSetImage(id: string, file: File) {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setImageError(id, "Only JPG, PNG, WEBP, or GIF images are supported.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setImageError(id, "Image is too large — max 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      updateBlock(id, { url: reader.result as string });
      clearImageError(id);
    };
    reader.readAsDataURL(file);
  }

  // Dragging
  function handleDragStart(e: React.MouseEvent, block: Block) {
    e.preventDefault();
    bringToFront(block.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = block.x;
    const originY = block.y;

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      updateBlock(block.id, {
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

  // Resizing
  function handleResizeStart(e: React.MouseEvent, block: Block) {
    e.preventDefault();
    e.stopPropagation();
    bringToFront(block.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const originW = block.width;
    const originH = block.height;

    function onMove(ev: MouseEvent) {
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      updateBlock(block.id, {
        width: Math.max(180, originW + dx),
        height: Math.max(140, originH + dy),
      });
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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

  if (loading) {
    return <main style={{ minHeight: "100vh" }} />;
  }

  if (loadError) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>{loadError}</h1>
        <Link href="/academy/teacher" style={{ color: "inherit", textDecoration: "underline" }}>
          ← Back to Teacher Dashboard
        </Link>
      </main>
    );
  }

  if (notOwner) {
    return (
      <main
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: "1.75rem", fontWeight: 800, margin: 0 }}>
          You don't own this lesson
        </h1>
        <p style={{ opacity: 0.7, maxWidth: "420px" }}>
          You can't edit a lesson that belongs to another teacher. Use "Copy &amp; Edit"
          from the Assign Lesson picker to make your own editable copy instead.
        </p>
        <Link href="/academy/teacher" style={{ color: "inherit", textDecoration: "underline" }}>
          ← Back to Teacher Dashboard
        </Link>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        gap: "1rem",
      }}
    >
      <h1 style={{ fontSize: "2.25rem", fontWeight: 800, margin: 0 }}>
        {lessonId ? "Edit Lesson" : "Create a Lesson"}
      </h1>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          width: "100%",
          maxWidth: "700px",
        }}
      >
        <input
          type="text"
          placeholder="Lesson title"
          value={lessonTitle}
          onChange={(e) => setLessonTitle(e.target.value)}
          style={{ ...inputStyle, fontSize: "1.1rem", fontWeight: 700, padding: "0.6rem 0.8rem" }}
        />
        <button
          onClick={openPublishConfirm}
          style={{
            fontSize: "0.95rem",
            fontWeight: 700,
            padding: "0.6rem 1.2rem",
            borderRadius: "8px",
            border: "none",
            background: "#111",
            color: "#fff",
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {saveNotice || "Save Lesson"}
        </button>
      </div>

      {saveError && (
        <p style={{ color: "#c00", fontSize: "0.85rem", margin: 0 }}>{saveError}</p>
      )}

      <div style={{ position: "relative", width: "100%", maxWidth: "700px" }}>
        <button
          onClick={() => setPickerOpen((v) => !v)}
          style={{
            fontSize: "0.95rem",
            fontWeight: 700,
            padding: "0.6rem 1rem",
            borderRadius: "8px",
            border: "1px dashed #999",
            background: "#fafafa",
            color: "#111",
            cursor: "pointer",
          }}
        >
          + Add Window
        </button>

        {pickerOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: "0.4rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.3rem",
              border: "1px solid #ddd",
              borderRadius: "8px",
              padding: "0.4rem",
              background: "#fff",
              zIndex: 9999,
            }}
          >
            {(Object.keys(typeLabels) as BlockType[]).map((t) => (
              <button
                key={t}
                onClick={() => addBlock(t)}
                style={{
                  fontSize: "0.85rem",
                  padding: "0.4rem 0.7rem",
                  borderRadius: "6px",
                  border: "none",
                  background: "#f0f0f0",
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
        ref={canvasRef}
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
        {blocks.length === 0 && (
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
            Click "+ Add Window" to place your first block
          </span>
        )}

        {blocks.map((block) => (
          <div
            key={block.id}
            onMouseDown={() => bringToFront(block.id)}
            style={{
              position: "absolute",
              left: block.x,
              top: block.y,
              width: block.width,
              height: block.height,
              zIndex: zOrder[block.id] || 1,
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
              onMouseDown={(e) => handleDragStart(e, block)}
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
                {typeLabels[block.type]}
              </span>
              <button
                onClick={() => removeBlock(block.id)}
                style={{
                  border: "none",
                  background: "none",
                  color: "#c00",
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
              {block.type === "text" && (
                <textarea
                  placeholder="Write your lesson text here..."
                  value={block.text}
                  onChange={(e) =>
                    updateBlock(block.id, { text: e.target.value })
                  }
                  style={{ ...inputStyle, flex: 1, resize: "none" }}
                />
              )}

              {block.type === "question" && (
                <>
                  <input
                    type="text"
                    placeholder="Question text"
                    value={block.text}
                    onChange={(e) =>
                      updateBlock(block.id, { text: e.target.value })
                    }
                    style={inputStyle}
                  />
                  {block.options?.map((opt, i) => (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                      }}
                    >
                      <input
                        type="radio"
                        checked={block.correctIndex === i}
                        onChange={() =>
                          updateBlock(block.id, { correctIndex: i })
                        }
                      />
                      <input
                        type="text"
                        placeholder={`Option ${i + 1}`}
                        value={opt}
                        onChange={(e) => {
                          const newOptions = [...(block.options || [])];
                          newOptions[i] = e.target.value;
                          updateBlock(block.id, { options: newOptions });
                        }}
                        style={inputStyle}
                      />
                    </div>
                  ))}
                </>
              )}

              {block.type === "image" && (
                <div
                  tabIndex={0}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    setDragOverImageId(block.id);
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverImageId(block.id);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setDragOverImageId((prev) => (prev === block.id ? null : prev));
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverImageId(null);
                    const file = e.dataTransfer.files?.[0];
                    if (file) validateAndSetImage(block.id, file);
                  }}
                  onPaste={(e) => {
                    const item = Array.from(e.clipboardData.items).find((i) =>
                      i.type.startsWith("image/")
                    );
                    const file = item?.getAsFile();
                    if (file) validateAndSetImage(block.id, file);
                  }}
                  style={{
                    flex: 1,
                    minHeight: "120px",
                    borderRadius: "8px",
                    border:
                      dragOverImageId === block.id
                        ? "2px dashed #111"
                        : "2px dashed #ccc",
                    background:
                      dragOverImageId === block.id ? "#eef5ff" : "#fafafa",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    outline: "none",
                    transition: "border-color 0.15s, background 0.15s",
                    overflow: "hidden",
                  }}
                >
                  {block.url ? (
                    <div style={{ position: "relative", width: "100%", height: "100%" }}>
                      <img
                        src={block.url}
                        alt="Preview"
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          display: "block",
                          margin: "0 auto",
                        }}
                      />
                      <button
                        onClick={() => updateBlock(block.id, { url: "" })}
                        style={{
                          position: "absolute",
                          top: "4px",
                          right: "4px",
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          border: "none",
                          background: "rgba(0,0,0,0.65)",
                          color: "#fff",
                          fontSize: "0.7rem",
                          lineHeight: 1,
                          cursor: "pointer",
                        }}
                        title="Remove image"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "0.75rem" }}>
                      <p style={{ fontSize: "0.78rem", opacity: 0.6, margin: "0 0 0.5rem" }}>
                        Drag an image here, paste (⌘+V), or click to upload
                      </p>
                      <label
                        style={{
                          display: "inline-block",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          padding: "0.4rem 0.8rem",
                          borderRadius: "6px",
                          border: "1px solid #111",
                          background: "#fff",
                          color: "#111",
                          cursor: "pointer",
                        }}
                      >
                        Upload Image
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) validateAndSetImage(block.id, file);
                            e.target.value = "";
                          }}
                          style={{ display: "none" }}
                        />
                      </label>
                      {imageErrors[block.id] && (
                        <p style={{ color: "#c00", fontSize: "0.72rem", margin: "0.4rem 0 0" }}>
                          {imageErrors[block.id]}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {block.type === "video" && (
                <>
                  <input
                    type="text"
                    placeholder="Video URL (YouTube, Google Drive, Vimeo, OneDrive/SharePoint, or direct file)"
                    value={block.url}
                    onChange={(e) =>
                      updateBlock(block.id, { url: e.target.value })
                    }
                    style={inputStyle}
                  />
                  {block.url && (() => {
                    const source = resolveVideoSource(block.url);

                    if (source.kind === "iframe") {
                      return (
                        <iframe
                          src={source.embedUrl}
                          title="Video player"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          style={{
                            width: "100%",
                            aspectRatio: "16 / 9",
                            border: "none",
                            borderRadius: "6px",
                            marginTop: "0.2rem",
                          }}
                        />
                      );
                    }

                    if (source.kind === "native") {
                      return (
                        <video
                          src={source.url}
                          controls
                          style={{ maxWidth: "100%", borderRadius: "6px", marginTop: "0.2rem" }}
                        />
                      );
                    }

                    if (source.kind === "needs-embed-link") {
                      return (
                        <p style={{ fontSize: "0.8rem", color: "#a66300", marginTop: "0.2rem" }}>
                          This looks like a {source.provider} link, but it needs to be an
                          "Embed" link. Use the Embed option when sharing from Microsoft,
                          then paste that link here instead.
                        </p>
                      );
                    }

                    return (
                      <p style={{ fontSize: "0.8rem", color: "#c00", marginTop: "0.2rem" }}>
                        {UNSUPPORTED_VIDEO_MESSAGE}
                      </p>
                    );
                  })()}
                </>
              )}

              {block.type === "audio" && (
                <>
                  <input
                    type="text"
                    placeholder="Audio URL (SoundCloud or direct MP3 link)"
                    value={block.url}
                    onChange={(e) =>
                      updateBlock(block.id, { url: e.target.value })
                    }
                    style={inputStyle}
                  />
                  <input
                    type="file"
                    accept="audio/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAudioFileUpload(block.id, file);
                    }}
                    style={{ fontSize: "0.8rem" }}
                  />
                  {block.url && (
                    <audio
                      src={block.url}
                      controls
                      style={{ width: "100%", marginTop: "0.2rem" }}
                    />
                  )}
                </>
              )}

              {block.type === "ai" && (
                <>
                  <input
                    type="text"
                    placeholder="Topic for AI"
                    value={block.topic}
                    onChange={(e) =>
                      updateBlock(block.id, { topic: e.target.value })
                    }
                    style={inputStyle}
                  />
                  <button
                    onClick={() =>
                      generateAiSuggestion(block.id, block.topic || "")
                    }
                    style={{
                      alignSelf: "flex-start",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      padding: "0.35rem 0.7rem",
                      borderRadius: "6px",
                      border: "1px solid #111",
                      background: "#fff",
                      color: "#111",
                      cursor: "pointer",
                    }}
                  >
                    Generate
                  </button>
                  {block.generated && (
                    <div
                      style={{
                        background: "#f6f6f6",
                        borderRadius: "6px",
                        padding: "0.5rem",
                        fontSize: "0.75rem",
                        lineHeight: 1.4,
                      }}
                    >
                      {block.generated}
                    </div>
                  )}
                </>
              )}
            </div>

            <div
              onMouseDown={(e) => handleResizeStart(e, block)}
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
        href="/academy/teacher"
        style={{
          fontSize: "0.9rem",
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
          marginTop: "0.5rem",
        }}
      >
        ← Back to Teacher Dashboard
      </Link>

      {showPublishModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              padding: "1.5rem",
              maxWidth: "380px",
              width: "100%",
              textAlign: "center",
            }}
          >
            <h2 style={{ fontSize: "1.2rem", fontWeight: 800, margin: "0 0 0.5rem" }}>
              Share this lesson to the public library?
            </h2>
            <p style={{ fontSize: "0.85rem", opacity: 0.7, margin: "0 0 1.25rem" }}>
              Public lessons can be assigned or copied by any teacher. You can change
              this later.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              <button
                onClick={() => performSave(true)}
                disabled={saving}
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  padding: "0.7rem 1rem",
                  borderRadius: "8px",
                  border: "none",
                  background: "#111",
                  color: "#fff",
                  cursor: saving ? "default" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                Yes, share it
              </button>
              <button
                onClick={() => performSave(false)}
                disabled={saving}
                style={{
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  padding: "0.7rem 1rem",
                  borderRadius: "8px",
                  border: "1px solid #ddd",
                  background: "#fff",
                  color: "#111",
                  cursor: saving ? "default" : "pointer",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                No, keep it private
              </button>
              <button
                onClick={() => setShowPublishModal(false)}
                disabled={saving}
                style={{
                  fontSize: "0.8rem",
                  opacity: 0.6,
                  background: "none",
                  border: "none",
                  color: "inherit",
                  textDecoration: "underline",
                  cursor: "pointer",
                  marginTop: "0.2rem",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
