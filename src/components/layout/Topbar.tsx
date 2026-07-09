"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

const NAV = [
  { href: "/", label: "Контент" },
  { href: "/products", label: "Продукти" },
  { href: "/lead-magnets", label: "Лід-магніти" },
  { href: "/categories", label: "Категорії" },
  { href: "/topics", label: "Теми" },
  { href: "/storage", label: "Сховище" },
  { href: "/content-types", label: "Типи" },
  { href: "/tools", label: "Воронки" },
  { href: "/networks", label: "Мережі" },
  { href: "/stats", label: "Статистика" },
];

interface Props {
  user: { name?: string; email?: string; role?: string };
}

export function Topbar({ user }: Props) {
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="h-10 bg-canvas-subtle border-b border-border flex items-center px-4 gap-0 sticky top-0 z-40 shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-1.5 mr-6 shrink-0">
        <span className="text-base">📋</span>
        <span className="text-xs font-display font-bold text-fg tracking-tight">CP2</span>
      </div>

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
