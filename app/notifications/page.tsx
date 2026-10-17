"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LoginForm } from "@/components/LoginForm";
import { NotificationBell } from "@/components/NotificationBell";
import type { TaskNotification } from "@/lib/types";

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 10) return "Just now";
    if (diffSec < 60) return `${diffSec} seconds ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} min${diffMin > 1 ? "s" : ""} ago`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} hour${diffHour > 1 ? "s" : ""} ago`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString([], {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatFullDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString([], {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function NotificationsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [notifications, setNotifications] = useState<TaskNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<"all" | "unread" | "read">("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [dbNotice, setDbNotice] = useState<string | null>(null);
  const [lastSyncedTime, setLastSyncedTime] = useState<string>("");
  const router = useRouter();

  // 1. Auth check
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

  // 2. Fetch notifications with Live Sync
  const fetchNotifications = useCallback(async (isSilent = true) => {
    try {
      if (!isSilent) setIsLoading(true);
      const res = await fetch("/api/notifications");
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(typeof data.unreadCount === "number" ? data.unreadCount : 0);
        setLastSyncedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      }
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, []);

  // 3. Live Sync Polling interval (every 20 seconds when visible)
  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications(false);

      const interval = setInterval(() => {
        if (typeof document !== "undefined" && document.hidden) return;
        fetchNotifications(true);
      }, 20000);

      const handleFocus = () => {
        fetchNotifications(true);
      };

      const handleVisibilityChange = () => {
        if (typeof document !== "undefined" && !document.hidden) {
          fetchNotifications(true);
        }
      };

      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleVisibilityChange);
      return () => {
        clearInterval(interval);
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }
  }, [isAuthenticated, fetchNotifications]);

  // Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
      // ignore
    } finally {
      setIsAuthenticated(false);
      router.push("/");
    }
  };

  // Toggle single notification read status
  const handleToggleRead = async (e: React.MouseEvent, notif: TaskNotification) => {
    e.stopPropagation();
    const nextRead = !notif.isRead;

    // Optimistic UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, isRead: nextRead } : n))
    );
    setUnreadCount((prev) => (nextRead ? Math.max(0, prev - 1) : prev + 1));

    // Live Sync with DB
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: nextRead ? "mark_read" : "mark_unread",
          id: notif.id,
        }),
      });
      setDbNotice(nextRead ? "Marked as read & live synced" : "Marked as unread & live synced");
      setTimeout(() => setDbNotice(null), 2000);
    } catch (err) {
      console.error("Failed to update notification read status:", err);
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (unreadCount === 0) return;

    // Optimistic UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);

    // Live Sync with DB
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_all_read" }),
      });
      setDbNotice("All notifications marked as read & live synced");
      setTimeout(() => setDbNotice(null), 2500);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  // Delete single notification
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const target = notifications.find((n) => n.id === id);

    // Optimistic UI update
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (target && !target.isRead) {
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }

    // Live Sync with DB
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", id }),
      });
      setDbNotice("Notification removed & live synced");
      setTimeout(() => setDbNotice(null), 2000);
    } catch (err) {
      console.error("Failed to delete notification:", err);
    }
  };

  // Clear all notifications
  const handleClearAll = async () => {
    if (notifications.length === 0) return;
    if (!confirm("Are you sure you want to clear all notifications?")) return;

    // Optimistic UI update
    setNotifications([]);
    setUnreadCount(0);

    // Live Sync with DB
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_all" }),
      });
      setDbNotice("All notifications cleared & live synced");
      setTimeout(() => setDbNotice(null), 2500);
    } catch (err) {
      console.error("Failed to clear all notifications:", err);
    }
  };

  // Navigate to project and task
  const handleOpenProjectTask = (notif: TaskNotification) => {
    if (!notif.isRead) {
      // Mark as read silently
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mark_read", id: notif.id }),
      }).catch(() => {});
    }
    router.push(`/projects?projectId=${encodeURIComponent(notif.projectId)}&tab=tasks`);
  };

  // Extract distinct projects for filter dropdown
  const projectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of notifications) {
      if (n.projectId && !map.has(n.projectId)) {
        map.set(n.projectId, n.projectName || "Untitled Project");
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [notifications]);

  // Filtered notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter((n) => {
      // Tab filter
      if (filterTab === "unread" && n.isRead) return false;
      if (filterTab === "read" && !n.isRead) return false;

      // Project filter
      if (selectedProject !== "all" && n.projectId !== selectedProject) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const inProject = (n.projectName || "").toLowerCase().includes(query);
        const inMessage = (n.message || "").toLowerCase().includes(query);
        const inTitle = (n.title || "").toLowerCase().includes(query);
        const inActor = (n.actorFullName || n.actorName || "").toLowerCase().includes(query);
        return inProject || inMessage || inTitle || inActor;
      }

      return true;
    });
  }, [notifications, filterTab, selectedProject, searchQuery]);

  // Loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-9 h-9 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Verifying access...</p>
      </div>
    );
  }

  // Unauthenticated
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col selection:bg-blue-500/30 selection:text-white">
      {/* Visual Ambient Mesh Lighting */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[600px] h-[350px] bg-blue-600/10 blur-[150px] rounded-full pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[300px] bg-indigo-600/10 blur-[140px] rounded-full pointer-events-none" />
      </div>

      {/* Database Notice Toast */}
      {dbNotice && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900/95 border border-emerald-500/50 text-emerald-300 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-2 text-xs font-semibold animate-in fade-in slide-in-from-bottom-3 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span>{dbNotice}</span>
        </div>
      )}

      {/* TOP HEADER */}
      <header className="bg-slate-900/80 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          {/* Logo & Navigation */}
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
                  Notifications Center
                </h1>
                <span className="text-[11px] font-semibold bg-blue-950/80 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Task alerts from your project collaborators
              </p>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2.5">
            {/* Header Notification Bell */}
            <NotificationBell />

            <Link
              href="/projects"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition text-xs font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>Projects</span>
            </Link>

            <Link
              href="/"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white transition text-xs font-medium"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Hub</span>
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

      {/* MAIN CONTAINER */}
      <main className="max-w-6xl mx-auto px-4 py-8 flex-1 w-full space-y-6">
        {/* HERO TITLE & LIVE SYNC STATUS BAR */}
        <div className="bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/90 border border-slate-800 p-6 rounded-2xl shadow-xl backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center text-lg shadow-inner">
                🔔
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  Project Task Notifications
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">
                  Stay synchronized with tasks created by team members across all your projects.
                </p>
              </div>
            </div>
          </div>

          {/* Database Live Sync Status Pill */}
          <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 text-xs flex items-center gap-2 shadow-inner">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-semibold text-slate-200">Database Live Synced</span>
              {lastSyncedTime && (
                <span className="text-slate-500 text-[10px]">({lastSyncedTime})</span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition cursor-pointer flex items-center gap-1.5 active:scale-95"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Mark All Read</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={handleClearAll}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-red-400 border border-slate-700 text-xs font-medium transition cursor-pointer"
                title="Clear all notifications"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* CONTROLS BAR: TABS, SEARCH, AND PROJECT FILTER */}
        <div className="bg-slate-900/70 border border-slate-800 p-3.5 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
          {/* Status Tabs */}
          <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800/80 shrink-0">
            <button
              onClick={() => setFilterTab("all")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                filterTab === "all"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>All</span>
              <span className="text-[10px] bg-slate-800/80 px-1.5 py-0.2 rounded-full">
                {notifications.length}
              </span>
            </button>

            <button
              onClick={() => setFilterTab("unread")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                filterTab === "unread"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Unread</span>
              {unreadCount > 0 ? (
                <span className="text-[10px] bg-rose-500 text-white font-bold px-1.5 py-0.2 rounded-full">
                  {unreadCount}
                </span>
              ) : (
                <span className="text-[10px] bg-slate-800/80 px-1.5 py-0.2 rounded-full">
                  0
                </span>
              )}
            </button>

            <button
              onClick={() => setFilterTab("read")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                filterTab === "read"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>Read</span>
              <span className="text-[10px] bg-slate-800/80 px-1.5 py-0.2 rounded-full">
                {Math.max(0, notifications.length - unreadCount)}
              </span>
            </button>
          </div>

          {/* Search & Project Filter */}
          <div className="flex items-center gap-2.5 flex-1 max-w-xl">
            {/* Project Filter Dropdown */}
            {projectOptions.length > 0 && (
              <div className="shrink-0">
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="all">All Projects</option>
                  {projectOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Search Input */}
            <div className="relative flex-1">
              <svg
                className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by task, project, or member..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* NOTIFICATIONS FEED */}
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-medium">Fetching notifications from database...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-12 text-center text-slate-400 space-y-3 shadow-sm">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-800/80 border border-slate-700/80 flex items-center justify-center text-2xl text-slate-500">
              📭
            </div>
            <h3 className="text-base font-bold text-slate-200">
              {searchQuery || selectedProject !== "all" || filterTab !== "all"
                ? "No matching notifications found"
                : "No task notifications yet"}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {searchQuery || selectedProject !== "all" || filterTab !== "all"
                ? "Try adjusting your filters or search keywords to find what you are looking for."
                : "When other team members in your shared projects create tasks, live notifications with mentioned project names will appear here automatically."}
            </p>
            <div className="pt-2">
              <Link
                href="/projects"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition cursor-pointer"
              >
                <span>Go to Projects</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => (
              <div
                key={notif.id}
                onClick={() => handleOpenProjectTask(notif)}
                className={`group relative p-5 rounded-2xl border transition-all duration-200 cursor-pointer shadow-md hover:shadow-xl ${
                  !notif.isRead
                    ? "bg-slate-900/90 border-blue-500/50 border-l-4 border-l-blue-500 hover:border-blue-400"
                    : "bg-slate-900/50 border-slate-800/80 hover:bg-slate-900 hover:border-slate-700"
                }`}
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  {/* Left: Avatar + Details */}
                  <div className="flex items-start gap-3.5 min-w-0 flex-1">
                    {/* User Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-base shrink-0 shadow-sm mt-0.5">
                      {notif.actorAvatar ? (
                        <span>{notif.actorAvatar}</span>
                      ) : (
                        <span className="font-bold text-sm text-blue-400">
                          {(notif.actorFullName || notif.actorName || "U").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 flex-1 min-w-0">
                      {/* Project Name (BOLD - Explicit User Requirement) */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          Project:
                        </span>
                        {/* PROJECT NAME IN BOLD */}
                        <strong className="text-sm sm:text-base font-bold text-white tracking-wide bg-slate-800/80 px-2.5 py-0.5 rounded-lg border border-slate-700/80 group-hover:border-blue-500/40 transition">
                          {notif.projectName || "Untitled Project"}
                        </strong>

                        {!notif.isRead && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase bg-blue-500/20 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                            New
                          </span>
                        )}

                        <span className="text-[11px] font-medium text-slate-400 bg-slate-950/60 px-2 py-0.5 rounded-md border border-slate-800">
                          Task Activity
                        </span>
                      </div>

                      {/* Notification message */}
                      <p className="text-sm text-slate-200 leading-snug">
                        <span className="text-slate-400">By </span>
                        <span className="font-semibold text-slate-200">
                          {notif.actorFullName || notif.actorName}
                        </span>
                        {": "}
                        <span className="font-medium text-white">{notif.message}</span>
                      </p>

                      {/* Timestamps */}
                      <div className="flex items-center gap-3 text-xs text-slate-500 pt-0.5">
                        <span className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span>{formatRelativeTime(notif.createdAt)}</span>
                        </span>
                        <span className="text-slate-700">•</span>
                        <span>{formatFullDate(notif.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-2 sm:pt-0">
                    {/* Open Project & Task Button */}
                    <button
                      type="button"
                      onClick={() => handleOpenProjectTask(notif)}
                      className="px-3.5 py-1.5 rounded-lg bg-blue-600/90 hover:bg-blue-600 text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <span>Open Task</span>
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>

                    {/* Toggle Read/Unread */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleRead(e, notif)}
                      title={notif.isRead ? "Mark as unread" : "Mark as read"}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 text-xs transition cursor-pointer"
                    >
                      {notif.isRead ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    {/* Delete Notification */}
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, notif.id)}
                      title="Delete notification"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/40 text-slate-400 hover:text-red-400 border border-slate-700 hover:border-red-500/30 text-xs transition cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
