"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [dark, setDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isDark = saved !== "light";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
    document.documentElement.classList.toggle("light", !isDark);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    localStorage.setItem("theme", next ? "dark" : "light");
    document.documentElement.classList.toggle("dark", next);
    document.documentElement.classList.toggle("light", !next);
  }

  return (
    <button
      onClick={toggle}
      title={dark ? "Увімкнути світлу тему" : "Увімкнути темну тему"}
      className="w-7 h-7 flex items-center justify-center rounded hover:bg-border/40 transition-colors text-sm"
    >
      {dark ? "☀️" : "🌙"}
    </button>
  );
}
