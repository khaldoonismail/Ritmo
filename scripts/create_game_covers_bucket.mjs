// Fallback setup script: creates the public "game-covers" Storage bucket
// used by the Create Game page's cover-image uploader
// (app/games/teacher/create-game). Applying
// supabase/migrations/0011_game_covers.sql already creates this bucket via
// a plain SQL insert into storage.buckets — only run this script if that
// insert isn't permitted in your Supabase setup. Safe to re-run either way.
//
// Run locally (needs real network access to Supabase, which this project's
// automation sandbox doesn't have):
//
//   cd ~/Downloads/ritmo
//   node --env-file=.env.local scripts/create_game_covers_bucket.mjs

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Run with --env-file=.env.local from the project root."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = "game-covers";

async function main() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;

  if (buckets.find((b) => b.name === BUCKET)) {
    console.log(`Bucket already exists: ${BUCKET}`);
    return;
  }

  const { error: createErr } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: "2MB",
    allowedMimeTypes: ["image/jpeg", "image/png"],
  });
  if (createErr) throw createErr;
  console.log(`Created bucket: ${BUCKET}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
