"use client";

import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Stats {
  totals: { total: number; draft: number; scheduled: number; published: number; archived: number };
  thisMonth: number;
  prevMonth: number;
  growthPct: number | null;
  byNetwork: { networkId: string; name: string; platformKey: string; color: string; count: number }[];
  perDay: { date: string; total: number; published: number }[];
  mediaStats: { withImages: number; total: number; pct: number };
}

export function StatsView({ projectId }: { projectId: string }) {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["stats", projectId],
    queryFn: () => fetch(`/api/stats?projectId=${projectId}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 skeleton rounded-xl" />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const { totals, thisMonth, growthPct, byNetwork, perDay, mediaStats } = stats;

  // Max value for chart bars
  const maxPerDay = Math.max(...perDay.map((d) => d.total), 1);

  return (
    <div className="flex flex-col h-[calc(100vh-40px)] overflow-auto">
      <div className="p-4 space-y-4 max-w-5xl">

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Всього постів" value={totals.total} icon="📋" color="accent" />
          <StatCard
            label="Цього місяця"
            value={thisMonth}
            icon="📅"
            color="success"
            suffix={growthPct !== null ? (growthPct >= 0 ? `+${growthPct}%` : `${growthPct}%`) : undefined}
            suffixColor={growthPct !== null ? (growthPct >= 0 ? "text-success" : "text-danger") : undefined}
          />
          <StatCard label="Заплановано" value={totals.scheduled} icon="⏰" color="warn" />
          <StatCard label="Опубліковано" value={totals.published} icon="✅" color="success" />
        </div>

        {/* Status breakdown */}
        <div className="bg-canvas-subtle border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-fg mb-3">Розбивка по статусах</h3>
          <div className="space-y-2">
            {[
              { key: "draft", label: "Чернетки", value: totals.draft, color: "#64748b" },
              { key: "scheduled", label: "Заплановано", value: totals.scheduled, color: "#f59e0b" },
              { key: "published", label: "Опубліковано", value: totals.published, color: "#10b981" },
              { key: "archived", label: "Архів", value: totals.archived, color: "#475569" },
            ].map(({ key, label, value, color }) => {
              const pct = totals.total > 0 ? (value / totals.total) * 100 : 0;
              return (
                <div key={key} className="flex items-center gap-3">
                  <div className="w-20 text-xs text-fg-muted shrink-0">{label}</div>
                  <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
                  </div>
                  <div className="w-8 text-xs text-fg-muted text-right shrink-0">{value}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* By network */}
        {byNetwork.length > 0 && (
          <div className="bg-canvas-subtle border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-fg mb-3">По платформах</h3>
            <div className="space-y-2">
              {byNetwork.sort((a, b) => b.count - a.count).map((n) => {
                const pct = totals.total > 0 ? (n.count / totals.total) * 100 : 0;
                return (
                  <div key={n.networkId} className="flex items-center gap-3">
                    <div className="w-28 text-xs text-fg-muted truncate shrink-0">{n.name}</div>
                    <div className="flex-1 h-2 bg-border rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: n.color }} />
                    </div>
                    <div className="w-8 text-xs text-fg-muted text-right shrink-0">{n.count}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Activity chart (last 30 days) */}
        {perDay.length > 0 && (
          <div className="bg-canvas-subtle border border-border rounded-xl p-4">
            <h3 className="text-sm font-semibold text-fg mb-3">Активність (30 днів)</h3>
            <div className="flex items-end gap-1 h-24">
              {perDay.map((d) => {
                const height = (d.total / maxPerDay) * 100;
                const date = new Date(d.date).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" });
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${date}: ${d.total} постів`}>
                    <div className="w-full flex flex-col justify-end" style={{ height: "80px" }}>
                      <div
                        className="w-full bg-accent/40 hover:bg-accent/70 transition-colors rounded-t-sm"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-fg-subtle">
                {new Date(perDay[0]?.date).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" })}
              </span>
              <span className="text-[10px] text-fg-subtle">
                {new Date(perDay[perDay.length - 1]?.date).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" })}
              </span>
            </div>
          </div>
        )}

        {/* Media stats */}
        <div className="bg-canvas-subtle border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-fg mb-3">🖼 Медіа</h3>
          <div className="flex items-center gap-4">
            <div className="text-2xl font-bold text-fg">{mediaStats.pct}%</div>
            <div>
              <p className="text-xs text-fg-muted">постів мають зображення</p>
              <p className="text-xs text-fg-subtle">{mediaStats.withImages} з {mediaStats.total} айтемів</p>
            </div>
            <div className="flex-1 h-3 bg-border rounded-full overflow-hidden ml-4">
              <div className="h-full bg-accent/70 rounded-full" style={{ width: `${mediaStats.pct}%` }} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, suffix, suffixColor }: {
  label: string;
  value: number;
  icon: string;
  color: string;
  suffix?: string;
  suffixColor?: string;
}) {
  return (
    <div className="bg-canvas-subtle border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xl">{icon}</span>
        {suffix && <span className={cn("text-xs font-medium", suffixColor)}>{suffix}</span>}
      </div>
      <div className="text-2xl font-bold text-fg">{value}</div>
      <p className="text-xs text-fg-muted mt-0.5">{label}</p>
    </div>
  );
}
