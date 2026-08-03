// ЄДИНИЙ словник форматів для всієї платформи й ботів. Раніше було 3 різні набори:
// генератор (post/stories/reels/thread_chain…), формати (post/story/reel…), enum
// PostGroupType (single/carousel/thread_chain/stories). Тепер канон — оці ключі.
export const FORMAT_KEYS = ["post", "story", "reel", "carousel", "thread", "short", "slideshow"] as const;
export type FormatKey = (typeof FORMAT_KEYS)[number];

// Аліаси: будь-який старий/генераторний post_type → канонічний формат.
const FORMAT_ALIASES: Record<string, string> = {
  post: "post", single: "post", text: "post", telegram: "post",
  story: "story", stories: "story",
  reel: "reel", reels: "reel",
  carousel: "carousel",
  thread: "thread", thread_chain: "thread", thread_short: "thread", thread_question: "thread", chain: "thread",
  short: "short", shorts: "short",
  slideshow: "slideshow",
};

export function normalizeFormat(input: unknown): string {
  const v = String(input || "").toLowerCase().trim();
  return FORMAT_ALIASES[v] || (FORMAT_KEYS.includes(v as FormatKey) ? v : "post");
}

// Канонічний формат → застарілий enum PostGroupType (для сумісності зі старим полем `type`).
export function formatToPostGroupType(format: string | null): "single" | "carousel" | "thread_chain" | "stories" {
  switch (format) {
    case "carousel": return "carousel";
    case "thread": return "thread_chain";
    case "story": case "reel": case "short": case "slideshow": return "stories";
    default: return "single";
  }
}
