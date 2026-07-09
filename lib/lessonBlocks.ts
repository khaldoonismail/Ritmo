// Canonical shape for a lesson block, shared between the teacher's
// create-lesson canvas editor and the student-facing lesson viewer. This is
// exactly what gets persisted into lessons.blocks (jsonb) in Supabase.

export type LessonBlockType =
  | "text"
  | "question"
  | "image"
  | "video"
  | "audio"
  | "ai";

export interface LessonBlockData {
  id: string;
  type: LessonBlockType;
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
