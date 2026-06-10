"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  postGroupId: string | null;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: async () => {
      const r = await fetch("/api/notifications");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const unread = data?.filter((n) => !n.readAt).length || 0;

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-7 h-7 flex items-center justify-center rounded hover:bg-border/40 transition-colors relative"
      >
        <span className="text-sm">🔔</span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 w-80 bg-canvas-subtle border border-border rounded-xl shadow-2xl z-50 animate-slide-up overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-xs font-semibold text-fg">Сповіщення</h3>
              {unread > 0 && (
                <span className="text-xs text-accent">{unread} нових</span>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {!data?.length ? (
                <div className="px-4 py-6 text-center text-xs text-fg-muted">
                  Немає сповіщень
                </div>
              ) : (
                data.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => !n.readAt && markRead.mutate(n.id)}
                    className={cn(
                      "px-4 py-3 border-b border-border/50 cursor-pointer hover:bg-border/20 transition-colors",
                      !n.readAt && "bg-accent/5"
                    )}
                  >
                    <div className="flex items-start gap-2">
                      <span className="text-sm mt-0.5">
                        {n.type === "generation_done"
                          ? "✅"
                          : n.type === "generation_failed"
                          ? "❌"
                          : "📅"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-fg">{n.title}</p>
                        <p className="text-xs text-fg-muted mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                        <p className="text-[10px] text-fg-subtle mt-1">
                          {new Date(n.createdAt).toLocaleTimeString("uk-UA", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      {!n.readAt && (
                        <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
