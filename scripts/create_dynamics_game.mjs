// One-off setup script: uploads dynamics symbol images
// (scripts/dynamics_images/*.jpg) to a public Supabase Storage bucket and
// creates a "Musical Dynamics" game (10 image questions, one per dynamic
// marking) owned by the demo teacher account.
//
// Sources: see scripts/dynamics_images/ATTRIBUTION.md.
//
// Run locally (needs real network access to Supabase, which this project's
// automation sandbox doesn't have):
//
//   cd ~/Downloads/ritmo
//   node --env-file=.env.local scripts/create_dynamics_game.mjs
//
// Safe to re-run: uploads use upsert, and if a "Musical Dynamics" game
// already exists for the demo teacher its questions are updated in place
// rather than creating a duplicate.

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const BUCKET = "dynamics-images";
const IMAGE_DIR = path.join(__dirname, "dynamics_images");

const LABELS = {
  ppp: "Pianississimo (ppp)",
  pp: "Pianissimo (pp)",
  p: "Piano (p)",
  mp: "Mezzo-piano (mp)",
  mf: "Mezzo-forte (mf)",
  f: "Forte (f)",
  ff: "Fortissimo (ff)",
  fff: "Fortississimo (fff)",
  crescendo: "Crescendo",
  decrescendo: "Decrescendo",
};

async function ensureBucket() {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  if (!buckets.find((b) => b.name === BUCKET)) {
    const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
    if (createErr) throw createErr;
    console.log("Created bucket", BUCKET);
  } else {
    console.log("Bucket already exists:", BUCKET);
  }
}

async function uploadAll() {
  const files = fs.readdirSync(IMAGE_DIR).filter((f) => f.endsWith(".jpg"));
  const urls = {};
  for (const f of files) {
    const buf = fs.readFileSync(path.join(IMAGE_DIR, f));
    const storagePath = `dynamics/${f}`;
    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buf, {
      contentType: "image/jpeg",
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
    const name = f.replace(".jpg", "");
    urls[name] = data.publicUrl;
    console.log("Uploaded", name, "->", data.publicUrl);
  }
  return urls;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function main() {
  await ensureBucket();
  const urls = await uploadAll();

  const { data: teacher, error: tErr } = await supabase
    .from("teachers")
    .select("id")
    .eq("email", "teacher.demo@ritmo.test")
    .maybeSingle();
  if (tErr) throw tErr;
  if (!teacher) {
    console.error("Demo teacher not found. Run `npm run seed` first.");
    process.exit(1);
  }

  const symbols = Object.keys(urls);
  const questions = symbols.map((sym, idx) => {
    const distractors = shuffle(symbols.filter((s) => s !== sym)).slice(0, 3);
    const optionKeys = shuffle([sym, ...distractors]);
    const options = optionKeys.map((k) => LABELS[k]);
    const correctIndex = optionKeys.indexOf(sym);
    return {
      id: Math.random().toString(36).slice(2),
      mediaType: "image",
      x: 40 + (idx % 5) * 90,
      y: 40 + Math.floor(idx / 5) * 90,
      width: 320,
      height: 420,
      prompt: "What is this dynamic marking called?",
      mediaContent: urls[sym],
      options,
      correctIndex,
      timeLimit: 20,
    };
  });

  const { data: existing, error: findErr } = await supabase
    .from("games")
    .select("id")
    .eq("teacher_id", teacher.id)
    .eq("title", "Musical Dynamics")
    .maybeSingle();
  if (findErr) throw findErr;

  if (existing) {
    const { data: game, error: uErr } = await supabase
      .from("games")
      .update({ questions, is_public: true })
      .eq("id", existing.id)
      .select("id, title")
      .single();
    if (uErr) throw uErr;
    console.log("Updated existing game:", game);
  } else {
    const { data: game, error: gErr } = await supabase
      .from("games")
      .insert({
        teacher_id: teacher.id,
        title: "Musical Dynamics",
        questions,
        is_public: true,
      })
      .select("id, title")
      .single();
    if (gErr) throw gErr;
    console.log("Created game:", game);
  }
  console.log(`${questions.length} questions saved. Open My Games as teacher.demo@ritmo.test to see it.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
