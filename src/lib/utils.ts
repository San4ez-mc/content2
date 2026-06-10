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
  return d.toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function kyivToday(): string {
  const now = new Date();
  const kyivMs =
    now.getTime() + (3 * 60 - now.getTimezoneOffset()) * 60000;
  return new Date(kyivMs).toISOString().slice(0, 10);
}
