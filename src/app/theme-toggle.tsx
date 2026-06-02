"use client";

import { useEffect, useState } from "react";

const themes = [
  { id: "classic", label: "Clásico" },
  { id: "forest", label: "Bosque" },
  { id: "night", label: "Noche" },
] as const;

type ThemeId = (typeof themes)[number]["id"];

const storageKey = "grade-law-study-theme";

function isThemeId(value: string | null): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return "classic";

    const savedTheme = window.localStorage.getItem(storageKey);
    return isThemeId(savedTheme) ? savedTheme : "classic";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(storageKey, theme);
  }, [theme]);

  function changeTheme(nextTheme: ThemeId) {
    setTheme(nextTheme);
  }

  return (
    <div className="theme-toggle" aria-label="Selector de tema">
      <span>Tema</span>
      <div>
        {themes.map((item) => (
          <button
            key={item.id}
            type="button"
            className={theme === item.id ? "active" : ""}
            onClick={() => changeTheme(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
