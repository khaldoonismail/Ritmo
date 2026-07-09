// Static lesson content, keyed by the same lesson_id used in AVAILABLE_LESSONS
// (lib/lessons.ts) and stored on assignments.lesson_id. There is no lessons
// table yet, so this stands in for one until real authored content is
// persisted (e.g. from the create-lesson editor).

export type LessonBlockType = "text" | "question" | "image" | "video";

export interface LessonBlock {
  id: string;
  type: LessonBlockType;
  text?: string;
  options?: string[];
  correctIndex?: number;
  url?: string;
}

export interface LessonContent {
  id: string;
  title: string;
  blocks: LessonBlock[];
}

export const LESSON_CONTENT: Record<string, LessonContent> = {
  "1": {
    id: "1",
    title: "Lesson 1",
    blocks: [
      {
        id: "intro",
        type: "text",
        text: "Welcome to Lesson 1! Today we'll learn to recognize basic note durations and how they fit together in a bar of music.",
      },
      {
        id: "sheet",
        type: "image",
        url: "https://placehold.co/600x260?text=Sheet+Music",
      },
      {
        id: "q1",
        type: "question",
        text: "Which note usually lasts the longest?",
        options: ["Whole note", "Half note", "Quarter note", "Eighth note"],
        correctIndex: 0,
      },
      {
        id: "q2",
        type: "question",
        text: "How many quarter notes fit in one whole note?",
        options: ["2", "3", "4", "8"],
        correctIndex: 2,
      },
    ],
  },
};

export function getLessonContent(lessonId: string): LessonContent | null {
  return LESSON_CONTENT[lessonId] ?? null;
}
