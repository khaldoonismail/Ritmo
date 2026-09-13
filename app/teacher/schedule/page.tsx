"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { DAY_NAMES, formatTime } from "@/lib/classSchedule";
import { colors, radius, solidShadow } from "@/lib/theme";

interface ClassRow {
  id: string;
  name: string;
}

interface SlotRow {
  id: string;
  class_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

const AVATAR_COLORS = [
  { bg: colors.orange, shadow: colors.orangeShadow },
  { bg: colors.greenCard, shadow: colors.greenCardShadow },
  { bg: colors.blueText, shadow: colors.gamesCardShadow },
];

export default function TeacherSchedulePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [slots, setSlots] = useState<SlotRow[]>([]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/accounts/login");
        return;
      }

      const { data: classRows, error: classesError } = await supabase
        .from("classes")
        .select("id, name")
        .order("name");

      if (classesError) {
        setError(classesError.message);
        setLoading(false);
        return;
      }

      const classIds = (classRows || []).map((c) => c.id);
      setClasses(classRows || []);

      if (classIds.length === 0) {
        setSlots([]);
        setLoading(false);
        return;
      }

      const { data: slotRows, error: slotsError } = await supabase
        .from("class_schedule")
        .select("id, class_id, day_of_week, start_time, end_time")
        .in("class_id", classIds)
        .order("start_time", { ascending: true });

      if (slotsError) {
        setError(slotsError.message);
      } else {
        setSlots(slotRows || []);
      }
      setLoading(false);
    }

    load();
  }, [router]);

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", padding: "2rem", background: colors.background }}>
        <p style={{ opacity: 0.6, fontWeight: 600 }}>Loading schedule...</p>
      </main>
    );
  }

  const classNameById = new Map(classes.map((c) => [c.id, c.name]));
  const classIndexById = new Map(classes.map((c, i) => [c.id, i]));

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        gap: "1.25rem",
        background: colors.background,
        color: colors.textPrimary,
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>My Schedule</h1>
      <p style={{ fontSize: "1rem", fontWeight: 600, opacity: 0.7, margin: 0, textAlign: "center" }}>
        Every class time slot across all your classes, at a glance.
      </p>

      {error && <p style={{ color: colors.coralText, fontSize: "0.9rem", fontWeight: 600 }}>{error}</p>}

      {classes.length === 0 ? (
        <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>
          You don't have any classes yet.
        </p>
      ) : slots.length === 0 ? (
        <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center", maxWidth: "420px" }}>
          No time slots set up yet. Add one from a class page's Weekly Schedule section.
        </p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: "0.85rem",
            width: "100%",
            maxWidth: "900px",
          }}
        >
          {DAY_NAMES.map((dayName, dayIndex) => {
            const daySlots = slots
              .filter((s) => s.day_of_week === dayIndex)
              .sort((a, b) => a.start_time.localeCompare(b.start_time));

            return (
              <div
                key={dayName}
                style={{
                  borderRadius: radius.card,
                  padding: "0.9rem",
                  background: colors.white,
                  boxShadow: solidShadow(4, colors.rosterCardShadow),
                  textAlign: "left",
                  minHeight: "120px",
                }}
              >
                <div style={{ fontWeight: 800, fontSize: "0.95rem", marginBottom: "0.6rem" }}>
                  {dayName}
                </div>
                {daySlots.length === 0 ? (
                  <p style={{ opacity: 0.4, fontWeight: 600, fontSize: "0.78rem", margin: 0 }}>
                    No classes
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {daySlots.map((slot) => {
                      const avatar =
                        AVATAR_COLORS[(classIndexById.get(slot.class_id) ?? 0) % AVATAR_COLORS.length];
                      return (
                        <div
                          key={slot.id}
                          style={{
                            borderRadius: radius.iconSquare,
                            padding: "0.5rem 0.6rem",
                            background: avatar.bg,
                            boxShadow: solidShadow(2, avatar.shadow),
                            color: colors.white,
                          }}
                        >
                          <div style={{ fontWeight: 800, fontSize: "0.8rem" }}>
                            {classNameById.get(slot.class_id) ?? "Unknown class"}
                          </div>
                          <div style={{ fontSize: "0.72rem", fontWeight: 600, opacity: 0.9, direction: "ltr" }}>
                            {formatTime(slot.start_time)} – {formatTime(slot.end_time)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Link
        href="/teacher/classes"
        style={{
          fontSize: "0.9rem",
          fontWeight: 700,
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
        }}
      >
        ← Back to My Classes
      </Link>
    </main>
  );
}
