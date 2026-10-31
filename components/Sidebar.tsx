"use client";

import React from "react";
import Link from "next/link";
import type { Project } from "@/lib/types";

interface SidebarProps {
  projects: Project[];
  activeProjectId: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isLoading: boolean;
  saveStatus: "saved" | "unsaved" | "saving" | "error";
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (e: React.MouseEvent, project: Project) => void;
  onLogout: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  username?: string;
  fullName?: string;
}

export function Sidebar({
  projects,
  activeProjectId,
  searchQuery,
  setSearchQuery,
  isSidebarOpen,
  setIsSidebarOpen,
  isLoading,
  saveStatus,
  onSelectProject,
  onCreateProject,
  onDeleteProject,
  onLogout,
  isCollapsed = false,
  onToggleCollapse,
  username,
  fullName: initialFullName,
}: SidebarProps) {
  const [userName, setUserName] = React.useState<string>(username || "");
  const [userFullName, setUserFullName] = React.useState<string>(
    initialFullName || ""
  );
  const [unreadNotifs, setUnreadNotifs] = React.useState<number>(0);

  React.useEffect(() => {
    let isMounted = true;
    async function checkNotifs() {
      try {
        const res = await fetch("/api/notifications");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && typeof data.unreadCount === "number") {
            setUnreadNotifs(data.unreadCount);
          }
        }
      } catch {}
    }
    checkNotifs();
    const interval = setInterval(checkNotifs, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  React.useEffect(() => {
    if (username) setUserName(username);
    if (initialFullName) setUserFullName(initialFullName);
    let isMounted = true;
    async function loadUserInfo() {
      try {
        const authRes = await fetch("/api/auth");
        if (authRes.ok) {
          const authData = await authRes.json();
          if (isMounted && authData?.user) {
            if (authData.user.username) setUserName(authData.user.username);
            if (authData.user.fullName) setUserFullName(authData.user.fullName);
          }
        }
        const profRes = await fetch("/api/profile");
        if (profRes.ok) {
          const profData = await profRes.json();
          if (isMounted && profData?.profile) {
            if (profData.profile.username)
              setUserName(profData.profile.username);
            if (profData.profile.fullName)
              setUserFullName(profData.profile.fullName);
          }
        }
      } catch {}
    }
    loadUserInfo();
    return () => {
      isMounted = false;
    };
  }, [username, initialFullName]);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <>
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-20 md:hidden"
        />
      )}

      <aside
        className={`fixed md:sticky top-0 inset-y-0 left-0 z-20 h-screen max-h-screen bg-[#0a0c12] text-slate-200 border-r border-white/[0.07] flex flex-col transition-all duration-300 ease-in-out shrink-0 select-none overflow-x-hidden ${
          isSidebarOpen
            ? "translate-x-0"
            : "-translate-x-0 max-md:-translate-x-full"
        } ${isCollapsed ? "md:w-[64px] w-68" : "w-68 md:w-[260px]"}`}
      >
        {/* TOP HEADER & NEW PROJECT CTA */}
        <div
          className={`border-b border-white/[0.06] ${
            isCollapsed ? "p-2.5 space-y-2" : "p-3.5 space-y-3"
          }`}
        >
          {!isCollapsed ? (
            <>
              <div className="flex items-center justify-between">
                <Link
                  href="/"
                  className="flex items-center gap-2 min-w-0 group"
                >
                  <div className="w-7 h-7 rounded-lg bg-white/[0.06] border border-white/[0.09] flex items-center justify-center text-slate-200 text-xs shrink-0 group-hover:bg-white group-hover:text-slate-950 transition">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex items-center gap-2">
                    <h2 className="font-bold text-white text-sm truncate">
                      Projects
                    </h2>
                    <span className="text-[11px] font-mono text-slate-400 bg-white/[0.05] px-1.5 py-0.5 rounded-md">
                      {projects.length}
                    </span>
                  </div>
                </Link>

                {onToggleCollapse && (
                  <button
                    type="button"
                    onClick={onToggleCollapse}
                    title="Collapse sidebar (Ctrl+B)"
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-white/[0.06] rounded-lg transition cursor-pointer"
                  >
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                      />
                    </svg>
                  </button>
                )}
              </div>

              <button
                onClick={onCreateProject}
                className="w-full flex items-center justify-center gap-1.5 bg-white hover:bg-slate-200 text-slate-950 font-semibold py-2 px-3 rounded-xl transition active:scale-[0.98] text-xs cursor-pointer"
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>New Project</span>
              </button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title="Expand sidebar (Ctrl+B)"
                  className="w-9 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] text-slate-400 hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 5l7 7-7 7M5 5l7 7-7 7"
                    />
                  </svg>
                </button>
              )}

              <button
                type="button"
                onClick={onCreateProject}
                title="New Project"
                className="w-9 h-9 rounded-xl bg-white hover:bg-slate-200 text-slate-950 flex items-center justify-center transition active:scale-95 cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2.5}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* SEARCH BAR */}
        {!isCollapsed && (
          <div className="px-3 pt-2.5 pb-1.5">
            <div className="relative">
              <svg
                className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Filter..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white/[0.03] border border-white/[0.07] pl-8 pr-6 py-1.5 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-white/[0.2] transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* SCROLLABLE PROJECT LIST */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto space-y-1 ${
            isCollapsed ? "px-2 py-2" : "px-2.5 py-1.5"
          }`}
        >
          {isLoading ? (
            <div className="p-4 text-center text-slate-500 text-xs">
              <span className="inline-block animate-spin mr-1">⟳</span>
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs">
              {!isCollapsed ? "No projects" : "—"}
            </div>
          ) : (
            filteredProjects.map((project) => {
              const isActive = project.id === activeProjectId;
              const cleanName = project.name || "Untitled";
              const initials = cleanName.trim().substring(0, 2).toUpperCase();

              if (isCollapsed) {
                return (
                  <button
                    type="button"
                    key={project.id}
                    onClick={() => onSelectProject(project.id)}
                    title={cleanName}
                    className={`w-9 h-9 mx-auto rounded-xl flex items-center justify-center cursor-pointer transition text-xs font-bold ${
                      isActive
                        ? "bg-white/[0.14] text-white border border-white/[0.22]"
                        : "bg-white/[0.03] text-slate-400 hover:bg-white/[0.08] hover:text-white border border-transparent"
                    }`}
                  >
                    <span>{initials}</span>
                  </button>
                );
              }

              return (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className={`group flex items-center justify-between px-2.5 py-2 rounded-xl cursor-pointer transition text-xs ${
                    isActive
                      ? "bg-white/[0.1] text-white font-semibold border border-white/[0.14]"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-white border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                        isActive
                          ? "bg-white text-slate-950"
                          : "bg-white/[0.05] text-slate-400 group-hover:text-slate-200"
                      }`}
                    >
                      {initials}
                    </div>
                    <span className="truncate">{cleanName}</span>
                  </div>

                  {(project.isOwner !== false ||
                    project.currentUserPermission === "full") && (
                    <button
                      onClick={(e) => onDeleteProject(e, project)}
                      title="Delete project"
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-500 hover:text-rose-400 transition shrink-0 cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* BOTTOM ACCOUNT & ACTION FOOTER */}
        <div
          className={`border-t border-white/[0.06] bg-[#07090e] shrink-0 ${
            isCollapsed ? "p-2" : "p-3 space-y-2.5"
          }`}
        >
          {!isCollapsed ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/settings"
                  title="Settings"
                  className="flex items-center justify-center h-9 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.06] text-slate-300 hover:text-white transition"
                >
                  <svg
                    className="w-[18px] h-[18px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </Link>

                <button
                  onClick={onLogout}
                  title="Log Out"
                  className="flex items-center justify-center h-9 rounded-xl bg-white/[0.03] hover:bg-rose-500/15 border border-white/[0.06] hover:border-rose-500/25 text-slate-300 hover:text-rose-400 transition cursor-pointer"
                >
                  <svg
                    className="w-[18px] h-[18px]"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                </button>
              </div>

              <div className="pt-1.5 border-t border-white/[0.06]">
                <Link
                  href="/settings/profile"
                  title="Profile"
                  className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-white/[0.05] transition min-w-0"
                >
                  <div className="w-6 h-6 rounded-full bg-white/[0.08] flex items-center justify-center text-[10px] font-bold text-slate-200 shrink-0">
                    {(userFullName || userName || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <p className="text-xs font-medium text-slate-300 truncate">
                    {userFullName || userName || "Account"}
                  </p>
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-1.5">
              <Link
                href="/"
                title="Home Hub"
                className="w-9 h-9 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
              </Link>
              <Link
                href="/settings"
                title="Settings"
                className="w-9 h-9 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </Link>
              <button
                type="button"
                onClick={onLogout}
                title="Log Out"
                className="w-9 h-9 rounded-xl bg-white/[0.03] hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 flex items-center justify-center transition cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
