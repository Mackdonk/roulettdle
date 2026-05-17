import { NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

/** Today as `YYYY-MM-DD` in UTC (matches `daily_scores.play_date_utc`). */
function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  const playDate = todayUtcDate();

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("daily_scores")
      .select(
        "id, player_key, play_date_utc, score, display_name, created_at",
      )
      .eq("play_date_utc", playDate)
      .order("score", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ playDateUtc: playDate, scores: data ?? [] });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Expected JSON object" }, { status: 400 });
  }

  const o = body as Record<string, unknown>;
  const playerKeyRaw = o.playerKey ?? o.player_key;
  const scoreRaw = o.score;
  const displayNameRaw =
    o.displayName ?? o.display_name ?? null;

  if (typeof playerKeyRaw !== "string" || playerKeyRaw.length === 0) {
    return NextResponse.json({ message: "playerKey required" }, { status: 400 });
  }

  if (typeof scoreRaw !== "number" || !Number.isFinite(scoreRaw)) {
    return NextResponse.json({ message: "score must be a number" }, { status: 400 });
  }

  if (!Number.isInteger(scoreRaw)) {
    return NextResponse.json({ message: "score must be an integer" }, { status: 400 });
  }

  let display_name: string | null = null;
  if (displayNameRaw != null) {
    if (typeof displayNameRaw !== "string") {
      return NextResponse.json(
        { message: "displayName must be a string or null" },
        { status: 400 },
      );
    }
    display_name = displayNameRaw.slice(0, 64);
  }

  const play_date_utc = todayUtcDate();

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from("daily_scores").insert({
      player_key: playerKeyRaw,
      play_date_utc,
      score: scoreRaw,
      display_name,
    });

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { message: "Already played today" },
          { status: 409 },
        );
      }
      return NextResponse.json({ message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
