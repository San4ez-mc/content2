"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn, PLATFORM_META, STATUS_META } from "@/lib/utils";
import { PostModal } from "@/components/posts/PostModal";
import { QuickCreateModal } from "@/components/posts/QuickCreateModal";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isToday, parseISO } from "date-fns";
import { uk } from "date-fns/locale";

interface PostItem {
  id: string;
  orderIndex: number;
  content: string | null;
  imagePath: string | null;
  imagePrompt: string | null;
  imageType: string | null;
  isCta: boolean;
  generationStatus: string;
  generationError: string | null;
  slideTitle: string | null;
  slideSubtitle: string | null;
}

interface PostGroup {
  id: string;
  number?: number;
  postDate: string;
  type: string;
  status: string;
  audience: string | null;
  scheduleTime: string | null;
  categoryId: string | null;
  personaId: string | null;
  socialNetwork: { id: string; name: string; platformKey: string; color: string | null };
  category: { id: string; name: string; color: string | null } | null;
  persona: { id: string; name: string } | null;
  items: PostItem[];
}

interface Props {
  projects: { id: string; name: string }[];
  activeProject: { id: string; name: string };
  postGroups: PostGroup[];
  socialNetworks: { id: string; name: string; platformKey: string; color: string | null }[];
  monthStr: string;
}

const DOW = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const PLATFORM_COLORS: Record<string, string> = {
  threads: "#9333ea",
  instagram_posts: "#ec4899",
  instagram_stories: "#f97316",
  instagram_reels: "#ec4899",
  linkedin: "#3b82f6",
  tiktok: "#06b6d4",
};

