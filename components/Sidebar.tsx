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
  const [userFullName, setUserFullName] = React.useState<string>(initialFullName || "");
  const [userAvatar, setUserAvatar] = React.useState<string>("👤");

  React.useEffect(() => {
    if (username) {
      setUserName(username);
    }
    if (initialFullName) {
      setUserFullName(initialFullName);
    }
    let isMounted = true;
    async function loadUserInfo() {
      try {
        const authRes = await fetch("/api/auth");
        if (authRes.ok) {
          const authData = await authRes.json();
          if (isMounted && authData?.user) {
            if (authData.user.username) setUserName(authData.user.username);
            if (authData.user.fullName) setUserFullName(authData.user.fullName);
            if (authData.user.avatarUrl) setUserAvatar(authData.user.avatarUrl);
          }
        }
        const profRes = await fetch("/api/profile");
        if (profRes.ok) {
          const profData = await profRes.json();
          if (isMounted && profData?.profile) {
            if (profData.profile.username) {
              setUserName(profData.profile.username);
            }
            if (profData.profile.fullName) {
              setUserFullName(profData.profile.fullName);
            }
            if (profData.profile.avatarUrl) {
              setUserAvatar(profData.profile.avatarUrl);
            }
          }
        }
      } catch {
        // ignore
      }
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
      {/* Backdrop for Mobile */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
        />
      )}

      {/* LEFT SIDEBAR */}
      <aside
        className={`fixed md:sticky top-0 inset-y-0 left-0 z-20 h-screen max-h-screen bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col transition-all duration-300 ease-in-out shrink-0 select-none overflow-x-hidden ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-0 max-md:-translate-x-full"
        } ${isCollapsed ? "md:w-16 w-72" : "w-72 md:w-80"}`}
      >
        {/* ========================================================= */}
        {/* SIDEBAR HEADER & NEW PROJECT BUTTON                       */}
        {/* ========================================================= */}
        <div className={`border-b border-slate-800/80 transition-all duration-300 ${isCollapsed ? "p-3 space-y-2.5" : "p-4 space-y-3"}`}>
          {!isCollapsed ? (
            /* EXPANDED HEADER */
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md shrink-0">
                    T
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-white text-base leading-tight truncate">
                      Template Studio
                    </h2>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span className="text-[11px] text-slate-400 truncate">Supabase PG</span>
                    </div>
                  </div>
                </div>

                {/* Right controls: Sync status + Collapse Toggle Button */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-[11px] font-medium hidden sm:block">
                    {saveStatus === "saving" && (
                      <span className="text-amber-400 flex items-center gap-1">
                        <span className="animate-spin text-xs">⟳</span> Saving
                      </span>
                    )}
                    {saveStatus === "unsaved" && (
                      <span className="text-amber-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Unsaved
                      </span>
                    )}
                    {saveStatus === "saved" && (
                      <span className="text-emerald-400">Synced</span>
                    )}
                    {saveStatus === "error" && (
                      <span className="text-rose-400">Error</span>
                    )}
                  </div>

                  {/* Collapse Toggle Button */}
                  {onToggleCollapse && (
                    <button
                      type="button"
                      onClick={onToggleCollapse}
                      title="Collapse sidebar (Ctrl+B)"
                      aria-label="Collapse sidebar"
                      className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Full New Project Button */}
              <button
                onClick={onCreateProject}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 px-4 rounded-lg shadow-sm transition active:scale-[0.98] text-sm cursor-pointer"
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
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>New Project</span>
              </button>
            </>
          ) : (
            /* COLLAPSED HEADER */
            <div className="flex flex-col items-center gap-2.5">
              {/* Expand Toggle Button */}
              {onToggleCollapse && (
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  title="Expand sidebar (Ctrl+B)"
                  aria-label="Expand sidebar"
                  className="w-10 h-10 rounded-xl bg-slate-800/90 hover:bg-slate-800 hover:text-white text-slate-400 flex items-center justify-center transition cursor-pointer group shadow-sm"
                >
                  <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                  </svg>
                </button>
              )}

              {/* Compact New Project Button */}
              <button
                type="button"
                onClick={onCreateProject}
                title="New Project"
                aria-label="New Project"
                className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center justify-center transition active:scale-95 shadow-md shadow-blue-600/30 cursor-pointer"
              >
                <svg
                  className="w-5 h-5"
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

        {/* ========================================================= */}
        {/* SEARCH BAR                                                */}
        {/* ========================================================= */}
        {!isCollapsed ? (
          <div className="p-3 border-b border-slate-800/80">
            <div className="relative">
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none"
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
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/60 pl-9 pr-8 py-2 rounded-lg text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 text-xs p-0.5 rounded-full cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-2 border-b border-slate-800/80 flex justify-center">
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Search projects (click to expand)"
              aria-label="Search projects"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* PROJECT LIST HEADER                                       */}
        {/* ========================================================= */}
        {!isCollapsed ? (
          <div className="px-4 py-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
            <span>Saved Projects</span>
            <span className="bg-slate-800 px-2 py-0.5 rounded-full text-[11px] text-slate-300">
              {filteredProjects.length}
            </span>
          </div>
        ) : (
          <div className="py-2 flex justify-center">
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-800/80 text-slate-400"
              title={`${filteredProjects.length} saved projects`}
            >
              {filteredProjects.length}
            </span>
          </div>
        )}

        {/* ========================================================= */}
        {/* SCROLLABLE PROJECT LIST                                   */}
        {/* ========================================================= */}
        <div
          className={`flex-1 min-h-0 overflow-y-auto space-y-1.5 scrollbar-thin scrollbar-thumb-slate-700 ${
            isCollapsed ? "px-2 py-1" : "px-3 py-1"
          }`}
        >
          {isLoading ? (
            <div className="p-4 text-center text-slate-500 text-xs">
              <span className="inline-block animate-spin mr-1">⟳</span>
              {!isCollapsed && "Loading..."}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-xs">
              {!isCollapsed ? (searchQuery ? "No matches." : "No projects yet.") : "—"}
            </div>
          ) : (
            filteredProjects.map((project) => {
              const isActive = project.id === activeProjectId;
              const cleanName = project.name || "Untitled";
              const initials = cleanName.trim().substring(0, 2).toUpperCase();

              if (isCollapsed) {
                /* COLLAPSED PROJECT ITEM */
                return (
                  <div
                    key={project.id}
                    onClick={() => onSelectProject(project.id)}
                    title={`${cleanName} (${project.sections.length} ${
                      project.sections.length === 1 ? "section" : "sections"
                    })`}
                    className={`w-10 h-10 mx-auto rounded-xl flex items-center justify-center cursor-pointer transition text-xs font-bold ${
                      isActive
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-600/40 ring-2 ring-blue-400/50 scale-105"
                        : "bg-slate-800/70 text-slate-300 hover:bg-slate-800 hover:text-white"
                    }`}
                  >
                    <span>{initials}</span>
                  </div>
                );
              }

              /* EXPANDED PROJECT ITEM */
              return (
                <div
                  key={project.id}
                  onClick={() => onSelectProject(project.id)}
                  className={`group relative flex items-center justify-between p-3 rounded-lg cursor-pointer transition text-sm ${
                    isActive
                      ? "bg-blue-600 text-white font-semibold shadow-md"
                      : "text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    <svg
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? "text-white" : "text-slate-400 group-hover:text-slate-300"
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <div className="min-w-0">
                      <p className="truncate leading-snug">{cleanName}</p>
                      <p
                        className={`text-[11px] truncate ${
                          isActive ? "text-blue-100" : "text-slate-500"
                        }`}
                      >
                        {project.sections.length}{" "}
                        {project.sections.length === 1 ? "section" : "sections"}
                      </p>
                    </div>
                  </div>

                  {/* Accessible delete button (Only if Owner or Full Access) */}
                  {(project.isOwner !== false || project.currentUserPermission === "full") && (
                    <button
                      onClick={(e) => onDeleteProject(e, project)}
                      title="Delete project"
                      aria-label={`Delete ${cleanName}`}
                      className={`p-1.5 rounded transition shrink-0 cursor-pointer ${
                        isActive
                          ? "text-blue-200 hover:text-white hover:bg-blue-700/80"
                          : "text-slate-400 hover:text-red-400 hover:bg-slate-700"
                      }`}
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
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* ========================================================= */}
        {/* FOOTER INFO & LOGOUT                                      */}
        {/* ========================================================= */}
        <div className={`border-t border-slate-800 text-[11px] text-slate-400 mt-auto shrink-0 bg-slate-900 ${isCollapsed ? "p-2.5" : "p-3 space-y-2"}`}>
          {!isCollapsed ? (
            /* EXPANDED FOOTER */
            <>
              {/* USER PROFILE BADGE */}
              <Link
                href="/settings/profile"
                title="Manage Profile Settings"
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-slate-950/70 hover:bg-slate-800/80 border border-slate-800/90 hover:border-slate-700 transition group cursor-pointer mb-1"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-sm shadow-sm shrink-0 border border-blue-400/30">
                  <span>{userAvatar || "👤"}</span>
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-400 transition truncate">
                      {userFullName || userName || "User"}
                    </span>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Online" />
                  </div>
                  <span className="text-[10px] text-slate-500 block truncate group-hover:text-slate-400">
                    @{userName ? userName.toLowerCase() : "account"}
                  </span>
                </div>
                <svg
                  className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 transition shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              <div className="flex items-center justify-between text-slate-500 text-[10px] px-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Database: Supabase PG
                </span>
                <span>v1.0</span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <Link
                  href="/"
                  title="Workspace Hub"
                  className="flex items-center justify-center py-1.5 px-2 bg-slate-800/80 hover:bg-slate-800 hover:text-white text-slate-300 rounded-md transition text-xs font-medium cursor-pointer"
                >
                  Hub
                </Link>
                <Link
                  href="/settings"
                  title="Theme & Settings"
                  className="flex items-center justify-center py-1.5 px-2 bg-slate-800/80 hover:bg-slate-800 hover:text-blue-400 text-slate-300 rounded-md transition text-xs font-medium cursor-pointer"
                >
                  Settings
                </Link>
              </div>

              <button
                onClick={onLogout}
                title="Log out of Template Studio"
                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-slate-800/80 hover:bg-slate-800 hover:text-red-400 text-slate-300 rounded-md transition text-xs font-medium cursor-pointer"
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
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span>Log Out</span>
              </button>
            </>
          ) : (
            /* COLLAPSED FOOTER */
            <div className="flex flex-col items-center gap-2">
              <Link
                href="/settings/profile"
                title={`Profile: ${userFullName || userName || "account"} (@${userName || "account"})`}
                className="w-10 h-10 rounded-xl bg-slate-950/80 hover:bg-slate-800 text-slate-200 flex items-center justify-center transition border border-slate-800 hover:border-slate-700 shadow-sm relative group cursor-pointer"
                aria-label={`Profile: ${userFullName || userName || "account"} (@${userName || "account"})`}
              >
                <span className="text-base">{userAvatar || "👤"}</span>
                <span className="absolute bottom-1 right-1 w-2 h-2 rounded-full bg-emerald-400 border border-slate-900" />
              </Link>
              <Link
                href="/"
                title="Workspace Hub"
                className="w-10 h-10 rounded-xl bg-slate-800/80 hover:bg-slate-800 hover:text-white text-slate-300 flex items-center justify-center transition cursor-pointer"
                aria-label="Workspace Hub"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </Link>

              <Link
                href="/settings"
                title="Theme & Settings"
                className="w-10 h-10 rounded-xl bg-slate-800/80 hover:bg-slate-800 hover:text-blue-400 text-slate-300 flex items-center justify-center transition cursor-pointer"
                aria-label="Settings"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>

              <button
                type="button"
                onClick={onLogout}
                title="Log Out"
                className="w-10 h-10 rounded-xl bg-slate-800/80 hover:bg-slate-800 hover:text-red-400 text-slate-300 flex items-center justify-center transition cursor-pointer"
                aria-label="Log Out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>

              <span
                className="w-2 h-2 rounded-full bg-emerald-400 mt-0.5"
                title="Connected to Supabase"
              />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
