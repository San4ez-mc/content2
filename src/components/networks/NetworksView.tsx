"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface SocialNetwork {
  id: string;
  name: string;
  platformKey: string;
  icon: string | null;
  color: string | null;
  isEnabled: boolean;
  sortOrder: number;
}

interface ScheduleSettings {
  monday: string[];
  tuesday: string[];
  wednesday: string[];
  thursday: string[];
  friday: string[];
  saturday: string[];
  sunday: string[];
  sendToTelegram: boolean;
  telegramChatId: string | null;
}

interface Props {
  projectId: string;
  networks: SocialNetwork[];
  schedule: ScheduleSettings | null;
}

const PLATFORM_PRESETS = [
  { platformKey: "instagram_posts", name: "Instagram Posts", icon: "📸", color: "#ec4899" },
  { platformKey: "instagram_stories", name: "Instagram Stories", icon: "📱", color: "#f97316" },
  { platformKey: "instagram_reels", name: "Instagram Reels", icon: "🎬", color: "#ec4899" },
  { platformKey: "threads", name: "Threads", icon: "🧵", color: "#9333ea" },
  { platformKey: "linkedin", name: "LinkedIn", icon: "💼", color: "#3b82f6" },
  { platformKey: "tiktok", name: "TikTok", icon: "🎵", color: "#06b6d4" },
  { platformKey: "telegram", name: "Telegram", icon: "✈️", color: "#0088cc" },
  { platformKey: "facebook", name: "Facebook", icon: "📘", color: "#1877f2" },
  { platformKey: "youtube", name: "YouTube Shorts", icon: "▶️", color: "#ef4444" },
];

const DAYS = [
  { key: "monday", label: "Пн" },
  { key: "tuesday", label: "Вт" },
  { key: "wednesday", label: "Ср" },
  { key: "thursday", label: "Чт" },
  { key: "friday", label: "Пт" },
  { key: "saturday", label: "Сб" },
  { key: "sunday", label: "Нд" },
];

