"use client";

import Link from "next/link";
import type { LessonBlockData as LessonBlock } from "@/lib/lessonBlocks";
import { resolveVideoSource, UNSUPPORTED_VIDEO_MESSAGE } from "@/lib/videoEmbed";
import { normalizeQuestionData } from "@/lib/questionTypes";
import QuestionRenderer from "@/components/QuestionRenderer";
import { colors, radius, solidShadow } from "@/lib/theme";

// Renders each block type the same way app/academy/teacher/create-lesson's
// canvas editor does (text passage, image preview, video player, question
// with options), just as a static read-only reading flow instead of
// draggable/resizable authoring windows.

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
        background: colors.background,
        color: colors.textPrimary,
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>
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
              borderRadius: radius.card,
              padding: "1.1rem",
              background: colors.white,
              boxShadow: solidShadow(4, colors.rosterCardShadow),
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
                  <p style={{ fontSize: "0.85rem", color: colors.classesText, fontWeight: 600 }}>
                    This video link isn't playable yet (needs a {source.provider} Embed
                    link).
                  </p>
                );
              }

              return (
                <p style={{ fontSize: "0.85rem", color: colors.coralText, fontWeight: 600 }}>
                  {UNSUPPORTED_VIDEO_MESSAGE}
                </p>
              );
            })()}

            {block.type === "audio" && block.url && (
              <audio src={block.url} controls style={{ width: "100%" }} />
            )}

            {block.type === "question" && (
              <QuestionRenderer question={normalizeQuestionData(block)} />
            )}
          </div>
        ))}
      </div>

      <Link
        href={backHref}
        style={{
          fontSize: "0.9rem",
          fontWeight: 700,
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
