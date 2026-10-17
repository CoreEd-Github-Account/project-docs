"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { THEME_PRESETS, applyTheme, getCurrentTheme } from "@/lib/theme";

export default function ThemeSettingsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentThemeId, setCurrentThemeId] = useState<string>("blue");
  const [customHex, setCustomHex] = useState<string>("#3b82f6");
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>("");

  // Live interactive preview state
  const [previewChecked, setPreviewChecked] = useState(true);
  const [previewTab, setPreviewTab] = useState<"projects" | "notepad" | "preview">("notepad");

  // Check auth status
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();
      setIsAuthenticated(Boolean(data.authenticated));
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Read current theme on mount
  useEffect(() => {
    const cur = getCurrentTheme();
    setCurrentThemeId(cur.theme || "blue");
    if (cur.customColor) {
      setCustomHex(cur.customColor);
    }

    // Also fetch saved settings from DB
    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settings) {
          if (data.settings.theme) setCurrentThemeId(data.settings.theme);
          if (data.settings.customColor) setCustomHex(data.settings.customColor);
          applyTheme(data.settings.theme, data.settings.customColor);
        }
      })
      .catch(() => {});
  }, []);

  // Save theme selection (both local and database sync)
  const handleSelectTheme = async (themeId: string, customColorVal?: string) => {
    const colorToSave = themeId === "custom" ? customColorVal || customHex : undefined;
    setCurrentThemeId(themeId);

    // 1. Instant local DOM update
    applyTheme(themeId, colorToSave);

    // 2. Persist to PostgreSQL database
    setIsSaving(true);
    setSaveMessage("Syncing with database...");
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          theme: themeId,
          customColor: colorToSave || null,
        }),
      });

      if (res.ok) {
        setSaveMessage("Theme saved & synced across workspace!");
      } else {
        setSaveMessage("Saved locally (offline mode)");
      }
    } catch {
      setSaveMessage("Saved locally");
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        setSaveMessage("");
      }, 3500);
    }
  };

  const handleApplyCustomColor = () => {
    let hex = customHex.trim();
    if (!hex.startsWith("#")) hex = "#" + hex;
    if (!/^#([0-9A-F]{3}){1,2}$/i.test(hex)) {
      alert("Please enter a valid Hex color code, e.g. #3b82f6 or #8b5cf6");
      return;
    }
    setCustomHex(hex);
    handleSelectTheme("custom", hex);
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
    } finally {
      setIsAuthenticated(false);
      window.location.href = "/";
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Verifying access...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <LoginForm
        onLoginSuccess={() => {
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-blue-600/30 hover:scale-105 transition"
              title="Return to Settings"
            >
              🎨
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <Link
                  href="/settings"
                  className="text-xs text-slate-400 hover:text-white transition"
                >
                  Settings
                </Link>
                <span className="text-xs text-slate-600">/</span>
                <h1 className="text-base font-bold text-white leading-tight">
                  Project Theme
                </h1>
                <span className="text-[11px] font-semibold bg-blue-950/80 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  Dynamic Selector
                </span>
              </div>
              <p className="text-xs text-slate-400">Personalize your workspace aesthetic</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 transition flex items-center gap-1.5"
              title="Back to Settings Dashboard"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Settings</span>
            </Link>

            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 transition"
              title="Home Hub"
            >
              Hub
            </Link>

            <button
              onClick={handleLogout}
              className="text-xs text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/60 px-3 py-1.5 rounded-lg border border-red-500/30 transition cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-8">
        {/* Banner with sync indicator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>Dynamic Project Theme</span>
              {isSaving && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-950/40 border border-amber-500/30 px-2.5 py-0.5 rounded-full animate-pulse">
                  <span className="animate-spin text-[10px]">⟳</span> Syncing...
                </span>
              )}
              {saveMessage && !isSaving && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-0.5 rounded-full transition-all">
                  ✓ {saveMessage}
                </span>
              )}
            </h2>
            <p className="text-sm text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Select an accent palette below. The new theme immediately recolors every action button, active tab, notification badge, task checkbox, and highlight across <strong>Projects</strong>, <strong>Subscriptions</strong>, <strong>Passwords</strong>, and <strong>Prompt Saver</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-slate-400">Database Live Sync:</span>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-950/30 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              Active
            </span>
          </div>
        </div>

        {/* SECTION 1: THEME PRESETS GRID */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <span>Curated Theme Palettes</span>
              <span className="text-xs font-normal text-slate-500">({THEME_PRESETS.length} available)</span>
            </h3>
            <span className="text-xs text-slate-400">Instant 1-Click Activation</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {THEME_PRESETS.map((preset) => {
              const isSelected = currentThemeId === preset.id;
              return (
                <button
                  key={preset.id}
                  onClick={() => handleSelectTheme(preset.id)}
                  className={`group relative p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-slate-900 border-blue-500 ring-2 ring-blue-500/30 shadow-lg shadow-blue-500/10"
                      : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900/90"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Color Gradient Swatch */}
                    <div
                      className="h-16 w-full rounded-lg shadow-inner flex items-center justify-between px-3 relative overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${preset.primaryHex} 0%, ${preset.secondaryHex} 60%, ${preset.bgHex} 100%)`,
                      }}
                    >
                      <div className="w-6 h-6 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-xs font-bold border border-white/30">
                        {preset.name.charAt(0)}
                      </div>

                      {isSelected && (
                        <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold px-2 py-0.5 rounded-full border border-white/20">
                          <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                          Active
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-white text-sm group-hover:text-blue-400 transition-colors">
                          {preset.name}
                        </h4>
                        <span className="text-[11px] font-mono text-slate-400">
                          {preset.primaryHex}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1 leading-snug">
                        {preset.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 mt-3 border-t border-slate-800/60 flex items-center justify-between text-xs">
                    <span className={isSelected ? "font-semibold text-blue-400" : "text-slate-500"}>
                      {isSelected ? "Currently Applied" : "Click to Apply"}
                    </span>
                    <span className="text-slate-500 font-mono text-[10px]">
                      theme: {preset.id}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* SECTION 2: CUSTOM HEX COLOR PICKER */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Custom Brand Hex Color</span>
                {currentThemeId === "custom" && (
                  <span className="text-[11px] font-semibold bg-blue-950/80 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                    Active Theme
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Have a specific brand or accent color? Enter any custom hex color or pick from the palette picker.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Color preview tile */}
            <div className="relative">
              <input
                type="color"
                value={customHex.startsWith("#") ? customHex : `#${customHex}`}
                onChange={(e) => setCustomHex(e.target.value)}
                className="w-11 h-11 rounded-lg border-2 border-slate-700 bg-transparent cursor-pointer p-0.5"
                title="Open color picker"
              />
            </div>

            {/* Hex input */}
            <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
              <span className="text-slate-500 font-mono mr-1">#</span>
              <input
                type="text"
                value={customHex.replace("#", "")}
                onChange={(e) => setCustomHex("#" + e.target.value.replace(/[^0-9A-Fa-f]/g, ""))}
                placeholder="3b82f6"
                maxLength={6}
                className="bg-transparent text-white font-mono uppercase text-sm focus:outline-none w-24"
              />
            </div>

            <button
              onClick={handleApplyCustomColor}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold transition cursor-pointer shadow-md shadow-blue-600/30 flex items-center gap-2"
            >
              <span>Apply Custom Color</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </button>
          </div>
        </div>

        {/* SECTION 3: LIVE INTERACTIVE PREVIEW SHOWCASE */}
        <div className="p-6 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>Live Interactive Component Preview</span>
                <span className="text-xs text-slate-500 font-normal">(Real-time demonstration)</span>
              </h3>
              <p className="text-xs text-slate-400">
                Notice how all elements dynamically reflect your theme colors without refreshing.
              </p>
            </div>
            <span className="text-xs font-mono text-blue-400 bg-blue-950/60 border border-blue-500/30 px-2.5 py-1 rounded-md">
              data-theme=&quot;{currentThemeId}&quot;
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Column 1: Buttons & Interactive Tabs */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Primary Buttons & Tabs
              </p>

              {/* Sample Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                <button
                  onClick={() => setPreviewTab("notepad")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    previewTab === "notepad"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  📝 Task Notepad
                </button>
                <button
                  onClick={() => setPreviewTab("projects")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    previewTab === "projects"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  📁 Projects (14)
                </button>
                <button
                  onClick={() => setPreviewTab("preview")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                    previewTab === "preview"
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  }`}
                >
                  👁️ Markdown View
                </button>
              </div>

              {/* Sample Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs rounded-lg shadow-md shadow-blue-600/20 transition cursor-pointer">
                  + Add New Task
                </button>
                <button className="px-4 py-2 bg-blue-950/60 hover:bg-blue-900/60 text-blue-300 border border-blue-500/30 font-medium text-xs rounded-lg transition cursor-pointer">
                  Export Document
                </button>
                <span className="text-xs text-blue-400 font-semibold cursor-pointer hover:underline">
                  Quick Action →
                </span>
              </div>
            </div>

            {/* Column 2: Interactive Task Card & Checkbox */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Task Card & Checkbox Sync
              </p>

              <div className="p-4 rounded-xl bg-slate-950 border border-blue-500/40 shadow-sm space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-400">
                    High Priority Task #104
                  </span>
                  <span className="text-[10px] bg-blue-950 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-medium">
                    In Progress
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="preview-task-chk"
                    checked={previewChecked}
                    onChange={(e) => setPreviewChecked(e.target.checked)}
                    className="w-4 h-4 mt-0.5 text-blue-600 bg-slate-800 border-slate-700 rounded focus:ring-blue-500 cursor-pointer accent-blue-600"
                  />
                  <label htmlFor="preview-task-chk" className="text-xs text-slate-300 leading-snug cursor-pointer select-none">
                    Configure theme color tokens across workspace portal and verify database synchronization.
                  </label>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                    Updated 2 minutes ago
                  </span>
                  <span className="text-blue-400 font-medium">100% Synced</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 4: DIRECT WORKSPACE NAVIGATION */}
        <div className="p-6 rounded-2xl bg-slate-900/50 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-white">
              Ready to explore your workspace with the new theme?
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Switch directly to any section to see the vibrant accent colors applied everywhere.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/projects"
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition cursor-pointer shadow-md shadow-blue-600/20"
            >
              Open Projects →
            </Link>
            <Link
              href="/subscriptions"
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
            >
              Subscriptions →
            </Link>
            <Link
              href="/passwords"
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
            >
              Passwords →
            </Link>
            <Link
              href="/prompts"
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium border border-slate-700 transition"
            >
              Prompts →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
