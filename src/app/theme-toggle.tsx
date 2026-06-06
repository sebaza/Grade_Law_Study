"use client";

import { useEffect, useSyncExternalStore } from "react";

const themes = [
  { id: "classic", label: "Clásico" },
  { id: "forest", label: "Bosque" },
  { id: "night", label: "Noche" },
] as const;

type ThemeId = (typeof themes)[number]["id"];

const storageKey = "grade-law-study-theme";
const themeChangeEvent = "grade-law-study-theme-change";

function isThemeId(value: string | null): value is ThemeId {
  return themes.some((theme) => theme.id === value);
}

function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") return "classic";

  const savedTheme = window.localStorage.getItem(storageKey);
  return isThemeId(savedTheme) ? savedTheme : "classic";
}

function subscribeToThemeChanges(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(themeChangeEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(themeChangeEvent, onStoreChange);
  };
}

export function ThemeToggle({ inline = false }: { inline?: boolean }) {
  const theme = useSyncExternalStore(subscribeToThemeChanges, getStoredTheme, () => "classic");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  function changeTheme(nextTheme: ThemeId) {
    window.localStorage.setItem(storageKey, nextTheme);
    window.dispatchEvent(new Event(themeChangeEvent));
  }

  return (
    <div className={inline ? "theme-toggle-inline" : "theme-toggle"} aria-label="Selector de tema">
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