export function CalendarView({ projects, activeProject, postGroups: initialGroups, socialNetworks, monthStr }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedPost, setSelectedPost] = useState<PostGroup | null>(null);
  const [quickCreateDate, setQuickCreateDate] = useState<string | null>(null);
  const [activeNetwork, setActiveNetwork] = useState<string | null>(null);
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const sseRef = useRef<EventSource | null>(null);

  async function handleDropOnDate(postId: string, targetDate: string) {
    await fetch(`/api/posts/${postId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postDate: targetDate }),
    });
    queryClient.invalidateQueries({ queryKey: ["postGroups", activeProject.id, monthStr] });
  }

  const [year, month] = monthStr.split("-").map(Number);

  // Fetch posts via React Query (refreshable)
  const { data: postGroups = initialGroups } = useQuery<PostGroup[]>({
    queryKey: ["postGroups", activeProject.id, monthStr],
    queryFn: async () => {
      const r = await fetch(
        `/api/posts?projectId=${activeProject.id}&month=${monthStr}`
      );
      return r.json();
    },
    initialData: initialGroups,
    staleTime: 10_000,
  });

  // SSE subscription for real-time updates
  useEffect(() => {
    if (sseRef.current) sseRef.current.close();
    const es = new EventSource(`/api/sse/project/${activeProject.id}`);
    sseRef.current = es;

    es.onmessage = (e) => {
      const data = JSON.parse(e.data);
      // Broadcast all SSE events to window for other components (ChatPanel etc.)
      window.dispatchEvent(new CustomEvent("sse_event", { detail: data }));
      if (data.type === "generation_update" || data.type === "post_updated") {
        queryClient.invalidateQueries({ queryKey: ["postGroups", activeProject.id, monthStr] });
      }
    };

    return () => es.close();
  }, [activeProject.id, monthStr, queryClient]);

  // Calendar grid
  const firstDay = startOfMonth(new Date(year, month - 1));
  const lastDay = endOfMonth(firstDay);
  const days = eachDayOfInterval({ start: firstDay, end: lastDay });

  // Pad start: Monday = 0
  const startDow = (getDay(firstDay) + 6) % 7; // 0=Mon
  const paddedDays: (Date | null)[] = [
    ...Array(startDow).fill(null),
    ...days,
  ];

  // Group posts by date
  const postsByDate = new Map<string, PostGroup[]>();
  postGroups.forEach((g) => {
    const d = g.postDate.slice(0, 10);
    if (!postsByDate.has(d)) postsByDate.set(d, []);
    postsByDate.get(d)!.push(g);
  });

  function toggleBulkSelect(id: string) {
    setBulkSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function bulkDelete() {
    if (!confirm(`Видалити ${bulkSelected.size} постів?`)) return;
    setBulkLoading(true);
    try {
      await Promise.all(Array.from(bulkSelected).map((id) => fetch(`/api/posts/${id}`, { method: "DELETE" })));
      setBulkSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["postGroups", activeProject.id, monthStr] });
    } finally {
      setBulkLoading(false);
    }
  }

  async function bulkStatus(status: string) {
    setBulkLoading(true);
    try {
      await Promise.all(
        Array.from(bulkSelected).map((id) =>
          fetch(`/api/posts/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          })
        )
      );
      setBulkSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["postGroups", activeProject.id, monthStr] });
    } finally {
      setBulkLoading(false);
    }
  }

  function prevMonth() {
    const d = new Date(year, month - 2);
    router.push(`/?projectId=${activeProject.id}&month=${format(d, "yyyy-MM")}`);
  }

  function nextMonth() {
    const d = new Date(year, month);
    router.push(`/?projectId=${activeProject.id}&month=${format(d, "yyyy-MM")}`);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-40px)] overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-canvas-subtle shrink-0 flex-wrap">
        {/* Month nav */}
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="btn-ghost px-2 py-1">‹</button>
          <span className="text-sm font-semibold text-fg min-w-32 text-center capitalize">
            {format(new Date(year, month - 1), "LLLL yyyy", { locale: uk })}
          </span>
          <button onClick={nextMonth} className="btn-ghost px-2 py-1">›</button>
        </div>

        <div className="w-px h-4 bg-border" />

        {/* Project selector */}
        {projects.length > 1 && (
          <select
            value={activeProject.id}
            onChange={(e) => router.push(`/?projectId=${e.target.value}&month=${monthStr}`)}
            className="text-xs bg-canvas border border-border rounded px-2 py-1 text-fg"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        )}

        {/* Network filters — radio (single select, null = all) */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveNetwork(null)}
            className={cn(
              "text-xs px-2.5 py-0.5 rounded-full border transition-colors",
              activeNetwork === null
                ? "bg-accent text-white border-accent"
                : "text-fg-muted border-border hover:border-accent/50"
            )}
          >
            Всі
          </button>
          {socialNetworks.map((n) => {
            const color = n.color || PLATFORM_COLORS[n.platformKey] || "#64748b";
            const active = activeNetwork === n.id;
            return (
              <button
                key={n.id}
                onClick={() => setActiveNetwork(active ? null : n.id)}
                className={cn(
                  "text-xs px-2.5 py-0.5 rounded-full border transition-colors",
                  active ? "text-white border-transparent" : "text-fg-muted border-border hover:border-accent/50"
                )}
                style={active ? { backgroundColor: color, borderColor: color } : {}}
              >
                {n.name}
              </button>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {bulkSelected.size > 0 && (
            <div className="flex items-center gap-1 bg-canvas border border-border rounded-lg px-2 py-1">
              <span className="text-xs text-fg-muted">{bulkSelected.size} обрано</span>
              <div className="w-px h-3 bg-border mx-1" />
              <button
                onClick={() => bulkStatus("scheduled")}
                disabled={bulkLoading}
                className="text-xs text-warn hover:text-warn/80 px-1.5 py-0.5 hover:bg-border/30 rounded transition-colors"
              >
                ⏰ Заплановано
              </button>
              <button
                onClick={() => bulkStatus("published")}
                disabled={bulkLoading}
                className="text-xs text-success hover:text-success/80 px-1.5 py-0.5 hover:bg-border/30 rounded transition-colors"
              >
                ✅ Опубліковано
              </button>
              <button
                onClick={() => bulkStatus("archived")}
                disabled={bulkLoading}
                className="text-xs text-fg-muted px-1.5 py-0.5 hover:bg-border/30 rounded transition-colors"
              >
                📦 Архів
              </button>
              <button
                onClick={bulkDelete}
                disabled={bulkLoading}
                className="text-xs text-danger px-1.5 py-0.5 hover:bg-danger/10 rounded transition-colors"
              >
                🗑
              </button>
              <button
                onClick={() => setBulkSelected(new Set())}
                className="text-xs text-fg-subtle px-1 hover:text-fg"
              >
                ×
              </button>
            </div>
          )}
          <button
            onClick={() => setQuickCreateDate(format(new Date(), "yyyy-MM-dd"))}
            className="btn-primary text-xs px-3 py-1"
          >
            + Новий пост
          </button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto p-3">
        {/* DOW headers */}
        <div className="grid grid-cols-7 gap-1.5 mb-1.5">
          {DOW.map((d) => (
            <div key={d} className="text-center text-xs font-medium text-fg-muted py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {paddedDays.map((day, idx) => {
            if (!day) return <div key={`pad-${idx}`} />;

            const dateStr = format(day, "yyyy-MM-dd");
            const today = isToday(day);
            const curMonth = isSameMonth(day, new Date(year, month - 1));
            const posts = (postsByDate.get(dateStr) || []).filter(
              (g) => activeNetwork === null || g.socialNetwork.id === activeNetwork
            );

            return (
              <div
                key={dateStr}
                className={cn(
                  "min-h-[140px] rounded-lg border p-2 transition-colors group",
                  today
                    ? "border-accent/50 bg-accent/5"
                    : "border-border hover:border-border/80 bg-canvas-subtle",
                  !curMonth && "opacity-50",
                  dragOverDate === dateStr && "border-accent bg-accent/10 ring-1 ring-accent/40"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragOverDate(dateStr); }}
                onDragLeave={() => setDragOverDate(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOverDate(null);
                  const postId = e.dataTransfer.getData("postId");
                  const fromDate = e.dataTransfer.getData("fromDate");
                  if (postId && fromDate !== dateStr) handleDropOnDate(postId, dateStr);
                }}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={cn(
                      "text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full",
                      today
                        ? "bg-accent text-white"
                        : "text-fg-muted"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  <button
                    onClick={() => setQuickCreateDate(dateStr)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-fg-subtle hover:text-accent w-5 h-5 flex items-center justify-center rounded hover:bg-border/40"
                    title="Додати пост"
                  >
                    +
                  </button>
                </div>

                {/* Post chips */}
                <div className="space-y-1">
                  {posts.map((group) => (
                    <PostChip
                      key={group.id}
                      group={group}
                      dateStr={dateStr}
                      onClick={() => { if (bulkSelected.size > 0) { toggleBulkSelect(group.id); } else { setSelectedPost(group); } }}
                      bulkSelected={bulkSelected.has(group.id)}
                      onBulkSelect={() => toggleBulkSelect(group.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Post modal */}
      {selectedPost && (
        <PostModal
          group={selectedPost}
          projectId={activeProject.id}
          onClose={() => setSelectedPost(null)}
          onUpdate={() => {
            queryClient.invalidateQueries({ queryKey: ["postGroups", activeProject.id, monthStr] });
            setSelectedPost(null);
          }}
        />
      )}

      {/* Quick create modal */}
      {quickCreateDate && (
        <QuickCreateModal
          date={quickCreateDate}
          projectId={activeProject.id}
          socialNetworks={socialNetworks}
          onClose={() => setQuickCreateDate(null)}
          onCreated={() => {
            queryClient.invalidateQueries({ queryKey: ["postGroups", activeProject.id, monthStr] });
            setQuickCreateDate(null);
          }}
        />
      )}
    </div>
  );
}

function PostChip({ group, dateStr, onClick, bulkSelected, onBulkSelect }: {
  group: PostGroup; dateStr: string; onClick: () => void; bulkSelected: boolean; onBulkSelect: () => void;
}) {
  const platformKey = group.socialNetwork.platformKey;
  const color = group.socialNetwork.color || PLATFORM_COLORS[platformKey] || "#64748b";
  const firstItem = group.items[0];
  const text = firstItem?.content || "";
  const hasImage = firstItem?.imagePath;
  const isGenerating = group.items.some((i) => i.generationStatus === "generating");
  const isGeneratingText = group.items.some((i) => i.generationStatus === "generating_text");
  const hasFailed = group.items.some((i) => i.generationStatus === "failed");

  const typeIcon =
    group.type === "carousel" ? "🎠"
    : group.type === "thread_chain" ? "🧵"
    : group.type === "stories" ? "📱"
    : "";

  const itemCount = group.items.length;

  return (
    <button
      onClick={onClick}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("postId", group.id);
        e.dataTransfer.setData("fromDate", dateStr);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn("post-chip w-full text-left group/chip cursor-grab active:cursor-grabbing", bulkSelected && "ring-1 ring-accent bg-accent/5")}
      style={{ borderLeftColor: color, borderLeftWidth: 2 }}
    >
      {/* Bulk checkbox */}
      <div
        className={cn(
          "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-all",
          bulkSelected
            ? "border-accent bg-accent opacity-100"
            : "border-border opacity-0 group/chip-hover:opacity-100 hover:opacity-100"
        )}
        onClick={(e) => { e.stopPropagation(); onBulkSelect(); }}
      >
        {bulkSelected && <span className="text-white text-[8px] font-bold">✓</span>}
      </div>
      {/* Image thumbnail */}
      {hasImage && (
        <img
          src={firstItem.imagePath!}
          alt=""
          className="w-8 h-8 rounded object-cover shrink-0"
        />
      )}
      {(isGenerating || isGeneratingText) && !hasImage && (
        <div className="w-8 h-8 rounded skeleton shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 mb-0.5">
          {typeIcon && <span className="text-xs">{typeIcon}</span>}
          {itemCount > 1 && (
            <span className="text-[10px] text-fg-subtle">×{itemCount}</span>
          )}
          {group.number != null && (
            <span className="text-[10px] text-fg-subtle font-mono">#{group.number}</span>
          )}
          <span
            className="text-[10px] font-medium truncate"
            style={{ color }}
          >
            {group.socialNetwork.name}
          </span>
          {isGenerating && (
            <span className="text-[10px] text-accent animate-pulse">⏳</span>
          )}
          {isGeneratingText && (
            <span className="text-[10px] text-accent animate-pulse">✍️</span>
          )}
          {hasFailed && (
            <span className="text-[10px] text-danger">❌</span>
          )}
        </div>
        <p className="text-[11px] text-fg-muted leading-tight line-clamp-2">
          {text || (isGeneratingText ? "✍️ генерується текст…" : "(без тексту)")}
        </p>
      </div>

      {/* Status dot */}
      <div
        className="w-1.5 h-1.5 rounded-full shrink-0 mt-1"
        style={{ backgroundColor: STATUS_META[group.status]?.color || "#8b949e" }}
        title={STATUS_META[group.status]?.label}
      />
    </button>
  );
}
