"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function InviteForm({ token, email, projectName }: { token: string; email: string; projectName: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Введіть ім'я"); return; }
    if (password.length < 8) { setError("Пароль мінімум 8 символів"); return; }
    if (password !== password2) { setError("Паролі не співпадають"); return; }

    setSaving(true);
    setError("");

    try {
      const r = await fetch(`/api/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, password }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Помилка"); return; }
      router.push("/login?registered=1");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="text-center mb-8">
        <div className="text-4xl mb-3">🎉</div>
        <h1 className="text-xl font-bold text-fg">Вас запросили!</h1>
        <p className="text-sm text-fg-muted mt-1">
          Приєднайтесь до проекту <span className="font-semibold text-fg">«{projectName}»</span>
        </p>
      </div>

      <div className="bg-canvas-subtle border border-border rounded-xl shadow-lg p-6">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Email</label>
            <input className="input opacity-60 cursor-not-allowed" value={email} readOnly />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Ваше ім'я</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ім'я..."
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Пароль</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Мінімум 8 символів"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Повторіть пароль</label>
            <input
              className="input"
              type="password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              placeholder="Повторіть пароль"
            />
          </div>

          {error && (
            <div className="text-xs text-danger bg-danger/10 border border-danger/20 rounded-lg p-2">{error}</div>
          )}

          <button type="submit" disabled={saving} className="btn-primary w-full py-2.5 text-sm font-medium">
            {saving ? "Реєстрація..." : "Зареєструватись та приєднатись"}
          </button>
        </form>
      </div>
    </div>
  );
}
