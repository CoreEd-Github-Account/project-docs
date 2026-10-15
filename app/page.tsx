"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

export default function HomePortal() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Check Authentication Status on mount
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();
      setIsAuthenticated(Boolean(data.authenticated));
    } catch (err) {
      console.error("Auth check error:", err);
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setIsAuthenticated(false);
    }
  };

  // 1. Loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-9 h-9 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Verifying access...</p>
      </div>
    );
  }

  // 2. Unauthenticated -> Show Login Form (No bypass allowed)
  if (!isAuthenticated) {
    return (
      <LoginForm
        onLoginSuccess={() => {
          setIsAuthenticated(true);
        }}
      />
    );
  }

  // 3. Authenticated -> Show 3-Button Workspace Portal (Projects, Subscriptions, Passwords)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900/80 border-b border-slate-800 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-blue-600/30">
              T
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">
                Workspace Portal
              </h1>
              <span className="text-xs text-slate-400">Private Admin Access</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="text-xs text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/60 px-3 py-1.5 rounded-lg border border-red-500/30 transition cursor-pointer"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center">
        <div className="text-center max-w-md mx-auto mb-8 space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            Select Workspace
          </h2>
          <p className="text-sm text-slate-400">
            Choose which section you want to open.
          </p>
        </div>

        {/* 3 Main Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto w-full">
          {/* CARD 1: PROJECTS */}
          <Link
            href="/projects"
            className="group bg-slate-900/90 border border-slate-800 hover:border-blue-500/80 rounded-2xl p-6 shadow-xl hover:shadow-blue-500/10 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer"
          >
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-blue-950/60 border border-blue-500/30 flex items-center justify-center text-xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                📁
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                  Projects
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Documentation templates, section builder, live markdown previews, and task notepads.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-400 group-hover:translate-x-0.5 transition-transform">
                Open Projects →
              </span>
              <span className="text-[11px] text-slate-500">Templates</span>
            </div>
          </Link>

          {/* CARD 2: SUBSCRIPTIONS */}
          <Link
            href="/subscriptions"
            className="group bg-slate-900/90 border border-slate-800 hover:border-blue-500/80 rounded-2xl p-6 shadow-xl hover:shadow-blue-500/10 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer"
          >
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                ⏱️
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                  Subscriptions
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Track purchase and renewal dates, calculate time remaining, and track monthly PKR costs.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-400 group-hover:translate-x-0.5 transition-transform">
                Open Subscriptions →
              </span>
              <span className="text-[11px] text-slate-500">Renewals</span>
            </div>
          </Link>

          {/* CARD 3: PASSWORD MANAGER */}
          <Link
            href="/passwords"
            className="group bg-slate-900/90 border border-slate-800 hover:border-blue-500/80 rounded-2xl p-6 shadow-xl hover:shadow-blue-500/10 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer"
          >
            <div className="space-y-3">
              <div className="w-11 h-11 rounded-xl bg-amber-950/60 border border-amber-500/30 flex items-center justify-center text-xl group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200">
                🔑
              </div>
              <div>
                <h3 className="text-base font-bold text-white group-hover:text-blue-400 transition-colors">
                  Password Manager
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Store project credentials, URLs, IDs, and plain-text passwords with 1-click clipboard copy.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-400 group-hover:translate-x-0.5 transition-transform">
                Open Passwords →
              </span>
              <span className="text-[11px] text-slate-500">Plain-text</span>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}