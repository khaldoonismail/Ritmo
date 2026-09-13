"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { forkGame } from "@/lib/forkGame";
import { resolveCoverDisplay } from "@/lib/gameCover";
import { gameTagGallery, tagLabel } from "@/lib/gameTags";
import { colors, radius, solidShadow } from "@/lib/theme";

interface MyGame {
  id: string;
  title: string;
  cover_image: string | null;
  tags: string[] | null;
  questions: unknown[];
  is_public: boolean;
  usage_count: number;
}

interface CommunityGame {
  id: string;
  title: string;
  cover_image: string | null;
  tags: string[] | null;
  questions: unknown[];
  usage_count: number;
  teachers: { name: string } | { name: string }[] | null;
}

// avg/count/my-own-rating for one game, keyed by game id.
interface RatingSummary {
  average: number;
  count: number;
  mine: number | null;
}

function TagChips({ tags }: { tags: string[] | null }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginTop: "0.25rem" }}>
      {tags.map((t) => (
        <span
          key={t}
          style={{
            fontSize: "0.68rem",
            fontWeight: 700,
            padding: "0.15rem 0.5rem",
            borderRadius: radius.pill,
            background: colors.blueBackground,
            color: colors.blueText,
          }}
        >
          {tagLabel(t)}
        </span>
      ))}
    </div>
  );
}

// Read-only average (used everywhere) with an optional interactive layer —
// clicking a star calls onRate, which is omitted for a teacher's own games
// since you can't rate yourself.
function StarRating({
  summary,
  onRate,
  busy,
}: {
  summary: RatingSummary | undefined;
  onRate?: (rating: number) => void;
  busy?: boolean;
}) {
  const average = summary?.average ?? 0;
  const count = summary?.count ?? 0;
  const mine = summary?.mine ?? 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.15rem" }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = onRate ? n <= mine : n <= Math.round(average);
        return (
          <span
            key={n}
            role={onRate ? "button" : undefined}
            aria-label={onRate ? `Rate ${n} star${n === 1 ? "" : "s"}` : undefined}
            onClick={onRate && !busy ? () => onRate(n) : undefined}
            style={{
              fontSize: "0.85rem",
              lineHeight: 1,
              cursor: onRate && !busy ? "pointer" : "default",
              color: filled ? colors.orange : colors.neutralGray,
              opacity: busy ? 0.5 : 1,
            }}
          >
            ★
          </span>
        );
      })}
      <span style={{ fontSize: "0.72rem", fontWeight: 700, opacity: 0.6, marginLeft: "0.2rem" }}>
        {count > 0 ? `${average.toFixed(1)} (${count})` : onRate ? "Rate this" : "No ratings yet"}
      </span>
    </div>
  );
}

function ownerNameOf(row: CommunityGame): string | null {
  if (Array.isArray(row.teachers)) return row.teachers[0]?.name ?? null;
  return row.teachers?.name ?? null;
}

