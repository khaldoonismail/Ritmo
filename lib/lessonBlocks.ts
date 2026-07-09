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
  // Canvas position/size — only meaningful in the create-lesson editor.
  // Optional because read-only consumers (e.g. the student LessonView, or
  // statically-authored content) don't have or need canvas coordinates.
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  options?: string[];
  correctIndex?: number;
  url?: string;
  topic?: string;
  generated?: string;
}
