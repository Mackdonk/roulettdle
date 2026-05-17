-- Run in Supabase SQL editor when you want one row per player per UTC calendar day.
-- Remove duplicate (player_key, play_date_utc) rows first if this fails.

alter table public.daily_scores
  add constraint daily_scores_player_date_uniq unique (player_key, play_date_utc);
