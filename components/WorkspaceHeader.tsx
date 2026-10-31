"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NotificationBell } from "@/components/NotificationBell";

interface WorkspaceHeaderProps {
  title?: string;
  subtitle?: string;
  icon?: string;
  saveStatus?: "saved" | "saving" | "unsaved" | "error";
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: string;
  };
  extraActions?: React.ReactNode;
  onLogout?: () => void;
}

const WORKSPACE_LINKS = [
  { href: "/projects", label: "Projects", icon: "📁" },
  { href: "/subscriptions", label: "Subscriptions", icon: "⏱️" },
  { href: "/expenses", label: "Expenses", icon: "🧾" },
  { href: "/passwords", label: "Passwords", icon: "🔑" },
  { href: "/prompts", label: "Prompts", icon: "💡" },
  { href: "/commands", label: "Commands", icon: ">_" },
];

export function WorkspaceHeader({
  saveStatus = "saved",
  primaryAction,
  extraActions,
  onLogout,
}: WorkspaceHeaderProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 bg-[#08090e]/85 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        {/* Left: Home Button + Clean Workspace Navigation */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <Link
            href="/"
            title="Home Hub"
            className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.07] flex items-center justify-center text-slate-300 hover:text-white transition shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          </Link>

          <div className="h-4 w-px bg-white/[0.08] shrink-0" />

          <nav aria-label="Workspaces" className="flex items-center gap-1">
            {WORKSPACE_LINKS.map((item) => {
              const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                    isActive
                      ? "bg-white/[0.1] text-white font-semibold border border-white/[0.12]"
                      : "text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]"
                  }`}
                >
                  <span className="text-xs leading-none">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right: Sync Dot + Primary Action + Utilities */}
        <div className="flex items-center gap-2 shrink-0">
          <span
            className={`w-2 h-2 rounded-full hidden sm:inline-block ${
              saveStatus === "saving"
                ? "bg-amber-400 animate-ping"
                : saveStatus === "error"
                ? "bg-rose-500"
                : "bg-emerald-400"
            }`}
            title={saveStatus === "saving" ? "Saving..." : "Synced"}
          />

          {extraActions}

          {primaryAction && (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white text-xs font-semibold transition shadow-sm cursor-pointer"
            >
              <span>{primaryAction.icon || "+"}</span>
              <span>{primaryAction.label}</span>
            </button>
          )}

          <NotificationBell />

          <Link
            href="/settings"
            title="Settings"
            className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.07] flex items-center justify-center text-slate-400 hover:text-white transition"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              title="Log Out"
              className="w-8 h-8 rounded-lg bg-white/[0.04] hover:bg-rose-500/15 border border-white/[0.07] hover:border-rose-500/30 text-slate-400 hover:text-rose-400 flex items-center justify-center transition cursor-pointer"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
