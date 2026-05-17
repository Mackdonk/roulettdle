const STORAGE_KEY = "roulettdle_player_key";

/** Stable per-browser id for daily_scores.player_key (client-only). */
export function getOrCreatePlayerKey(): string {
  if (typeof window === "undefined") return "";
  let key = localStorage.getItem(STORAGE_KEY);
  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, key);
  }
  return key;
}
