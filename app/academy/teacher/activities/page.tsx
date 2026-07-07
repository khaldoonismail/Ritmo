"use client";

import { useState } from "react";
import Link from "next/link";

type ActivityType = "piano" | "rhythm" | "custom";

interface ABlock {
  id: string;
  type: ActivityType;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  description: string;
}

let zCounter = 1;

const typeLabels: Record<ActivityType, string> = {
  piano: "Piano Exercise",
  rhythm: "Rhythm Exercise",
  custom: "Custom Activity",
};

function newActivity(type: ActivityType, x: number, y: number): ABlock {
  const id = Math.random().toString(36).slice(2);
  return { id, type, x, y, width: 280, height: 220, title: "", description: "" };
}

export default function ActivitiesPage() {
  const [blocks, setBlocks] = useState<ABlock[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [zOrder, setZOrder] = useState<Record<string, number>>({});

  function addActivity(type: ActivityType) {
    const x = 40 + Math.random() * 60;
    const y = 40 + Math.random() * 60;
    const block = newActivity(type, x, y);
    setBlocks((prev) => [...prev, block]);
    setZOrder((prev) => ({ ...prev, [block.id]: zCounter++ }));
    setPickerOpen(false);
  }

  function removeBlock(id: string) {
    setBlocks((prev) => prev.filter((b) => b.id !== id));
  }

  function updateBlock(id: string, patch: Partial<ABlock>) {
    setBlocks((prev) =>
      prev.map((b) => (b.id === id ? { ...b, ...patch } : b))
    );
  }

  function bringToFront(id: string) {
    setZOrder((prev) => ({ ...prev, [id]: zCounter++ }));
  }

  function handleDragStart(e: React.MouseEvent, block: ABlock) {
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

  function handleResizeStart(e: React.MouseEvent, block: ABlock) {
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
        width: Math.max(200, originW + dx),
        height: Math.max(160, originH + dy),
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
        Activities Library
      </h1>

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
          + Add Activity
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
            {(Object.keys(typeLabels) as ActivityType[]).map((t) => (
              <button
                key={t}
                onClick={() => addActivity(t)}
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
            Click "+ Add Activity" to place your first activity
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
              <input
                type="text"
                placeholder="Activity title"
                value={block.title}
                onChange={(e) =>
                  updateBlock(block.id, { title: e.target.value })
                }
                style={inputStyle}
              />
              <textarea
                placeholder="Description"
                value={block.description}
                onChange={(e) =>
                  updateBlock(block.id, { description: e.target.value })
                }
                style={{ ...inputStyle, flex: 1, resize: "none" }}
              />
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
                background: "linear-gradient(135deg, transparent 50%, #bbb 50%)",
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
