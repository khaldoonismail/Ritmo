// One-off setup script: uploads real orchestra instrument recordings
// (scripts/orchestra_audio/*.mp3, ~10s each) and real instrument photos
// (scripts/orchestra_images/*.jpg) to public Supabase Storage buckets and
// creates an "Instrument Recognition" game (23 questions, one per
// instrument, each carrying both an audio clip and a photo) owned by the
// demo teacher account. The play page lets the host choose whether each
// round is recognised by sound, photo, or both.
//
// Sources: see scripts/orchestra_audio/ATTRIBUTION.md (audio, mostly
// University of Iowa / Freesound.org) and
// scripts/orchestra_images/ATTRIBUTION.md (photos, Wikimedia Commons).
//
// Run locally (needs real network access to Supabase, which this project's
// automation sandbox doesn't have):
//
//   cd ~/Downloads/ritmo
//   node --env-file=.env.local scripts/create_instrument_game.mjs
//
// Safe to re-run: uploads use upsert, and if an "Instrument Recognition"
// game already exists for the demo teacher its questions are updated in
// place rather than creating a duplicate.

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

const AUDIO_BUCKET = "orchestra-audio";
const AUDIO_DIR = path.join(__dirname, "orchestra_audio");
const IMAGE_BUCKET = "orchestra-images";
const IMAGE_DIR = path.join(__dirname, "orchestra_images");

const LABELS = {
  violin: "Violin",
  viola: "Viola",
  cello: "Cello",
  double_bass: "Double Bass",
  harp: "Harp",
  piano: "Piano",
  piccolo: "Piccolo",
  flute: "Flute",
  oboe: "Oboe",
  clarinet: "Clarinet",
  bassoon: "Bassoon",
  trumpet: "Trumpet",
  french_horn: "French Horn",
  trombone: "Trombone",
  tuba: "Tuba",
  timpani: "Timpani",
  bass_drum: "Bass Drum",
  snare_drum: "Snare Drum",
  cymbal: "Cymbal",
  classical_guitar: "Classical Guitar",
  acoustic_guitar: "Acoustic Guitar",
  bass_guitar: "Bass Guitar",
  electric_guitar: "Electric Guitar",
};

async function ensureBucket(bucket) {
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) throw error;
  if (!buckets.find((b) => b.name === bucket)) {
    const { error: createErr } = await supabase.storage.createBucket(bucket, { public: true });
    if (createErr) throw createErr;
    console.log("Created bucket", bucket);
  } else {
    console.log("Bucket already exists:", bucket);
  }
}

async function uploadAll(bucket, dir, ext, contentType) {
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(ext));
  const urls = {};
  for (const f of files) {
    const buf = fs.readFileSync(path.join(dir, f));
    const storagePath = `instruments/${f}`;
    const { error } = await supabase.storage.from(bucket).upload(storagePath, buf, {
      contentType,
      upsert: true,
    });
    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
    const name = f.replace(ext, "");
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
  await ensureBucket(AUDIO_BUCKET);
  const audioUrls = await uploadAll(AUDIO_BUCKET, AUDIO_DIR, ".mp3", "audio/mpeg");

  await ensureBucket(IMAGE_BUCKET);
  const imageUrls = await uploadAll(IMAGE_BUCKET, IMAGE_DIR, ".jpg", "image/jpeg");

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

  const instruments = Object.keys(audioUrls);
  const questions = instruments.map((instr, idx) => {
    const distractors = shuffle(instruments.filter((i) => i !== instr)).slice(0, 3);
    const optionKeys = shuffle([instr, ...distractors]);
    const options = optionKeys.map((k) => LABELS[k]);
    const correctIndex = optionKeys.indexOf(instr);
    return {
      id: Math.random().toString(36).slice(2),
      mediaType: "audio",
      x: 40 + (idx % 5) * 90,
      y: 40 + Math.floor(idx / 5) * 90,
      width: 320,
      height: 420,
      prompt: "Which instrument is this?",
      mediaContent: audioUrls[instr],
      imageContent: imageUrls[instr],
      options,
      correctIndex,
      timeLimit: 30,
    };
  });

  const { data: existing, error: findErr } = await supabase
    .from("games")
    .select("id")
    .eq("teacher_id", teacher.id)
    .eq("title", "Instrument Recognition")
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
        title: "Instrument Recognition",
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
