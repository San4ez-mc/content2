"use client";

import { useState, useEffect, useCallback } from "react";

type ParamField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
};

type ContentTool = {
  id: string;
  slug: string;
  name: string;
  aiDescription: string;
  exampleOutput: string | null;
  paramsSchema: ParamField[];
  isActive: boolean;
  sortOrder: number;
  syncedAt: string | null;
  updatedAt: string;
};

export function ToolsView() {
  const [tools, setTools] = useState<ContentTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<ContentTool>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/tools");
    const data = await res.json();
    setTools(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const sync = async () => {
    setSyncing(true);
    const res = await fetch("/api/tools/sync", { method: "POST" });
    const data = await res.json();
    if (data.ok) await load();
    setSyncing(false);
  };

  const startEdit = (tool: ContentTool) => {
    setEditingId(tool.id);
    setEditDraft({
      aiDescription: tool.aiDescription,
      exampleOutput: tool.exampleOutput ?? "",
      isActive: tool.isActive,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    await fetch("/api/tools", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...editDraft }),
    });
    await load();
    setEditingId(null);
    setSaving(false);
  };

  const toggleActive = async (tool: ContentTool) => {
    await fetch("/api/tools", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tool.id, isActive: !tool.isActive }),
    });
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
        Завантаження...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Воронки генерації</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Список AI-інструментів, які контент-менеджер використовує для генерації зображень та відео.
          </p>
        </div>
        <button
          onClick={sync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {syncing ? (
            <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <span>🔄</span>
          )}
          {syncing ? "Синхронізація..." : "Оновити список воронок"}
        </button>
      </div>

      {tools.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-muted-foreground text-sm mb-4">Список порожній. Натисніть «Оновити список воронок»</p>
          <button
            onClick={sync}
            disabled={syncing}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm"
          >
            Оновити список воронок
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {tools.map((tool) => (
            <div
              key={tool.id}
              className={`bg-card border rounded-xl overflow-hidden transition-colors ${
                tool.isActive ? "border-border" : "border-border opacity-60"
              }`}
            >
              {/* Tool header */}
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-foreground text-sm">{tool.name}</span>
                    <code className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono">
                      {tool.slug}
                    </code>
                    {!tool.isActive && (
                      <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">вимкнено</span>
                    )}
                  </div>
                  {tool.syncedAt && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Синхронізовано: {new Date(tool.syncedAt).toLocaleDateString("uk")}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleActive(tool)}
                    title={tool.isActive ? "Вимкнути" : "Увімкнути"}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    {tool.isActive ? "✓" : "○"}
                  </button>
                  <button
                    onClick={() => editingId === tool.id ? cancelEdit() : startEdit(tool)}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    ✏️
                  </button>
                </div>
              </div>

              {/* Collapsed view */}
              {editingId !== tool.id && (
                <div className="px-4 pb-3 space-y-2">
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-3">
                    <span className="font-medium text-foreground block mb-1">AI опис:</span>
                    {tool.aiDescription}
                  </div>
                  {tool.paramsSchema?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {tool.paramsSchema.map((p) => (
                        <span
                          key={p.key}
                          className={`text-xs px-2 py-0.5 rounded-full font-mono ${
                            p.required
                              ? "bg-primary/10 text-primary border border-primary/20"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {p.key}
                          {p.required ? " *" : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Edit form */}
              {editingId === tool.id && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      AI опис <span className="text-muted-foreground font-normal">(цей текст читає бот при виборі інструменту)</span>
                    </label>
                    <textarea
                      value={editDraft.aiDescription ?? ""}
                      onChange={(e) => setEditDraft((d) => ({ ...d, aiDescription: e.target.value }))}
                      rows={4}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">
                      Приклад результату
                    </label>
                    <textarea
                      value={editDraft.exampleOutput ?? ""}
                      onChange={(e) => setEditDraft((d) => ({ ...d, exampleOutput: e.target.value }))}
                      rows={2}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editDraft.isActive ?? true}
                        onChange={(e) => setEditDraft((d) => ({ ...d, isActive: e.target.checked }))}
                        className="rounded"
                      />
                      Активний
                    </label>
                    <div className="flex-1" />
                    <button
                      onClick={cancelEdit}
                      className="px-3 py-1.5 text-sm rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      Скасувати
                    </button>
                    <button
                      onClick={() => saveEdit(tool.id)}
                      disabled={saving}
                      className="px-3 py-1.5 text-sm rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      {saving ? "Збереження..." : "Зберегти"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bot endpoint hint */}
      <div className="mt-6 bg-muted/50 border border-border rounded-xl p-4">
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Ендпоінт для бота:</span>{" "}
          <code className="font-mono">GET /api/tools/for-bot</code> — повертає активні воронки з описами.
          Контент-менеджер отримує цей список на початку кожної сесії.
        </p>
      </div>
    </div>
  );
}
