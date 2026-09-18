import TeacherSidebar from "./TeacherSidebar";
import BackButton from "./BackButton";

// Shared shell used by every teacher-facing area (app/academy/teacher,
// app/teacher, app/games/teacher each mount this via their own layout.tsx,
// since those are separate top-level route segments in the App Router and
// can't share a single layout file). Not used by app/games/play/[id] —
// that's a full-bleed game-presentation screen, not a dashboard page.
//
// BackButton renders here (once) rather than per-page, so every wrapped
// page gets it above its own content for free — it hides itself on the
// homepage via its own pathname check.
export default function TeacherShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="teacher-shell">
      <TeacherSidebar />
      <div className="teacher-sidebar-content">
        <div className="teacher-back-bar">
          <BackButton />
        </div>
        {children}
      </div>
    </div>
  );
}
