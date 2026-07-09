export interface LessonOption {
  id: string;
  title: string;
}

// Static catalog of lessons that exist in the app today. Extend this list as
// more lesson pages are built under app/academy/lesson/[id].
export const AVAILABLE_LESSONS: LessonOption[] = [
  { id: "1", title: "Lesson 1" },
];

export function lessonTitle(lessonId: string): string {
  return AVAILABLE_LESSONS.find((l) => l.id === lessonId)?.title ?? `Lesson ${lessonId}`;
}
