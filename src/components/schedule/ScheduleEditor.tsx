"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface ScheduleSettings {
  monday: string[];
  tuesday: string[];
  wednesday: string[];
  thursday: string[];
  friday: string[];
  saturday: string[];
  sunday: string[];
  sendToTelegram: boolean;
  telegramChatId: string | null;
  digestTime: string | null;
  digestChatId: string | null;
}

export const SCHEDULE_DAYS = [
  { key: "monday", label: "Пн" },
  { key: "tuesday", label: "Вт" },
  { key: "wednesday", label: "Ср" },
  { key: "thursday", label: "Чт" },
  { key: "friday", label: "Пт" },
  { key: "saturday", label: "Сб" },
  { key: "sunday", label: "Нд" },
];

export function ScheduleEditor({
  projectId,
  initial,
  onSaved,
}: {
  projectId: string;
  initial: ScheduleSettings | null;
  onSaved?: (s: ScheduleSettings) => void;
}) {
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
    digestTime: null,
    digestChatId: null,
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
      onSaved?.(schedule);
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
          {SCHEDULE_DAYS.map(({ key, label }) => {
            const times = (schedule as any)[key] as string[];
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

      {/* Morning digest */}
      <div className="bg-canvas-subtle border border-border rounded-xl p-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-fg">🌅 Ранковий дайджест</h3>
          <p className="text-xs text-fg-muted mt-0.5">
            Раз на день надсилає всі пости дня code-блоками у Telegram — щоб скопіювати й запостити у соцмережі
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Час відправки</label>
            <input
              type="time"
              className="input text-xs font-mono"
              value={schedule.digestTime || ""}
              onChange={(e) => setSchedule((p) => ({ ...p, digestTime: e.target.value || null }))}
              placeholder="09:00"
            />
            <p className="text-[10px] text-fg-subtle mt-1">Залиште порожнім — дайджест вимкнено</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Chat ID для дайджесту</label>
            <input
              className="input text-xs font-mono"
              value={schedule.digestChatId || ""}
              onChange={(e) => setSchedule((p) => ({ ...p, digestChatId: e.target.value || null }))}
              placeholder="-5298664858"
            />
            <p className="text-[10px] text-fg-subtle mt-1">Куди надсилати (може відрізнятись від авто-публікації)</p>
          </div>
        </div>
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
