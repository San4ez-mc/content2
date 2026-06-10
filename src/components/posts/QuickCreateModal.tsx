"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  date: string;
  projectId: string;
  socialNetworks: { id: string; name: string; platformKey: string }[];
  onClose: () => void;
  onCreated: () => void;
}

const POST_TYPES = [
  { value: "single", label: "📝 Single" },
  { value: "carousel", label: "🎠 Carousel" },
  { value: "thread_chain", label: "🧵 Thread chain" },
  { value: "stories", label: "📱 Stories" },
];

export function QuickCreateModal({ date, projectId, socialNetworks, onClose, onCreated }: Props) {
  const [networkId, setNetworkId] = useState(socialNetworks[0]?.id || "");
  const [type, setType] = useState("single");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(false);

  async function create() {
    setLoading(true);
    try {
      await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          socialNetworkId: networkId,
          postDate: date,
          type,
          status,
          content,
        }),
      });
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  async function createWithAI() {
    setLoading(true);
    try {
      await fetch("/api/posts/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          socialNetworkId: networkId,
          postDate: date,
          type,
          prompt: content,
        }),
      });
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  const displayDate = new Date(date).toLocaleDateString("uk-UA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-canvas-subtle border border-border rounded-xl shadow-2xl w-full max-w-md animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-fg">Новий пост</h3>
            <p className="text-xs text-fg-muted mt-0.5">{displayDate}</p>
          </div>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg text-lg">×</button>
        </div>

        <div className="p-5 space-y-4">
          {/* Network + Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Платформа</label>
              <select
                className="input"
                value={networkId}
                onChange={(e) => setNetworkId(e.target.value)}
              >
                {socialNetworks.map((n) => (
                  <option key={n.id} value={n.id}>{n.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Тип</label>
              <select
                className="input"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {POST_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Content / AI prompt */}
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">
              Текст або запит до AI
            </label>
            <textarea
              className="input min-h-24 resize-none text-xs"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Введіть текст поста або опишіть AI що генерувати..."
              autoFocus
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Статус</label>
            <div className="flex gap-2">
              {["draft", "scheduled"].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "flex-1 py-1.5 text-xs rounded border transition-colors",
                    status === s
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-fg-muted hover:border-border/80"
                  )}
                >
                  {s === "draft" ? "Чернетка" : "Заплановано"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button
            onClick={create}
            disabled={loading}
            className="btn-ghost flex-1 justify-center text-xs py-2"
          >
            Зберегти чернетку
          </button>
          <button
            onClick={createWithAI}
            disabled={loading || !content}
            className="btn-primary flex-1 justify-center text-xs py-2"
          >
            ⚡ Генерувати з AI
          </button>
        </div>
      </div>
    </div>
  );
}
