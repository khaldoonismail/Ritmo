"use client";

import { useState } from "react";
import { QuestionData, gradeQuestion, BLANK_MARKER } from "@/lib/questionTypes";
import { resolveVideoSource, UNSUPPORTED_VIDEO_MESSAGE } from "@/lib/videoEmbed";

const submitButtonStyle: React.CSSProperties = {
  fontSize: "0.85rem",
  fontWeight: 700,
  padding: "0.45rem 0.9rem",
  borderRadius: "8px",
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};

function Attachment({ question }: { question: QuestionData }) {
  if (!question.attachmentType || !question.attachmentUrl) return null;

  if (question.attachmentType === "image") {
    return (
      <img
        src={question.attachmentUrl}
        alt=""
        style={{ maxWidth: "100%", borderRadius: "6px", marginBottom: "0.6rem" }}
      />
    );
  }

  if (question.attachmentType === "audio") {
    return (
      <audio
        src={question.attachmentUrl}
        controls
        style={{ width: "100%", marginBottom: "0.6rem" }}
      />
    );
  }

  const source = resolveVideoSource(question.attachmentUrl);
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
          marginBottom: "0.6rem",
        }}
      />
    );
  }
  if (source.kind === "native") {
    return (
      <video
        src={source.url}
        controls
        style={{ maxWidth: "100%", borderRadius: "6px", marginBottom: "0.6rem" }}
      />
    );
  }
  if (source.kind === "needs-embed-link") {
    return (
      <p style={{ fontSize: "0.85rem", color: "#a66300" }}>
        Video link needs a {source.provider} Embed link.
      </p>
    );
  }
  return <p style={{ fontSize: "0.85rem", color: "#c00" }}>{UNSUPPORTED_VIDEO_MESSAGE}</p>;
}

function ChoiceAnswer({ question }: { question: QuestionData }) {
  const [selected, setSelected] = useState<number | null>(null);
  const submitted = selected !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
      {(question.options || []).map((opt, i) => {
        const isSelected = selected === i;
        const isCorrectOption = question.correctIndex === i;
        let background = "#f5f5f5";
        if (submitted && question.showCorrectAnswer) {
          if (isCorrectOption) background = "#d7f5d7";
          else if (isSelected) background = "#fbdada";
        } else if (submitted && isSelected) {
          background = "#e5e5e5";
        }
        return (
          <button
            key={i}
            onClick={() => setSelected(i)}
            disabled={submitted}
            style={{
              textAlign: "left",
              fontSize: "0.95rem",
              padding: "0.6rem 0.9rem",
              borderRadius: "8px",
              border: "1px solid #ddd",
              background,
              cursor: submitted ? "default" : "pointer",
            }}
          >
            {opt}
          </button>
        );
      })}
      {submitted && question.showCorrectAnswer && (
        <p
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            color: selected === question.correctIndex ? "#0a0" : "#c00",
            margin: "0.2rem 0 0",
          }}
        >
          {selected === question.correctIndex ? "Correct!" : "Incorrect."}
        </p>
      )}
    </div>
  );
}

function FillBlankAnswer({ question }: { question: QuestionData }) {
  const blankCount = question.blanks?.length ?? 0;
  const [values, setValues] = useState<string[]>(new Array(blankCount).fill(""));
  const [submitted, setSubmitted] = useState(false);

  const segments = question.prompt.split(BLANK_MARKER);
  const correct = submitted
    ? gradeQuestion(question, { questionType: "fill_blank", values })
    : null;

  return (
    <div>
      <p style={{ fontWeight: 700, lineHeight: 2, marginBottom: "0.6rem" }}>
        {segments.map((seg, i) => (
          <span key={i}>
            {seg}
            {i < segments.length - 1 && (
              <input
                type="text"
                value={values[i] || ""}
                disabled={submitted}
                onChange={(e) => {
                  const next = [...values];
                  next[i] = e.target.value;
                  setValues(next);
                }}
                style={{
                  display: "inline-block",
                  width: "130px",
                  margin: "0 0.3rem",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  border: "1px solid #ccc",
                  direction: "ltr",
                  textAlign: "left",
                  fontFamily: "inherit",
                  fontWeight: 400,
                  background: !submitted
                    ? "#fff"
                    : question.showCorrectAnswer
                    ? (values[i] || "").trim().toLowerCase() ===
                      (question.blanks?.[i] || "").trim().toLowerCase()
                      ? "#d7f5d7"
                      : "#fbdada"
                    : "#f5f5f5",
                }}
              />
            )}
          </span>
        ))}
      </p>
      {!submitted && (
        <button onClick={() => setSubmitted(true)} style={submitButtonStyle}>
          Submit
        </button>
      )}
      {submitted && (
        <p
          style={{
            fontSize: "0.8rem",
            fontWeight: 700,
            color: question.showCorrectAnswer ? (correct ? "#0a0" : "#c00") : "#111",
            opacity: question.showCorrectAnswer ? 1 : 0.6,
            margin: 0,
          }}
        >
          {question.showCorrectAnswer
            ? correct
              ? "Correct!"
              : "Not quite."
            : "Answer submitted."}
        </p>
      )}
    </div>
  );
}

function ShortAnswerAnswer() {
  const [text, setText] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <div>
      <textarea
        value={text}
        disabled={submitted}
        onChange={(e) => setText(e.target.value)}
        placeholder="Type your answer..."
        style={{
          width: "100%",
          minHeight: "70px",
          padding: "0.5rem 0.6rem",
          borderRadius: "6px",
          border: "1px solid #ddd",
          outline: "none",
          direction: "ltr",
          textAlign: "left",
          fontFamily: "inherit",
          resize: "vertical",
        }}
      />
      {!submitted && (
        <button
          onClick={() => setSubmitted(true)}
          style={{ ...submitButtonStyle, marginTop: "0.4rem" }}
        >
          Submit
        </button>
      )}
      {submitted && (
        <p style={{ fontSize: "0.8rem", opacity: 0.6, marginTop: "0.4rem" }}>
          Answer submitted.
        </p>
      )}
    </div>
  );
}

// Self-contained student-facing UI for one question: shows the optional
// attachment above the prompt, collects an answer appropriate to the
// question type, and auto-grades everything except short_answer.
export default function QuestionRenderer({ question }: { question: QuestionData }) {
  return (
    <div>
      <Attachment question={question} />

      {question.questionType !== "fill_blank" && (
        <p style={{ fontWeight: 700, marginBottom: "0.6rem" }}>{question.prompt}</p>
      )}

      {(question.questionType === "multiple_choice" || question.questionType === "true_false") && (
        <ChoiceAnswer question={question} />
      )}
      {question.questionType === "fill_blank" && <FillBlankAnswer question={question} />}
      {question.questionType === "short_answer" && <ShortAnswerAnswer />}
    </div>
  );
}
