"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const NAV = [
  { href: "/", label: "Контент" },
  { href: "/products", label: "Продукти" },
  { href: "/personas", label: "Персони" },
  { href: "/lead-magnets", label: "Лід-магніти" },
  { href: "/topics", label: "Теми" },
  { href: "/storage", label: "Сховище" },
  { href: "/structures", label: "Структури" },
  { href: "/tools", label: "Воронки" },
  { href: "/networks", label: "Мережі" },
  { href: "/stats", label: "Статистика" },
];

interface Props {
  user: { name?: string; email?: string; role?: string };
  projects: { id: string; name: string }[];
  activeProject: { id: string; name: string } | null;
}

export function Topbar({ user, projects, activeProject }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  async function switchProject(projectId: string) {
    if (!projectId || projectId === activeProject?.id) return;
    setSwitching(true);
    try {
      await fetch("/api/active-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      router.refresh();
    } finally {
      setSwitching(false);
    }
  }

  return (
    <header className="h-10 bg-canvas-subtle border-b border-border flex items-center px-4 gap-0 sticky top-0 z-40 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-1.5 mr-3 shrink-0">
        <span className="text-base">📋</span>
        <span className="text-xs font-display font-bold text-fg tracking-tight">CP2</span>
      </div>

      {/* Company switcher — active company for every page in the dashboard */}
      {projects.length > 1 && (
        <select
          value={activeProject?.id || ""}
          onChange={(e) => switchProject(e.target.value)}
          disabled={switching}
          title="Активна компанія"
          className="text-xs bg-canvas border border-border rounded px-2 py-1 text-fg mr-4 max-w-40 shrink-0 disabled:opacity-50"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      )}

      {/* Nav — hidden on mobile (use bottom MobileNav instead) */}
      <nav className="hidden sm:flex items-center gap-0.5 flex-1">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1 rounded text-xs font-medium transition-colors duration-150",
                active
                  ? "text-fg bg-border/60"
                  : "text-fg-muted hover:text-fg hover:bg-border/30"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Right */}
      <div className="flex items-center gap-2 shrink-0">
        <NotificationBell />
        <ThemeToggle />

        {/* User dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="flex items-center gap-1.5 px-2 py-1 rounded hover:bg-border/40 transition-colors"
          >
            <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-xs font-medium text-accent">
              {user.name?.[0]?.toUpperCase() || "U"}
            </div>
            <span className="text-xs text-fg-muted max-w-24 truncate hidden sm:block">
              {user.name || user.email}
            </span>
            <span className="text-fg-subtle text-xs">▾</span>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-44 bg-canvas-subtle border border-border rounded-lg shadow-xl z-50 py-1 animate-slide-up">
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-medium text-fg truncate">{user.name}</p>
                <p className="text-xs text-fg-subtle truncate">{user.email}</p>
              </div>
              <Link
                href="/user-data"
                className="flex items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:text-fg hover:bg-border/30 transition-colors"
                onClick={() => setDropdownOpen(false)}
              >
                📄 Дані користувача
              </Link>
              {user.role === "superadmin" && (
                <Link
                  href="/admin"
                  className="flex items-center gap-2 px-3 py-2 text-xs text-fg-muted hover:text-fg hover:bg-border/30 transition-colors"
                  onClick={() => setDropdownOpen(false)}
                >
                  ⚙️ Адмін панель
                </Link>
              )}
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-danger hover:bg-danger/10 transition-colors"
              >
                🚪 Вийти
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
