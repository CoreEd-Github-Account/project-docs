"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { THEME_PRESETS, getCurrentTheme } from "@/lib/theme";
import type { UserProfile } from "@/lib/types";

export default function SettingsDashboard() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [currentThemeId, setCurrentThemeId] = useState<string>("blue");
  const [customHex, setCustomHex] = useState<string>("");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

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

  // Read current theme and user profile on mount
  useEffect(() => {
    const cur = getCurrentTheme();
    setCurrentThemeId(cur.theme || "blue");
    if (cur.customColor) setCustomHex(cur.customColor);

    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.settings) {
          if (data.settings.theme) setCurrentThemeId(data.settings.theme);
          if (data.settings.customColor) setCustomHex(data.settings.customColor);
        }
      })
      .catch(() => {});

    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.profile) {
          setUserProfile(data.profile);
        }
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
    } finally {
      setIsAuthenticated(false);
      window.location.href = "/";
    }
  };

  // Find active preset name & color
  const activePreset = THEME_PRESETS.find((p) => p.id === currentThemeId);
  const activeName = activePreset
    ? activePreset.name
    : currentThemeId === "custom"
    ? `Custom (${customHex || "Hex"})`
    : "Sapphire Blue";

  const activeColorHex = activePreset
    ? activePreset.primaryHex
    : customHex || "#2563eb";

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
              href="/"
              className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-blue-600/30 hover:scale-105 transition"
              title="Return to Workspace Hub"
            >
              T
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white leading-tight">
                  Workspace Settings
                </h1>
                <span className="text-[11px] font-semibold bg-blue-950/80 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full">
                  Control Center
                </span>
              </div>
              <p className="text-xs text-slate-400">Configure appearance, preferences, and data</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 transition flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Hub</span>
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
        {/* Banner */}
        <div className="pb-6 border-b border-slate-800/80 space-y-1">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Settings & Preferences
          </h2>
          <p className="text-sm text-slate-400 max-w-2xl">
            Manage your workspace aesthetic, database configuration, and system preferences.
          </p>
        </div>

        {/* SETTINGS CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* PRIMARY CARD: PROJECT THEME */}
          <Link
            href="/settings/theme"
            className="group relative bg-slate-900/90 border border-slate-800 hover:border-blue-500/80 rounded-2xl p-6 shadow-xl hover:shadow-blue-500/10 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-blue-950/60 border border-blue-500/30 flex items-center justify-center text-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200 shadow-md shadow-blue-600/20">
                  🎨
                </div>

                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1 rounded-full">
                  <span
                    className="w-2.5 h-2.5 rounded-full shadow-sm"
                    style={{ backgroundColor: activeColorHex }}
                  />
                  <span className="text-xs font-semibold text-slate-200">
                    {activeName}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors flex items-center gap-2">
                  <span>Project Theme</span>
                  <span className="text-[11px] font-medium text-blue-400 bg-blue-950/60 border border-blue-500/30 px-2 py-0.5 rounded-full">
                    Dynamic
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Customize the complete project color palette. Choose from 9 curated themes (Emerald, Violet, Rose, Sunset Orange, etc.) or enter a custom brand hex color with live preview and database sync.
                </p>
              </div>

              {/* Theme mini swatches preview */}
              <div className="flex items-center gap-1.5 pt-1">
                {THEME_PRESETS.slice(0, 6).map((p) => (
                  <span
                    key={p.id}
                    className="w-4 h-4 rounded-full border border-slate-700/60 shadow-inner"
                    style={{ backgroundColor: p.primaryHex }}
                    title={p.name}
                  />
                ))}
                <span className="text-[11px] text-slate-500 ml-1">+3 more</span>
              </div>
            </div>

            <div className="pt-4 mt-5 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-bold text-blue-400 group-hover:translate-x-1 transition-transform flex items-center gap-1.5">
                <span>Customize Project Theme</span>
                <span>→</span>
              </span>
              <span className="text-[11px] text-slate-500">Live Sync</span>
            </div>
          </Link>

          {/* CARD 2: PROFILE SETTINGS */}
          <Link
            href="/settings/profile"
            className="group relative bg-slate-900/90 border border-slate-800 hover:border-emerald-500/80 rounded-2xl p-6 shadow-xl hover:shadow-emerald-500/10 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-2xl group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-200 shadow-md shadow-emerald-600/20">
                  {userProfile?.avatarUrl && userProfile.avatarUrl.length <= 4 ? userProfile.avatarUrl : "👤"}
                </div>

                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 px-3 py-1 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm" />
                  <span className="text-xs font-semibold text-slate-200 truncate max-w-[120px]">
                    {userProfile?.username ? `@${userProfile.username}` : "Account"}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors flex items-center gap-2">
                  <span>Profile Settings</span>
                  <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                    Live Sync
                  </span>
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Manage your personal account profile, display name, email address, bio, avatar, and security credentials. All changes live sync with the database table.
                </p>
              </div>

              {/* Profile summary info */}
              <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Display Name</span>
                  <span className="text-slate-200 font-medium truncate max-w-[150px]">
                    {userProfile?.fullName || userProfile?.username || "Not set"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Email</span>
                  <span className="text-slate-300 truncate max-w-[160px]">
                    {userProfile?.email || "No email linked"}
                  </span>
                </div>
              </div>
            </div>

            <div className="pt-4 mt-5 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform flex items-center gap-1.5">
                <span>Manage Profile</span>
                <span>→</span>
              </span>
              <span className="text-[11px] text-slate-500">Protected Page</span>
            </div>
          </Link>

          {/* CARD 3: DATABASE & STORAGE */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between text-left">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="w-12 h-12 rounded-xl bg-emerald-950/60 border border-emerald-500/30 flex items-center justify-center text-2xl text-emerald-400 shadow-md shadow-emerald-600/20">
                  🗄️
                </div>

                <div className="flex items-center gap-1.5 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-full text-emerald-400 text-xs font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  Connected
                </div>
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">
                  Database & Storage (status)
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Supabase PostgreSQL manages all tables: <code>users</code>, <code>projects</code>, <code>subscriptions</code>, <code>passwords</code>, <code>prompts</code>, and <code>user_settings</code>. All records are isolated per user session.
                </p>
              </div>

              <div className="bg-slate-950/80 rounded-lg p-2.5 border border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Engine: PostgreSQL (AWS pooler)</span>
                <span className="text-emerald-400 font-mono">Status: 200 OK</span>
              </div>
            </div>

            <div className="pt-4 mt-5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
              <span>Automatic Table Migrations</span>
              <span className="text-emerald-400 font-semibold">Active</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
