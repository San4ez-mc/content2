import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const PLATFORM_META: Record<
  string,
  { label: string; color: string; icon: string; charLimit: number }
> = {
  threads: {
    label: "Threads",
    color: "#9333ea",
    icon: "🧵",
    charLimit: 500,
  },
  instagram_posts: {
    label: "Instagram",
    color: "#ec4899",
    icon: "📸",
    charLimit: 2200,
  },
  instagram_stories: {
    label: "Stories",
    color: "#f97316",
    icon: "📱",
    charLimit: 0,
  },
  instagram_reels: {
    label: "Reels",
    color: "#ec4899",
    icon: "🎬",
    charLimit: 2200,
  },
  linkedin: {
    label: "LinkedIn",
    color: "#3b82f6",
    icon: "💼",
    charLimit: 3000,
  },
  tiktok: {
    label: "TikTok",
    color: "#06b6d4",
    icon: "🎵",
    charLimit: 2200,
  },
};

export const POST_TYPE_META: Record<
  string,
  { label: string; icon: string }
> = {
  single: { label: "Single", icon: "📝" },
  carousel: { label: "Carousel", icon: "🎠" },
  thread_chain: { label: "Thread", icon: "🧵" },
  stories: { label: "Stories", icon: "📱" },
};

export const STATUS_META: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  draft: { label: "Чернетка", color: "#8b949e", bg: "#21262d" },
  scheduled: { label: "Заплановано", color: "#3b82f6", bg: "#172554" },
  published: { label: "Опубліковано", color: "#10b981", bg: "#022c22" },
  archived: { label: "Архів", color: "#6e7681", bg: "#0d1117" },
};

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}.${mm}.${yy}`;
}

/** Зсув Києва від UTC у хвилинах на момент `now`: 180 влітку, 120 взимку (перехід на зимовий час — остання неділя жовтня). */
export function kyivOffsetMinutes(now: Date = new Date()): number {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(now);
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
  return Math.round((asUtc - Math.floor(now.getTime() / 1000) * 1000) / 60000);
}

export function kyivToday(): string {
  const now = new Date();
  const kyivMs =
    now.getTime() + (kyivOffsetMinutes(now) - now.getTimezoneOffset()) * 60000;
  return new Date(kyivMs).toISOString().slice(0, 10);
}
