"use client";

import { useEffect } from "react";
import { applyTheme } from "@/lib/theme";

export function ThemeSync() {
  useEffect(() => {
    // 1. Initial local restoration
    try {
      const raw = localStorage.getItem("app_theme");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.theme) {
          applyTheme(parsed.theme, parsed.customColor);
        }
      }
    } catch {}

    // 2. Background sync with database settings table
    let isMounted = true;
    fetch("/api/settings")
      .then((res) => {
        if (!res.ok) return null;
        return res.json();
      })
      .then((data) => {
        if (!isMounted || !data || !data.settings) return;
        const { theme, customColor } = data.settings;
        if (theme) {
          applyTheme(theme, customColor);
        }
      })
      .catch(() => {
        // Silently ignore if unauthenticated or offline
      });

    // 3. Multi-tab synchronization
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "app_theme" && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.theme) {
            applyTheme(parsed.theme, parsed.customColor);
          }
        } catch {}
      }
    };

    window.addEventListener("storage", handleStorage);
    return () => {
      isMounted = false;
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  return null;
}
