"use client";

import { useState, useRef, useEffect } from "react";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

const QUICK_PROMPTS = [
  "Згенеруй 3 пости на завтра",
  "Покажи план на цей тиждень",
  "Які пости заплановано сьогодні?",
  "Створи категорію",
];

export function ChatPanel() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [sessionKey, setSessionKey] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load/create chat session
  useEffect(() => {
    if (!open || sessionKey) return;
    fetch("/api/chat/session", { method: "POST" })
      .then((r) => r.json())
      .then((data) => {
        setSessionKey(data.sessionKey);
        setMessages(data.messages || []);
      });
  }, [open, sessionKey]);

  // SSE for incoming replies
  useEffect(() => {
    if (!open || !sessionKey) return;

    // SSE is project-scoped; replies come through broadcastToProject
    // Chat replies will be caught by the parent SSE hook
    // For simplicity, we poll via React Query or listen to custom events
    const handler = (e: CustomEvent) => {
      if (e.detail.type === "chat_reply" && e.detail.sessionKey === sessionKey) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now().toString(),
            role: "assistant",
            content: e.detail.text,
            createdAt: new Date().toISOString(),
          },
        ]);
        setSending(false);
      }
    };

    window.addEventListener("sse_event" as any, handler);
    return () => window.removeEventListener("sse_event" as any, handler);
  }, [open, sessionKey]);

  async function send(text: string) {
    if (!text.trim() || sending || !sessionKey) return;
    setSending(true);
    setInput("");

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionKey, text }),
    });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <>
      {/* FAB */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-2xl transition-all duration-200",
          open
            ? "bg-danger hover:bg-danger/80 text-white"
            : "bg-gradient-to-br from-accent to-accent-muted hover:scale-105 text-white"
        )}
        title="AI Асистент"
      >
        {open ? "×" : "🤖"}
      </button>

      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Panel */}
      <div
        className={cn(
          "fixed top-0 right-0 bottom-0 z-50 w-96 max-w-full bg-canvas-subtle border-l border-border flex flex-col shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-accent-muted to-accent border-b border-border shrink-0">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-lg">🤖</div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-white">Content AI</p>
            <p className="text-xs text-white/70">Управляю контентом</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors"
          >
            ×
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <div className="text-3xl mb-3">👋</div>
              <p className="text-xs text-fg-muted">
                Привіт! Я можу генерувати контент, керувати постами, категоріями та налаштуваннями.
              </p>
              <div className="mt-4 space-y-2">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="block w-full text-left px-3 py-2 rounded-lg text-xs text-fg-muted bg-border/30 hover:bg-border/50 hover:text-fg transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap",
                msg.role === "user"
                  ? "bg-accent text-white ml-auto rounded-br-sm"
                  : "bg-border/40 text-fg rounded-bl-sm"
              )}
            >
              {msg.content}
            </div>
          ))}

          {sending && (
            <div className="bg-border/40 rounded-2xl rounded-bl-sm px-4 py-2.5 text-xs text-fg-muted max-w-[85%]">
              <span className="animate-pulse">●●●</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 p-3 border-t border-border bg-canvas shrink-0">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Написати AI..."
            rows={1}
            className="flex-1 resize-none bg-canvas-subtle border border-border rounded-xl px-3 py-2 text-xs text-fg placeholder:text-fg-subtle outline-none focus:border-accent transition-colors min-h-9 max-h-28"
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || sending}
            className="w-9 h-9 rounded-xl bg-accent hover:bg-accent-hover disabled:bg-border disabled:cursor-not-allowed text-white flex items-center justify-center shrink-0 transition-colors"
          >
            ↑
          </button>
        </div>
      </div>
    </>
  );
}
