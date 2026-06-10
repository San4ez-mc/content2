"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface UserRecord {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  projects: { id: string; name: string; role: string }[];
}

interface Project {
  id: string;
  name: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  usedAt: string | null;
  expiresAt: string;
  createdAt: string;
  project: { name: string };
}

interface Props {
  users: UserRecord[];
  projects: Project[];
}

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
  superadmin: { label: "Superadmin", color: "#ef4444" },
  admin: { label: "Admin", color: "#f59e0b" },
  client: { label: "Client", color: "#3b82f6" },
};

export function AdminView({ users: initial, projects }: Props) {
  const [users, setUsers] = useState(initial);
  const [showAddUser, setShowAddUser] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "projects" | "invitations">("users");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);

  const { data: invitations = [], refetch: refetchInvitations } = useQuery<Invitation[]>({
    queryKey: ["invitations"],
    queryFn: () => fetch("/api/admin/invitations").then((r) => r.json()),
    enabled: activeTab === "invitations",
  });

  async function refreshUsers() {
    const r = await fetch("/api/admin/users");
    const data = await r.json();
    setUsers(data);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-40px)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-canvas-subtle shrink-0">
        <div className="flex items-center gap-1">
          {(["users", "projects", "invitations"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={cn("px-3 py-1 rounded text-xs font-medium transition-colors",
                activeTab === t ? "bg-accent text-white" : "text-fg-muted hover:text-fg hover:bg-border/30"
              )}
            >
              {t === "users" ? "👥 Користувачі" : t === "projects" ? "📋 Проекти" : "✉️ Запрошення"}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          {activeTab === "users" && (
            <button onClick={() => setShowAddUser(true)} className="btn-primary text-xs px-3 py-1">
              + Користувач
            </button>
          )}
          {activeTab === "invitations" && (
            <button onClick={() => setShowInvite(true)} className="btn-primary text-xs px-3 py-1">
              ✉️ Запросити
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 max-w-4xl">
        {activeTab === "users" ? (
          <div className="space-y-2">
            {users.map((u) => {
              const roleInfo = ROLE_LABELS[u.role] || { label: u.role, color: "#64748b" };
              return (
                <div key={u.id} className="flex items-center gap-4 p-4 bg-canvas-subtle border border-border rounded-xl">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                    style={{ backgroundColor: roleInfo.color + "22", color: roleInfo.color }}>
                    {u.name?.[0]?.toUpperCase() || "U"}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-fg">{u.name}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: roleInfo.color + "22", color: roleInfo.color }}
                      >
                        {roleInfo.label}
                      </span>
                    </div>
                    <p className="text-xs text-fg-muted">{u.email}</p>
                    {u.projects.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {u.projects.map((p) => (
                          <span key={p.id} className="text-[10px] px-1.5 py-0.5 bg-border/40 text-fg-subtle rounded">
                            {p.name} ({p.role})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <span className="text-xs text-fg-subtle shrink-0">
                    {new Date(u.createdAt).toLocaleDateString("uk-UA")}
                  </span>
                </div>
              );
            })}
          </div>
        ) : activeTab === "projects" ? (
          <div className="space-y-2">
            {projects.map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-4 bg-canvas-subtle border border-border rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-accent/20 flex items-center justify-center text-lg shrink-0">📋</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-fg">{p.name}</p>
                  <p className="text-xs text-fg-subtle font-mono">{p.id}</p>
                </div>
                <span className="text-xs text-fg-subtle">
                  {users.filter((u) => u.projects.some((up) => up.id === p.id)).length} користувачів
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {invitations.length === 0 && (
              <div className="text-center py-8 text-sm text-fg-muted">Немає запрошень</div>
            )}
            {invitations.map((inv) => {
              const used = !!inv.usedAt;
              const expired = !used && new Date() > new Date(inv.expiresAt);
              return (
                <div key={inv.id} className="flex items-center gap-4 p-4 bg-canvas-subtle border border-border rounded-xl">
                  <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0",
                    used ? "bg-success/20 text-success" : expired ? "bg-danger/20 text-danger" : "bg-accent/20 text-accent")}>
                    {used ? "✓" : expired ? "!" : "✉"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-fg truncate">{inv.email}</p>
                    <p className="text-xs text-fg-muted">{inv.project.name} · {inv.role}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={cn("text-xs font-medium",
                      used ? "text-success" : expired ? "text-danger" : "text-accent")}>
                      {used ? "Використано" : expired ? "Застаріло" : "Активне"}
                    </p>
                    <p className="text-[10px] text-fg-subtle">
                      до {new Date(inv.expiresAt).toLocaleDateString("uk-UA")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAddUser && (
        <AddUserModal
          projects={projects}
          onClose={() => setShowAddUser(false)}
          onAdded={() => { refreshUsers(); setShowAddUser(false); }}
        />
      )}
      {showInvite && (
        <InviteModal
          projects={projects}
          onClose={() => { setShowInvite(false); setInviteUrl(null); }}
          onCreated={(url) => { setInviteUrl(url); refetchInvitations(); }}
        />
      )}
      {inviteUrl && !showInvite && (
        <div className="modal-backdrop" onClick={() => setInviteUrl(null)}>
          <div className="bg-canvas-subtle border border-border rounded-xl shadow-2xl w-full max-w-md p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">✅</div>
              <h3 className="text-sm font-semibold text-fg">Запрошення створено!</h3>
              <p className="text-xs text-fg-muted mt-1">Поділіться цим посиланням з користувачем</p>
            </div>
            <div className="flex gap-2">
              <input className="input flex-1 text-xs" value={inviteUrl} readOnly />
              <button
                onClick={() => navigator.clipboard.writeText(inviteUrl)}
                className="btn-primary text-xs px-3"
              >
                📋 Копіювати
              </button>
            </div>
            <button onClick={() => setInviteUrl(null)} className="btn-ghost w-full text-xs py-2 mt-3">Закрити</button>
          </div>
        </div>
      )}
    </div>
  );
}

function InviteModal({ projects, onClose, onCreated }: { projects: Project[]; onClose: () => void; onCreated: (url: string) => void }) {
  const [email, setEmail] = useState("");
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [role, setRole] = useState("editor");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!email || !projectId) { setError("Заповніть всі поля"); return; }
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, projectId, projectRole: role }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Помилка"); return; }
      onCreated(data.inviteUrl);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="bg-canvas-subtle border border-border rounded-xl shadow-2xl w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-fg">✉️ Запросити користувача</h3>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg text-lg">×</button>
        </div>
        <div className="p-5 space-y-3">
          {error && <div className="text-xs text-danger bg-danger/10 rounded-lg p-2">{error}</div>}
          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Проект</label>
              <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Роль</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="viewer">Viewer (читання)</option>
                <option value="editor">Editor (редагування)</option>
                <option value="owner">Owner (власник)</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-fg-subtle">Посилання буде дійсним 7 днів</p>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="btn-ghost flex-1 text-xs py-2">Скасувати</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 text-xs py-2">
            {saving ? "Створення..." : "Надіслати запрошення"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddUserModal({ projects, onClose, onAdded }: { projects: Project[]; onClose: () => void; onAdded: () => void }) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("client");
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [projectRole, setProjectRole] = useState("viewer");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    if (!email || !name || !password) { setError("Заповніть всі поля"); return; }
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name, password, role, projectId: projectId || undefined, projectRole }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error || "Помилка"); return; }
      onAdded();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="bg-canvas-subtle border border-border rounded-xl shadow-2xl w-full max-w-md animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-fg">Новий користувач</h3>
          <button onClick={onClose} className="text-fg-subtle hover:text-fg text-lg">×</button>
        </div>

        <div className="p-5 space-y-3">
          {error && <div className="text-xs text-danger bg-danger/10 rounded-lg p-2">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Ім'я</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ім'я..." autoFocus />
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Роль</label>
              <select className="input" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="client">Client</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@example.com" />
          </div>

          <div>
            <label className="block text-xs font-medium text-fg-muted mb-1.5">Пароль</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Мінімум 8 символів" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Проект</label>
              <select className="input" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">Без проекту</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-fg-muted mb-1.5">Роль в проекті</label>
              <select className="input" value={projectRole} onChange={(e) => setProjectRole(e.target.value)}>
                <option value="viewer">Viewer (читання)</option>
                <option value="editor">Editor (редагування)</option>
                <option value="owner">Owner (власник)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="btn-ghost flex-1 text-xs py-2">Скасувати</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 text-xs py-2">
            {saving ? "Створення..." : "Створити"}
          </button>
        </div>
      </div>
    </div>
  );
}
