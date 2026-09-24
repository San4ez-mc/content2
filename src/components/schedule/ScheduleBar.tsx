"use client";

import { useState } from "react";
import { ScheduleEditor, SCHEDULE_DAYS, type ScheduleSettings } from "./ScheduleEditor";

function summarize(s: ScheduleSettings | null): string {
  if (!s) return "не задано — кожен пост публікується у свій час";
  const parts = SCHEDULE_DAYS
    .map(({ key, label }) => {
      const times = (s as any)[key] as string[];
      return times && times.length ? `${label} ${times.join(", ")}` : null;
    })
    .filter(Boolean) as string[];
  return parts.length ? parts.join(" · ") : "слоти порожні — кожен пост публікується у свій час";
}

export function ScheduleBar({ projectId, initial }: { projectId: string; initial: ScheduleSettings | null }) {
  const [open, setOpen] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleSettings | null>(initial);

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border bg-canvas-subtle text-xs shrink-0">
        <span className="font-medium text-fg-muted">⏰ Розклад публікацій</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-border/40 text-fg-subtle">необов'язково</span>
        <span className="text-fg-subtle truncate">{summarize(schedule)}</span>
        <button onClick={() => setOpen(true)} className="ml-auto text-accent hover:underline shrink-0">
          Налаштувати
        </button>
      </div>

      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="bg-canvas border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-auto animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-canvas z-10">
              <div>
                <h3 className="text-sm font-semibold text-fg">Розклад публікацій</h3>
                <p className="text-[11px] text-fg-subtle mt-0.5">
                  Необов'язково. Без розкладу пост публікується у власний час, вказаний на самому пості.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="text-fg-subtle hover:text-fg text-lg">×</button>
            </div>
            <div className="p-4">
              <ScheduleEditor projectId={projectId} initial={schedule} onSaved={setSchedule} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
