"use client";

import { useState } from "react";
import Link from "next/link";
import type { LessonBlockData as LessonBlock } from "@/lib/lessonBlocks";
import { resolveVideoSource, UNSUPPORTED_VIDEO_MESSAGE } from "@/lib/videoEmbed";

// Renders each block type the same way app/academy/teacher/create-lesson's
// canvas editor does (text passage, image preview, video player, question
// with options), just as a static read-only reading flow instead of
// draggable/resizable authoring windows — and lets the student pick an
// answer to get immediate right/wrong feedback.

function QuestionBlock({ block }: { block: LessonBlock }) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div>
      <p style={{ fontWeight: 700, marginBottom: "0.6rem" }}>{block.text}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        {block.options?.map((opt, i) => {
          const isSelected = selected === i;
          const isCorrect = block.correctIndex === i;
          const showResult = selected !== null;
          let background = "#f5f5f5";
          if (showResult && isCorrect) background = "#d7f5d7";
          else if (showResult && isSelected && !isCorrect) background = "#fbdada";

          return (
            <button
              key={i}
              onClick={() => setSelected(i)}
              disabled={showResult}
              style={{
                textAlign: "left",
                fontSize: "0.95rem",
                padding: "0.6rem 0.9rem",
                borderRadius: "8px",
                border: "1px solid #ddd",
                background,
                cursor: showResult ? "default" : "pointer",
              }}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function LessonView({
  title,
  blocks,
  backHref,
}: {
  title: string;
  blocks: LessonBlock[];
  backHref: string;
}) {
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
        {title}
      </h1>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          width: "100%",
          maxWidth: "700px",
        }}
      >
        {blocks.map((block) => (
          <div
            key={block.id}
            style={{
              border: "1px solid #ddd",
              borderRadius: "10px",
              padding: "1.1rem",
              background: "#fff",
              textAlign: "left",
            }}
          >
            {block.type === "text" && (
              <p style={{ lineHeight: 1.6 }}>{block.text}</p>
            )}

            {block.type === "image" && block.url && (
              <img
                src={block.url}
                alt=""
                style={{ maxWidth: "100%", borderRadius: "6px" }}
              />
            )}

            {block.type === "video" && block.url && (() => {
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
                    }}
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
                  <p style={{ fontSize: "0.85rem", color: "#a66300" }}>
                    This video link isn't playable yet (needs a {source.provider} Embed
                    link).
                  </p>
                );
              }

              return (
                <p style={{ fontSize: "0.85rem", color: "#c00" }}>
                  {UNSUPPORTED_VIDEO_MESSAGE}
                </p>
              );
            })()}

            {block.type === "audio" && block.url && (
              <audio src={block.url} controls style={{ width: "100%" }} />
            )}

            {block.type === "question" && <QuestionBlock block={block} />}
          </div>
        ))}
      </div>

      <Link
        href={backHref}
        style={{
          fontSize: "0.9rem",
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
          marginTop: "0.5rem",
        }}
      >
        ← Back
      </Link>
    </main>
  );
}
