"use client";

import React from "react";
import type { Project } from "@/lib/types";

interface SidebarProps {
  projects: Project[];
  activeProjectId: string;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isLoading: boolean;
  saveStatus: "saved" | "saving" | "error";
  onSelectProject: (id: string) => void;
  onCreateProject: () => void;
  onDeleteProject: (e: React.MouseEvent, project: Project) => void;
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
}: SidebarProps) {
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
        className={`fixed md:static inset-y-0 left-0 z-20 w-72 md:w-80 bg-slate-900 text-slate-200 border-r border-slate-800 flex flex-col transition-transform duration-300 ease-in-out md:translate-x-0 shrink-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-0 max-md:-translate-x-full"
        }`}
      >
        {/* Sidebar Header & New Project Button */}
        <div className="p-4 border-b border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white shadow-md">
                T
              </div>
              <div>
                <h2 className="font-bold text-white text-base leading-tight">
                  Template Studio
                </h2>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  <span className="text-[11px] text-slate-400">sqlite.db</span>
                </div>
              </div>
            </div>

            {/* Sync status indicator */}
            <div className="text-[11px] font-medium">
              {saveStatus === "saving" && (
                <span className="text-amber-400 flex items-center gap-1">
                  <span className="animate-spin text-xs">⟳</span> Saving
                </span>
              )}
              {saveStatus === "saved" && (
                <span className="text-emerald-400">Synced</span>
              )}
              {saveStatus === "error" && (
                <span className="text-rose-400">Error</span>
              )}
            </div>
          </div>

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
        </div>

        {/* Search Bar */}
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

        {/* Project List Header */}
        <div className="px-4 py-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
          <span>Saved Projects</span>
          <span className="bg-slate-800 px-2 py-0.5 rounded-full text-[11px] text-slate-300">
            {filteredProjects.length}
          </span>
        </div>

        {/* Scrollable Project List */}
        <div className="flex-1 overflow-y-auto px-3 py-1 space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
          {isLoading ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              <span className="inline-block animate-spin mr-2">⟳</span>
              Loading from database...
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="p-4 text-center text-slate-500 text-sm">
              {searchQuery ? "No projects match your search." : "No projects yet."}
            </div>
          ) : (
            filteredProjects.map((project) => {
              const isActive = project.id === activeProjectId;
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
                      <p className="truncate leading-snug">{project.name || "Untitled"}</p>
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

                  {/* Accessible delete button */}
                  <button
                    onClick={(e) => onDeleteProject(e, project)}
                    title="Delete project"
                    aria-label={`Delete ${project.name}`}
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
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            Database: sqlite.db
          </span>
          <span className="text-slate-500">v1.0</span>
        </div>
      </aside>
    </>
  );
}
