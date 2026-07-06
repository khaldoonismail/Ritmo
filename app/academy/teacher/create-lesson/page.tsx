"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type BlockType = "text" | "question" | "image" | "video" | "ai";

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
  ai: "AI Suggestion",
};

export default function CreateLessonPage() {
  const [lessonTitle, setLessonTitle] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zOrder, setZOrder] = useState<Record<string, number>>({});
  const canvasRef = useRef<HTMLDivElement>(null);

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
      }}
    >
      <h1 style={{ fontSize: "2.25rem", fontWeight: 800, margin: 0 }}>
        Create a Lesson
      </h1>

      <div style={{ width: "100%", maxWidth: "700px" }}>
        <input
          type="text"
          placeholder="Lesson title"
          value={lessonTitle}
          onChange={(e) => setLessonTitle(e.target.value)}
          style={{ ...inputStyle, fontSize: "1.1rem", fontWeight: 700, padding: "0.6rem 0.8rem" }}
        />
      </div>

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
                <>
                  <input
                    type="text"
                    placeholder="Image URL"
                    value={block.url}
                    onChange={(e) =>
                      updateBlock(block.id, { url: e.target.value })
                    }
                    style={inputStyle}
                  />
                  {block.url && (
                    <img
                      src={block.url}
                      alt="Preview"
                      style={{
                        maxWidth: "100%",
                        borderRadius: "6px",
                        marginTop: "0.2rem",
                      }}
                    />
                  )}
                </>
              )}

              {block.type === "video" && (
                <input
                  type="text"
                  placeholder="Video URL (e.g. YouTube link)"
                  value={block.url}
                  onChange={(e) =>
                    updateBlock(block.id, { url: e.target.value })
                  }
                  style={inputStyle}
                />
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
    </main>
  );
}