// Same 400x300 cover a game was given on the Create Game page (an uploaded
// image, a picked icon, or the title-hash fallback), shrunk to a row-sized
// thumbnail so the list actually reflects what was chosen.
function GameCoverThumb({ title, coverImage }: { title: string; coverImage: string | null }) {
  const display = resolveCoverDisplay(coverImage, title);
  return (
    <div
      style={{
        width: "40px",
        height: "40px",
        borderRadius: radius.iconSquare,
        flexShrink: 0,
        overflow: "hidden",
        background: display.kind === "icon" ? display.bg : colors.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {display.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={display.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <span style={{ fontSize: "1.2rem", lineHeight: 1 }} aria-hidden="true">
          {display.emoji}
        </span>
      )}
    </div>
  );
}

export default function GamesLibraryPage() {
  const router = useRouter();
  const [myTeacherId, setMyTeacherId] = useState<string | null>(null);
  const [myGames, setMyGames] = useState<MyGame[] | null>(null);
  const [communityGames, setCommunityGames] = useState<CommunityGame[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [copyError, setCopyError] = useState("");
  const [copyBusyId, setCopyBusyId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState("");
  const [publishBusyId, setPublishBusyId] = useState<string | null>(null);
  const [forkCounts, setForkCounts] = useState<Record<string, number>>({});
  const [ratings, setRatings] = useState<Record<string, RatingSummary>>({});
  const [rateBusyId, setRateBusyId] = useState<string | null>(null);
  const [rateError, setRateError] = useState("");
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

      const { data: teacherRow } = await supabase
        .from("teachers")
        .select("id")
        .eq("auth_user_id", session.user.id)
        .maybeSingle();

      if (!teacherRow) {
        setLoadError("Could not load your teacher account.");
        return;
      }
      setMyTeacherId(teacherRow.id);

      const { data: mine, error: mineError } = await supabase
        .from("games")
        .select("id, title, cover_image, tags, questions, is_public, usage_count")
        .eq("teacher_id", teacherRow.id)
        .order("created_at", { ascending: false });

      if (mineError) {
        setLoadError(mineError.message);
      } else {
        setMyGames(mine || []);
      }

      const { data: community, error: communityError } = await supabase
        .from("games")
        .select("id, title, cover_image, tags, questions, usage_count, teachers(name)")
        .eq("is_public", true)
        .neq("teacher_id", teacherRow.id)
        .order("created_at", { ascending: false });

      if (communityError) {
        setLoadError(communityError.message);
      } else {
        setCommunityGames((community as unknown as CommunityGame[]) || []);
      }

      const allIds = [
        ...(mine || []).map((g) => g.id),
        ...((community as unknown as CommunityGame[]) || []).map((g) => g.id),
      ];

      if (allIds.length > 0) {
        const { data: forkRows } = await supabase.rpc("game_fork_counts", { game_ids: allIds });
        if (forkRows) {
          const map: Record<string, number> = {};
          for (const row of forkRows as { game_id: string; fork_count: number }[]) {
            map[row.game_id] = row.fork_count;
          }
          setForkCounts(map);
        }

        const { data: ratingRows } = await supabase
          .from("game_ratings")
          .select("game_id, teacher_id, rating")
          .in("game_id", allIds);

        if (ratingRows) {
          const byGame: Record<string, { sum: number; count: number; mine: number | null }> = {};
          for (const row of ratingRows as { game_id: string; teacher_id: string; rating: number }[]) {
            const entry = byGame[row.game_id] || { sum: 0, count: 0, mine: null };
            entry.sum += row.rating;
            entry.count += 1;
            if (row.teacher_id === teacherRow.id) entry.mine = row.rating;
            byGame[row.game_id] = entry;
          }
          const summaries: Record<string, RatingSummary> = {};
          for (const [gameId, entry] of Object.entries(byGame)) {
            summaries[gameId] = {
              average: entry.count > 0 ? entry.sum / entry.count : 0,
              count: entry.count,
              mine: entry.mine,
            };
          }
          setRatings(summaries);
        }
      }
    }

    load();
  }, [router]);

  async function rateGame(gameId: string, rating: number) {
    if (!myTeacherId) return;
    setRateError("");
    setRateBusyId(gameId);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from("game_ratings")
      .upsert(
        { game_id: gameId, teacher_id: myTeacherId, rating, updated_at: new Date().toISOString() },
        { onConflict: "game_id,teacher_id" }
      );

    setRateBusyId(null);

    if (error) {
      setRateError(error.message);
      return;
    }

    setRatings((prev) => {
      const existing = prev[gameId];
      const prevMine = existing?.mine ?? null;
      const sum = (existing?.average ?? 0) * (existing?.count ?? 0);
      const hadRatingBefore = prevMine !== null;
      const newCount = hadRatingBefore ? (existing?.count ?? 0) : (existing?.count ?? 0) + 1;
      const newSum = hadRatingBefore ? sum - (prevMine ?? 0) + rating : sum + rating;
      return {
        ...prev,
        [gameId]: {
          average: newCount > 0 ? newSum / newCount : 0,
          count: newCount,
          mine: rating,
        },
      };
    });
  }

  async function deleteGame(id: string) {
    setDeleteError("");
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.from("games").delete().eq("id", id);

    if (error) {
      setDeleteError(error.message);
      return;
    }

    setMyGames((prev) => (prev || []).filter((g) => g.id !== id));
  }

  async function togglePublic(game: MyGame) {
    setPublishError("");
    setPublishBusyId(game.id);

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase
      .from("games")
      .update({ is_public: !game.is_public })
      .eq("id", game.id);

    setPublishBusyId(null);

    if (error) {
      setPublishError(error.message);
      return;
    }

    setMyGames((prev) =>
      (prev || []).map((g) => (g.id === game.id ? { ...g, is_public: !g.is_public } : g))
    );
  }

  async function handleCopy(game: CommunityGame) {
    if (!myTeacherId) return;
    setCopyError("");
    setCopyBusyId(game.id);

    const supabase = createBrowserSupabaseClient();
    const result = await forkGame(supabase, myTeacherId, game);

    setCopyBusyId(null);

    if ("error" in result) {
      setCopyError(result.error);
      return;
    }

    setMyGames((prev) => [
      {
        id: result.id,
        title: game.title,
        cover_image: game.cover_image,
        tags: game.tags,
        questions: game.questions,
        is_public: false,
        usage_count: 0,
      },
      ...(prev || []),
    ]);
    setForkCounts((prev) => ({ ...prev, [game.id]: (prev[game.id] || 0) + 1 }));
  }

  const rowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "0.75rem",
    padding: "0.9rem 1.1rem",
    borderRadius: radius.card,
    background: colors.white,
    boxShadow: solidShadow(4, colors.rosterCardShadow),
  };

  const primaryButtonStyle: React.CSSProperties = {
    fontSize: "0.9rem",
    fontWeight: 800,
    padding: "0.5rem 0.9rem",
    borderRadius: radius.button,
    border: "none",
    background: colors.orange,
    boxShadow: solidShadow(3, colors.orangeShadow),
    color: colors.white,
    cursor: "pointer",
    textDecoration: "none",
    whiteSpace: "nowrap",
  };

  const dangerButtonStyle: React.CSSProperties = {
    ...primaryButtonStyle,
    background: colors.coralText,
    boxShadow: "none",
  };

  function questionCountLabel(count: number) {
    return `${count} question${count === 1 ? "" : "s"}`;
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  function matchesSearch(title: string, tags: string[] | null): boolean {
    if (!normalizedQuery) return true;
    if (title.toLowerCase().includes(normalizedQuery)) return true;
    return (tags || []).some((t) => tagLabel(t).toLowerCase().includes(normalizedQuery));
  }

  const visibleMyGames = (myGames || []).filter((g) => matchesSearch(g.title, g.tags));
  const visibleCommunityGames = (communityGames || [])
    .filter((g) => !activeTagFilter || (g.tags || []).includes(activeTagFilter))
    .filter((g) => matchesSearch(g.title, g.tags));

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "2rem",
        gap: "1.5rem",
        background: colors.background,
        color: colors.textPrimary,
      }}
    >
      <h1 style={{ fontSize: "2rem", fontWeight: 800, margin: 0 }}>Games Library</h1>
      <p style={{ fontSize: "1rem", fontWeight: 600, opacity: 0.7, margin: 0 }}>
        Host a demo round of any game you own or copy from the community
      </p>

      {loadError && <p style={{ color: colors.coralText, fontSize: "0.9rem", fontWeight: 600 }}>{loadError}</p>}

      <Link
        href="/games/teacher/create-game"
        style={{
          fontSize: "1rem",
          fontWeight: 800,
          padding: "0.85rem 1.4rem",
          borderRadius: radius.button,
          border: "none",
          background: colors.orange,
          boxShadow: solidShadow(5, colors.orangeShadow),
          color: colors.white,
          textDecoration: "none",
        }}
      >
        Create New Game +
      </Link>

      <div style={{ width: "100%", maxWidth: "650px" }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search games by title or tag..."
          style={{
            width: "100%",
            fontSize: "0.95rem",
            fontWeight: 600,
            padding: "0.75rem 1rem",
            borderRadius: radius.button,
            border: `1px solid ${colors.inputBorder}`,
            background: colors.white,
            color: colors.textPrimary,
            boxSizing: "border-box",
          }}
        />
      </div>

      <section style={{ width: "100%", maxWidth: "650px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.75rem" }}>My Games</h2>

        {deleteError && (
          <p style={{ color: colors.coralText, fontSize: "0.85rem", marginBottom: "0.5rem" }}>{deleteError}</p>
        )}
        {publishError && (
          <p style={{ color: colors.coralText, fontSize: "0.85rem", marginBottom: "0.5rem" }}>{publishError}</p>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {myGames === null && !loadError && (
            <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>Loading...</p>
          )}

          {myGames?.length === 0 && (
            <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>
              No games yet. Create one, or copy one from the community below.
            </p>
          )}

          {myGames && myGames.length > 0 && visibleMyGames.length === 0 && (
            <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>
              No games match &quot;{searchQuery}&quot;.
            </p>
          )}

          {visibleMyGames.map((g) => (
            <div key={g.id} style={rowStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", textAlign: "left" }}>
                <GameCoverThumb title={g.title} coverImage={g.cover_image} />
                <div>
                  <div style={{ fontWeight: 800 }}>{g.title}</div>
                  <div style={{ fontSize: "0.78rem", fontWeight: 600, opacity: 0.6 }}>
                    {g.is_public ? "Public" : "Private"} · {questionCountLabel(g.questions.length)} · used{" "}
                    {g.usage_count} time
                    {g.usage_count === 1 ? "" : "s"}
                    {forkCounts[g.id] > 0 &&
                      ` · copied by ${forkCounts[g.id]} teacher${forkCounts[g.id] === 1 ? "" : "s"}`}
                  </div>
                  {g.is_public && <StarRating summary={ratings[g.id]} />}
                  <TagChips tags={g.tags} />
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <Link href={`/games/play/${g.id}`} style={primaryButtonStyle}>
                  Play Demo
                </Link>
                <button
                  onClick={() => togglePublic(g)}
                  disabled={publishBusyId === g.id}
                  style={{
                    ...primaryButtonStyle,
                    background: g.is_public ? colors.white : colors.greenButton,
                    boxShadow: g.is_public ? "none" : solidShadow(3, colors.greenButtonShadow),
                    color: g.is_public ? colors.textPrimary : colors.white,
                    border: g.is_public ? `1px solid ${colors.rosterCardShadow}` : "none",
                  }}
                >
                  {publishBusyId === g.id ? "..." : g.is_public ? "Unpublish" : "Publish"}
                </button>
                <button onClick={() => deleteGame(g.id)} style={dangerButtonStyle}>
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ width: "100%", maxWidth: "650px" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, margin: "0 0 0.75rem" }}>Community Games</h2>
        <p style={{ fontSize: "0.85rem", fontWeight: 600, opacity: 0.6, margin: "0 0 0.75rem" }}>
          Ready-made games shared by other teachers — copy one into My Games to keep and host your own.
        </p>

        {copyError && (
          <p style={{ color: colors.coralText, fontSize: "0.85rem", marginBottom: "0.5rem" }}>{copyError}</p>
        )}
        {rateError && (
          <p style={{ color: colors.coralText, fontSize: "0.85rem", marginBottom: "0.5rem" }}>{rateError}</p>
        )}

        {communityGames && communityGames.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginBottom: "0.75rem" }}>
            <button
              type="button"
              onClick={() => setActiveTagFilter(null)}
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "0.3rem 0.7rem",
                borderRadius: radius.pill,
                border: activeTagFilter === null ? "none" : `1px solid ${colors.inputBorder}`,
                background: activeTagFilter === null ? colors.blueText : colors.white,
                color: activeTagFilter === null ? colors.white : colors.textPrimary,
                cursor: "pointer",
              }}
            >
              All
            </button>
            {gameTagGallery.map((tag) => (
              <button
                key={tag.key}
                type="button"
                onClick={() => setActiveTagFilter(tag.key)}
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 800,
                  padding: "0.3rem 0.7rem",
                  borderRadius: radius.pill,
                  border: activeTagFilter === tag.key ? "none" : `1px solid ${colors.inputBorder}`,
                  background: activeTagFilter === tag.key ? colors.blueText : colors.white,
                  color: activeTagFilter === tag.key ? colors.white : colors.textPrimary,
                  cursor: "pointer",
                }}
              >
                {tag.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {communityGames === null && !loadError && (
            <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>Loading...</p>
          )}

          {communityGames?.length === 0 && (
            <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>No public games yet.</p>
          )}

          {communityGames && communityGames.length > 0 && visibleCommunityGames.length === 0 && (
            <p style={{ opacity: 0.6, fontWeight: 600, textAlign: "center" }}>
              No community games match your filters.
            </p>
          )}

          {visibleCommunityGames.map((g) => (
              <div key={g.id} style={rowStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", textAlign: "left" }}>
                  <GameCoverThumb title={g.title} coverImage={g.cover_image} />
                  <div>
                    <div style={{ fontWeight: 800 }}>{g.title}</div>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, opacity: 0.6 }}>
                      by {ownerNameOf(g) || "another teacher"} · {questionCountLabel(g.questions.length)} · used{" "}
                      {g.usage_count} time
                      {g.usage_count === 1 ? "" : "s"}
                      {forkCounts[g.id] > 0 &&
                        ` · copied by ${forkCounts[g.id]} teacher${forkCounts[g.id] === 1 ? "" : "s"}`}
                    </div>
                    <StarRating
                      summary={ratings[g.id]}
                      onRate={(rating) => rateGame(g.id, rating)}
                      busy={rateBusyId === g.id}
                    />
                    <TagChips tags={g.tags} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.4rem", flexShrink: 0 }}>
                  <Link href={`/games/play/${g.id}`} style={primaryButtonStyle}>
                    Play Demo
                  </Link>
                  <button
                    onClick={() => handleCopy(g)}
                    disabled={copyBusyId === g.id}
                    style={{ ...primaryButtonStyle, background: colors.greenButton, boxShadow: solidShadow(3, colors.greenButtonShadow) }}
                  >
                    {copyBusyId === g.id ? "Copying..." : "Copy to My Games"}
                  </button>
                </div>
              </div>
            ))}
        </div>
      </section>

      <Link
        href="/games/teacher"
        style={{
          fontSize: "0.9rem",
          fontWeight: 700,
          opacity: 0.7,
          color: "inherit",
          textDecoration: "underline",
        }}
      >
        ← Back to Games Dashboard
      </Link>
    </main>
  );
}
