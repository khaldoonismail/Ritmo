"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

// Thin wrapper around Supabase Realtime's postgres_changes, used by Team
// Battle's host and student live views (the only realtime consumers in the
// app — see supabase/migrations/0020_team_battle.sql for the publication
// changes this depends on). Returns an unsubscribe function for cleanup.
export function subscribeToTable(
  supabase: SupabaseClient,
  options: {
    table: string;
    filter: string;
    onChange: () => void;
  }
): () => void {
  const channel = supabase
    .channel(`${options.table}:${options.filter}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: options.table, filter: options.filter },
      options.onChange
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
