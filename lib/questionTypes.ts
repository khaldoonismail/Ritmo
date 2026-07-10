// Shared question model used by QuestionEditor (authoring) and
// QuestionRenderer (student-facing), independent of the lesson canvas so it
// can be reused by a future standalone Assessment feature.

export type QuestionType =
  | "multiple_choice"
  | "true_false"
  | "fill_blank"
  | "short_answer";

export type AttachmentType = "image" | "video" | "audio";

export interface QuestionData {
  questionType: QuestionType;
  prompt: string;
  // multiple_choice: any number of options, one correct.
  // true_false: options are always exactly ["True", "False"].
  options?: string[];
  correctIndex?: number;
  // fill_blank: one correct answer per "___" occurrence in `prompt`, in order.
  blanks?: string[];
  // Only meaningful for auto-gradable types (everything but short_answer).
  showCorrectAnswer?: boolean;
  attachmentType?: AttachmentType;
  attachmentUrl?: string;
}

export type QuestionAnswer =
  | { questionType: "multiple_choice" | "true_false"; selectedIndex: number | null }
  | { questionType: "fill_blank"; values: string[] }
  | { questionType: "short_answer"; text: string };

export const BLANK_MARKER = "___";

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  multiple_choice: "Multiple Choice",
  true_false: "True/False",
  fill_blank: "Fill in the Blank",
  short_answer: "Short Answer",
};

export function countBlanks(prompt: string): number {
  return prompt.split(BLANK_MARKER).length - 1;
}

export function defaultQuestionData(
  questionType: QuestionType,
  prevPrompt = ""
): QuestionData {
  switch (questionType) {
    case "multiple_choice":
      return {
        questionType,
        prompt: prevPrompt,
        options: ["", "", "", ""],
        correctIndex: 0,
        showCorrectAnswer: false,
      };
    case "true_false":
      return {
        questionType,
        prompt: prevPrompt,
        options: ["True", "False"],
        correctIndex: 0,
        showCorrectAnswer: false,
      };
    case "fill_blank":
      return {
        questionType,
        prompt: prevPrompt,
        blanks: [],
        showCorrectAnswer: false,
      };
    case "short_answer":
      return {
        questionType,
        prompt: prevPrompt,
      };
  }
}

// Older lessons store a question block as flat {text, options, correctIndex}
// fields directly on the block, with no nested `question` object at all.
// This adapts that shape into a QuestionData so old content keeps working
// without a data migration; the block self-heals into the new shape the
// next time it's saved.
export function normalizeQuestionData(block: {
  question?: QuestionData;
  text?: string;
  options?: string[];
  correctIndex?: number;
}): QuestionData {
  if (block.question) return block.question;
  return {
    questionType: "multiple_choice",
    prompt: block.text || "",
    options: block.options && block.options.length > 0 ? block.options : ["", "", "", ""],
    correctIndex: block.correctIndex ?? 0,
    showCorrectAnswer: false,
  };
}

export function emptyAnswerFor(question: QuestionData): QuestionAnswer {
  switch (question.questionType) {
    case "multiple_choice":
    case "true_false":
      return { questionType: question.questionType, selectedIndex: null };
    case "fill_blank":
      return {
        questionType: "fill_blank",
        values: new Array(question.blanks?.length ?? 0).fill(""),
      };
    case "short_answer":
      return { questionType: "short_answer", text: "" };
  }
}

// Returns true/false when auto-gradable, null for short_answer (or a
// type/answer mismatch, which shouldn't normally happen).
export function gradeQuestion(
  question: QuestionData,
  answer: QuestionAnswer
): boolean | null {
  if (
    (question.questionType === "multiple_choice" ||
      question.questionType === "true_false") &&
    (answer.questionType === "multiple_choice" || answer.questionType === "true_false")
  ) {
    if (answer.selectedIndex === null) return false;
    return answer.selectedIndex === question.correctIndex;
  }

  if (question.questionType === "fill_blank" && answer.questionType === "fill_blank") {
    const blanks = question.blanks || [];
    if (blanks.length === 0) return null;
    return blanks.every(
      (correct, i) =>
        (answer.values[i] || "").trim().toLowerCase() === correct.trim().toLowerCase()
    );
  }

  return null;
}