export function NetworksView({ projectId, networks: initial, schedule: initialSchedule }: Props) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"networks" | "schedule">("networks");
  const [showAddNetwork, setShowAddNetwork] = useState(false);

  const { data: networks = initial } = useQuery<SocialNetwork[]>({
    queryKey: ["networks", projectId],
    queryFn: () => fetch(`/api/networks?projectId=${projectId}`).then((r) => r.json()),
    initialData: initial,
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col h-[calc(100vh-40px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-canvas-subtle shrink-0">
        <div className="flex items-center gap-1">
          {(["networks", "schedule"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-colors",
                activeTab === t ? "bg-accent text-white" : "text-fg-muted hover:text-fg hover:bg-border/30"
              )}
            >
              {t === "networks" ? "🌐 Мережі" : "⏰ Розклад"}
            </button>
          ))}
        </div>

        {activeTab === "networks" && (
          <button onClick={() => setShowAddNetwork(true)} className="ml-auto btn-primary text-xs px-3 py-1">
            + Мережа
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === "networks" ? (
          <NetworksList
            networks={networks}
            projectId={projectId}
            onRefresh={() => qc.invalidateQueries({ queryKey: ["networks", projectId] })}
          />
        ) : (
          <ScheduleEditor projectId={projectId} initial={initialSchedule} />
        )}
      </div>

      {showAddNetwork && (
        <AddNetworkModal
          projectId={projectId}
          existingKeys={networks.map((n) => n.platformKey)}
          onClose={() => setShowAddNetwork(false)}
          onAdded={() => {
            qc.invalidateQueries({ queryKey: ["networks", projectId] });
            setShowAddNetwork(false);
          }}
        />
      )}
    </div>
  );
}

function NetworksList({ networks, projectId, onRefresh }: { networks: SocialNetwork[]; projectId: string; onRefresh: () => void }) {
  async function toggle(id: string, enabled: boolean) {
    await fetch(`/api/networks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isEnabled: !enabled }),
    });
    onRefresh();
  }

  async function deleteNetwork(id: string, name: string) {
    if (!confirm(`Видалити мережу "${name}"? Всі пости цієї мережі будуть втрачені!`)) return;
    await fetch(`/api/networks/${id}`, { method: "DELETE" });
    onRefresh();
  }

  if (networks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-5xl mb-4">🌐</div>
        <p className="text-sm text-fg-muted">Немає налаштованих мереж</p>
        <p className="text-xs text-fg-subtle mt-1">Додайте соціальні мережі для вашого проекту</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-2">
      {networks.map((n) => {
        const preset = PLATFORM_PRESETS.find((p) => p.platformKey === n.platformKey);
        return (
          <div
            key={n.id}
            className={cn(
              "flex items-center gap-4 p-4 bg-canvas-subtle border rounded-xl transition-colors",
              n.isEnabled ? "border-border" : "border-border/40 opacity-60"
            )}
          >
            {/* Icon */}
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
              style={{ backgroundColor: (n.color || preset?.color || "#64748b") + "22" }}
            >
              {n.icon || preset?.icon || "🌐"}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-fg">{n.name}</h3>
                <span className="text-[10px] text-fg-subtle px-1.5 py-0.5 bg-border/40 rounded">{n.platformKey}</span>
              </div>
              <p className="text-xs text-fg-muted mt-0.5">Порядок: {n.sortOrder}</p>
            </div>

            {/* Color dot */}
            <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: n.color || preset?.color || "#64748b" }} />

            {/* Toggle */}
            <button
              onClick={() => toggle(n.id, n.isEnabled)}
              className={cn(
                "relative w-10 h-5 rounded-full transition-colors shrink-0",
                n.isEnabled ? "bg-accent" : "bg-border"
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                  n.isEnabled ? "translate-x-5" : "translate-x-0.5"
                )}
              />
            </button>

            {/* Delete */}
            <button
              onClick={() => deleteNetwork(n.id, n.name)}
              className="text-fg-subtle hover:text-danger transition-colors text-sm p-1"
            >
              🗑
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ScheduleEditor({ projectId, initial }: { projectId: string; initial: ScheduleSettings | null }) {
  const defaultSchedule: ScheduleSettings = {
    monday: ["09:00", "12:00", "18:00"],
    tuesday: ["09:00", "12:00", "18:00"],
    wednesday: ["09:00", "12:00", "18:00"],
    thursday: ["09:00", "12:00", "18:00"],
    friday: ["09:00", "12:00", "18:00"],
    saturday: [],
    sunday: [],
    sendToTelegram: true,
    telegramChatId: null,
  };

  const [schedule, setSchedule] = useState<ScheduleSettings>(initial || defaultSchedule);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function updateDay(day: string, times: string[]) {
    setSchedule((prev) => ({ ...prev, [day]: times }));
  }

  function addTime(day: string) {
    const current = (schedule as any)[day] as string[];
    updateDay(day, [...current, "09:00"]);
  }

  function removeTime(day: string, idx: number) {
    const current = (schedule as any)[day] as string[];
    updateDay(day, current.filter((_, i) => i !== idx));
  }

  function changeTime(day: string, idx: number, val: string) {
    const current = [...(schedule as any)[day] as string[]];
    current[idx] = val;
    updateDay(day, current.sort());
  }

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, ...schedule }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      {/* Day-by-day schedule */}
      <div className="bg-canvas-subtle border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-fg">Часи публікацій</h3>
          <p className="text-xs text-fg-muted mt-0.5">Налаштуйте коли відправляти заплановані пости</p>
        </div>
        <div className="divide-y divide-border">
          {DAYS.map(({ key, label }) => {
            const times = (schedule as any)[key] as string[];
            const isWorkday = !["saturday", "sunday"].includes(key);
            return (
              <div key={key} className="flex items-start gap-4 px-4 py-3">
                <div className="w-7 text-xs font-medium text-fg-muted pt-1 shrink-0">{label}</div>
                <div className="flex-1 flex flex-wrap gap-2 items-center">
                  {times.map((time, idx) => (
                    <div key={idx} className="flex items-center gap-1 bg-border/40 rounded-lg px-2 py-1">
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => changeTime(key, idx, e.target.value)}
                        className="text-xs bg-transparent text-fg w-16 focus:outline-none"
                      />
                      <button
                        onClick={() => removeTime(key, idx)}
                        className="text-fg-subtle hover:text-danger text-xs ml-0.5"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() => addTime(key)}
                    className="text-xs text-fg-muted hover:text-accent transition-colors px-2 py-1 rounded-lg border border-dashed border-border hover:border-accent/50"
                  >
                    + час
                  </button>
                </div>
                {times.length === 0 && (
                  <span className="text-xs text-fg-subtle pt-1">Без публікацій</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Telegram settings */}
      <div className="bg-canvas-subtle border border-border rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-fg">📨 Відправка в Telegram</h3>

        <label className="flex items-center gap-3 cursor-pointer">
          <div
            onClick={() => setSchedule((p) => ({ ...p, sendToTelegram: !p.sendToTelegram }))}
            className={cn(
              "relative w-10 h-5 rounded-full transition-colors cursor-pointer",
              schedule.sendToTelegram ? "bg-accent" : "bg-border"
            )}
          >
            <div className={cn("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform", schedule.sendToTelegram ? "translate-x-5" : "translate-x-0.5")} />
          </div>
          <span className="text-xs text-fg">Автовідправка через Telegram бота</span>
        </label>

        {schedule.sendToTelegram && (
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Telegram Chat ID</label>
            <input
              className="input text-xs font-mono"
              value={schedule.telegramChatId || ""}
              onChange={(e) => setSchedule((p) => ({ ...p, telegramChatId: e.target.value }))}
              placeholder="-1001234567890"
            />
            <p className="text-[10px] text-fg-subtle mt-1">
              ID каналу або групи куди відправляти пости. Починається з -100 для каналів.
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn-primary text-xs px-6 py-2">
          {saving ? "Збереження..." : "Зберегти розклад"}
        </button>
        {saved && <span className="text-xs text-success">✓ Збережено</span>}
      </div>
    </div>
  );
}

function AddNetworkModal({ projectId, existingKeys, onClose, onAdded }: {
  projectId: string;
  existingKeys: string[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const available = PLATFORM_PRESETS.filter((p) => !existingKeys.includes(p.platformKey));
  const [selected, setSelected] = useState<string | null>(null);
  const [customName, setCustomName] = useState("");
  const [saving, setSaving] = useState(false);

  const preset = PLATFORM_PRESETS.find((p) => p.platformKey === selected);

  async function add() {
    if (!selected) return;
    setSaving(true);
    try {
      await fetch("/api/networks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          platformKey: selected,
          name: customName || preset?.name,
          icon: preset?.icon,
          color: preset?.color,
          sortOrder: existingKeys.length,
        }),
      });
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="bg-canvas-subtle border border-border rounded-xl shadow-2xl w-full max-w-sm animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-fg">Додати мережу</h3>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg text-lg">×</button>
        </div>

        <div className="p-4 space-y-2">
          {available.length === 0 ? (
            <p className="text-xs text-fg-muted text-center py-4">Всі доступні мережі вже додані</p>
          ) : (
            available.map((p) => (
              <button
                key={p.platformKey}
                onClick={() => { setSelected(p.platformKey); setCustomName(p.name); }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl border transition-colors text-left",
                  selected === p.platformKey
                    ? "border-accent bg-accent/10"
                    : "border-border hover:border-border/80 hover:bg-border/20"
                )}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: p.color + "22" }}>
                  {p.icon}
                </div>
                <span className="text-sm font-medium text-fg">{p.name}</span>
              </button>
            ))
          )}

          {selected && (
            <div className="pt-2">
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Назва (можна змінити)</label>
              <input className="input" value={customName} onChange={(e) => setCustomName(e.target.value)} />
            </div>
          )}
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="btn-ghost flex-1 text-xs py-2">Скасувати</button>
          <button onClick={add} disabled={!selected || saving} className="btn-primary flex-1 text-xs py-2">
            {saving ? "Додавання..." : "Додати"}
          </button>
        </div>
      </div>
    </div>
  );
}
