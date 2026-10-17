export interface ThemePreset {
  id: string;
  name: string;
  description: string;
  primaryHex: string;
  secondaryHex: string;
  bgHex: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: "blue",
    name: "Sapphire Blue",
    description: "Classic deep blue (Default)",
    primaryHex: "#2563eb",
    secondaryHex: "#3b82f6",
    bgHex: "#172554",
  },
  {
    id: "emerald",
    name: "Emerald Green",
    description: "Cyberpunk mint & forest glow",
    primaryHex: "#059669",
    secondaryHex: "#10b981",
    bgHex: "#022c22",
  },
  {
    id: "violet",
    name: "Electric Violet",
    description: "Vibrant neon violet & indigo",
    primaryHex: "#7c3aed",
    secondaryHex: "#8b5cf6",
    bgHex: "#2e1065",
  },
  {
    id: "rose",
    name: "Neon Rose",
    description: "Modern crimson & hot magenta",
    primaryHex: "#e11d48",
    secondaryHex: "#f43f5e",
    bgHex: "#4c0519",
  },
  {
    id: "amber",
    name: "Amber Gold",
    description: "Warm honey & industrial amber",
    primaryHex: "#d97706",
    secondaryHex: "#f59e0b",
    bgHex: "#451a03",
  },
  {
    id: "cyan",
    name: "Arctic Cyan",
    description: "Crisp turquoise & glacier blue",
    primaryHex: "#0891b2",
    secondaryHex: "#06b6d4",
    bgHex: "#083344",
  },
  {
    id: "orange",
    name: "Sunset Orange",
    description: "High-energy blaze & coral glow",
    primaryHex: "#ea580c",
    secondaryHex: "#f97316",
    bgHex: "#431407",
  },
  {
    id: "teal",
    name: "Oceanic Teal",
    description: "Deep sea dark teal & aquamarine",
    primaryHex: "#0d9488",
    secondaryHex: "#14b8a6",
    bgHex: "#042f2e",
  },
  {
    id: "purple",
    name: "Royal Purple",
    description: "Deep luxury amethyst",
    primaryHex: "#9333ea",
    secondaryHex: "#a855f7",
    bgHex: "#3b0764",
  },
];

// Helper to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (clean.length === 6) {
    return {
      r: parseInt(clean.substring(0, 2), 16),
      g: parseInt(clean.substring(2, 4), 16),
      b: parseInt(clean.substring(4, 6), 16),
    };
  }
  return null;
}

// Mix two colors: color1 with color2 by weight (0 = color1, 1 = color2)
function mixColors(c1: { r: number; g: number; b: number }, c2: { r: number; g: number; b: number }, weight: number): string {
  const w = Math.max(0, Math.min(1, weight));
  const r = Math.round(c1.r * (1 - w) + c2.r * w);
  const g = Math.round(c1.g * (1 - w) + c2.g * w);
  const b = Math.round(c1.b * (1 - w) + c2.b * w);
  return `rgb(${r}, ${g}, ${b})`;
}

// Generate complete 50..950 palette from any custom hex
export function generateCustomScale(hex: string): Record<string, string> {
  const base = hexToRgb(hex) || { r: 37, g: 99, b: 235 };
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 0, g: 0, b: 0 };

  return {
    "--color-blue-50": mixColors(base, white, 0.92),
    "--color-blue-100": mixColors(base, white, 0.8),
    "--color-blue-200": mixColors(base, white, 0.65),
    "--color-blue-300": mixColors(base, white, 0.45),
    "--color-blue-400": mixColors(base, white, 0.25),
    "--color-blue-500": `rgb(${base.r}, ${base.g}, ${base.b})`,
    "--color-blue-600": mixColors(base, black, 0.15),
    "--color-blue-700": mixColors(base, black, 0.3),
    "--color-blue-800": mixColors(base, black, 0.5),
    "--color-blue-900": mixColors(base, black, 0.7),
    "--color-blue-950": mixColors(base, black, 0.85),
  };
}

const SCALE_KEYS = [
  "--color-blue-50",
  "--color-blue-100",
  "--color-blue-200",
  "--color-blue-300",
  "--color-blue-400",
  "--color-blue-500",
  "--color-blue-600",
  "--color-blue-700",
  "--color-blue-800",
  "--color-blue-900",
  "--color-blue-950",
];

export function applyTheme(themeId: string, customColor?: string) {
  if (typeof window === "undefined") return;

  const root = document.documentElement;

  if (themeId === "custom" && customColor) {
    root.setAttribute("data-theme", "custom");
    const scale = generateCustomScale(customColor);
    Object.entries(scale).forEach(([prop, val]) => {
      root.style.setProperty(prop, val);
    });
  } else {
    // Clear inline scale overrides if returning to preset
    SCALE_KEYS.forEach((key) => {
      root.style.removeProperty(key);
    });
    root.setAttribute("data-theme", themeId || "blue");
  }

  try {
    localStorage.setItem(
      "app_theme",
      JSON.stringify({
        theme: themeId,
        customColor: customColor || "",
      })
    );
  } catch {}

  window.dispatchEvent(
    new CustomEvent("app_theme_changed", {
      detail: { theme: themeId, customColor },
    })
  );
}

export function getCurrentTheme(): { theme: string; customColor?: string } {
  if (typeof window === "undefined") return { theme: "blue" };

  try {
    const raw = localStorage.getItem("app_theme");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.theme) {
        return {
          theme: parsed.theme,
          customColor: parsed.customColor,
        };
      }
    }
  } catch {}

  const currentAttr = document.documentElement.getAttribute("data-theme");
  return { theme: currentAttr || "blue" };
}
