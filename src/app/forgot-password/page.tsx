"use client";

import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [devLink, setDevLink] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setDevLink("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.message || "Готово.");
      if (data.devLink) setDevLink(data.devLink);
    } catch {
      setMessage("Сталася помилка. Спробуй ще раз.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl mb-2">🔑</div>
          <h1 className="text-xl font-display font-bold text-fg">Відновлення пароля</h1>
          <p className="text-sm text-fg-muted mt-1">Вкажи email — надішлемо посилання</p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Email</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
              {loading ? "Надсилаю..." : "Надіслати посилання"}
            </button>
          </form>

          {message && (
            <p className="text-xs text-fg-muted mt-4">{message}</p>
          )}
          {devLink && (
            <div className="mt-3 text-xs">
              <p className="text-fg-muted mb-1">Локальне посилання (без пошти):</p>
              <a href={devLink} className="text-primary underline break-all">{devLink}</a>
            </div>
          )}

          <div className="text-center mt-4">
            <a href="/login" className="text-xs text-fg-muted hover:text-fg underline">
              ← Назад до входу
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
