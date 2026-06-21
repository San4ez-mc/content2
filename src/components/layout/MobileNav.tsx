"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", icon: "📅", label: "Контент" },
  { href: "/categories", icon: "📁", label: "Категорії" },
  { href: "/topics", icon: "💡", label: "Теми" },
  { href: "/networks", icon: "🌐", label: "Мережі" },
  { href: "/stats", icon: "📊", label: "Статистика" },
  { href: "/storage", icon: "🗄️", label: "Сховище" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-canvas-subtle border-t border-border">
      <div className="flex items-center">
        {NAV.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 py-2 transition-colors",
                active ? "text-accent" : "text-fg-muted"
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span className="text-[9px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
