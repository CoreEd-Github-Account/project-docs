"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Project, Section, ProjectViewTab, ProjectRole, ProjectStatusStage, StageColor } from "@/lib/types";
import {
  DEFAULT_STATUS_STAGES,
  STAGE_PRESET_TEMPLATES,
  QUICK_STAGE_SUGGESTIONS,
  AVAILABLE_STAGE_COLORS,
} from "@/lib/stage-presets";
import { Sidebar } from "@/components/Sidebar";
import { TemplateEditor } from "@/components/TemplateEditor";
import { LivePreview } from "@/components/LivePreview";
import { TaskNotepad } from "@/components/TaskNotepad";
import { ProjectDocuments } from "@/components/ProjectDocuments";
import { BulkOpener } from "@/components/BulkOpener";
import { LoginForm } from "@/components/LoginForm";
import { ShareModal } from "@/components/ShareModal";
import { InviteFriendModal } from "@/components/InviteFriendModal";
import { NotificationBell } from "@/components/NotificationBell";
import Link from "next/link";

const MY_TEMPLATE_HEADINGS = [
  "PORT",
  "Live URL",
  "Admin Credentials",
  "Build Command",
];

export default function ProjectTemplateBuilder() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [activeTab, setActiveTab] = useState<ProjectViewTab>("builder");
  const [searchQuery, setSearchQuery] = useState("");
  const [newHeading, setNewHeading] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<
    "saved" | "unsaved" | "saving" | "error"
  >("saved");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; username: string; fullName?: string } | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectFolders, setNewProjectFolders] = useState<string[]>([]);
  const [customFolderInput, setCustomFolderInput] = useState("");
  const [newProjectStages, setNewProjectStages] = useState<ProjectStatusStage[]>(DEFAULT_STATUS_STAGES);
  const [customStageName, setCustomStageName] = useState("");
  const [customStageColor, setCustomStageColor] = useState<StageColor>("blue");
  const [customStageDesc, setCustomStageDesc] = useState("");
  const [activePresetKey, setActivePresetKey] = useState<string>("standard");

  // 1. Check Authentication Status on mount
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();
      if (data.authenticated) {
        setIsAuthenticated(true);
        if (data.user) {
          setCurrentUser(data.user);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error("Auth check error:", err);
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 2. Fetch projects from Supabase database (with background silent refresh support)
  const fetchProjects = useCallback(async (isSilent = false) => {
    try {
      if (!isSilent) setIsLoading(true);
      const res = await fetch("/api/projects");
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data: Project[] = await res.json();
      setProjects((prev) => {
        if (!isSilent) return data;
        if (JSON.stringify(prev) !== JSON.stringify(data)) {
          return data;
        }
        return prev;
      });
      if (!isSilent && data.length > 0) {
        if (typeof window !== "undefined") {
          const urlParams = new URLSearchParams(window.location.search);
          const qId = urlParams.get("projectId") || urlParams.get("id");
          const qTab = urlParams.get("tab");
          if (qId && data.some((p) => p.id === qId)) {
            setActiveProjectId(qId);
          } else {
            setActiveProjectId((curr) => curr || data[0].id);
          }
          if (qTab === "tasks" || qTab === "builder" || qTab === "preview") {
            setActiveTab(qTab);
          }
        } else {
          setActiveProjectId((curr) => curr || data[0].id);
        }
      }
    } catch (err) {
      console.error("Error loading projects from Supabase:", err);
      if (!isSilent) setSaveStatus("error");
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
    }
  }, [isAuthenticated, fetchProjects]);

  // Periodic background live sync of permissions & projects (every 3.5 seconds)
  useEffect(() => {
    if (!isAuthenticated) return;

    const interval = setInterval(() => {
      // Don't overwrite if currently saving or having unsaved local changes
      if (saveStatus === "saving" || saveStatus === "unsaved") return;
      if (typeof document !== "undefined" && document.hidden) return;
      fetchProjects(true);
    }, 3500);

    return () => clearInterval(interval);
  }, [isAuthenticated, saveStatus, fetchProjects]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setIsAuthenticated(false);
      setProjects([]);
      setActiveProjectId("");
      window.location.href = "/";
    }
  };

  // Current active project lookup
  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0] || null;

  // Allowed module views calculation & dynamic permission sync
  const isOwner = activeProject ? activeProject.isOwner !== false : true;
  const currentUserPermission: ProjectRole = activeProject
    ? isOwner
      ? "owner"
      : activeProject.currentUserPermission || "read"
    : "owner";

  const isReadOnly = !isOwner && currentUserPermission === "read";
  const canDelete = isOwner || currentUserPermission === "full";
  const canEdit = isOwner || currentUserPermission === "edit_no_delete" || currentUserPermission === "full";

  const allowedViews: ProjectViewTab[] = activeProject
    ? isOwner
      ? ["builder", "preview", "bulk_opener", "documents", "tasks"]
      : activeProject.allowedViews && activeProject.allowedViews.length > 0
      ? activeProject.allowedViews
      : ["builder", "preview", "bulk_opener", "documents", "tasks"]
    : ["builder", "preview", "bulk_opener", "documents", "tasks"];

  const canViewBuilder = isOwner || allowedViews.includes("builder");
  const canViewPreview = isOwner || allowedViews.includes("preview");
  const canViewBulkOpener = isOwner || allowedViews.includes("bulk_opener");
  const canViewDocuments = isOwner || allowedViews.includes("documents");
  const canViewTasks = isOwner || allowedViews.includes("tasks");

  // Dynamically auto-switch active tab if current tab is restricted for collaborator
  useEffect(() => {
    if (!activeProject || isOwner) return;
    if (!allowedViews.includes(activeTab)) {
      const firstAllowed = (["builder", "preview", "bulk_opener", "documents", "tasks"] as const).find((t) =>
        allowedViews.includes(t)
      );
      if (firstAllowed) {
        setActiveTab(firstAllowed);
      }
    }
  }, [activeProject, isOwner, allowedViews, activeTab]);

  // Persist project changes to Supabase via API
  const persistProjectToDb = async (projectToSave: Project) => {
    const isSaveReadOnly = projectToSave.isOwner === false && projectToSave.currentUserPermission === "read";
    if (isSaveReadOnly) return;

    try {
      setSaveStatus("saving");
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectToSave),
      });
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (res.status === 403) {
        setSaveStatus("error");
        return;
      }
      if (!res.ok) throw new Error("Failed to save project");
      setSaveStatus("saved");
    } catch (error) {
      console.error("Failed to save project to Supabase:", error);
      setSaveStatus("error");
    }
  };

  // Manual Save Active Project to Database
  const handleSaveActiveProject = async () => {
    if (!activeProject || isReadOnly) return;
    await persistProjectToDb(activeProject);
  };

  // Keyboard shortcuts: Ctrl+S to save, Ctrl+B to toggle sidebar
  useEffect(() => {
    try {
      const saved = localStorage.getItem("template_studio_sidebar_collapsed");
      if (saved !== null) {
        setIsSidebarCollapsed(saved === "true");
      }
    } catch {}
  }, []);

  const handleToggleSidebarCollapse = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("template_studio_sidebar_collapsed", String(next));
      } catch {}
      return next;
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (activeProject) {
          persistProjectToDb(activeProject);
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        handleToggleSidebarCollapse();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeProject]);

  // Project Actions
  const handleCreateProject = () => {
    setNewProjectName(`New Project ${projects.length + 1}`);
    setNewProjectFolders([]);
    setCustomFolderInput("");
    setNewProjectStages(DEFAULT_STATUS_STAGES);
    setActivePresetKey("standard");
    setCustomStageName("");
    setCustomStageDesc("");
    setCustomStageColor("blue");
    setIsCreateModalOpen(true);
  };

  const handleConfirmCreateProject = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = newProjectName.trim() || `New Project ${projects.length + 1}`;
    const newId = `project-${Date.now()}`;
    const newProj: Project = {
      id: newId,
      name: finalName,
      createdAt: Date.now(),
      sections: [],
      taskFolders: newProjectFolders,
      statusStages: newProjectStages.length > 0 ? newProjectStages : DEFAULT_STATUS_STAGES,
    };

    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newId);
    setSearchQuery("");
    setIsSidebarOpen(false);
    setIsCreateModalOpen(false);
    setActiveTab(newProjectFolders.length > 0 ? "tasks" : "builder");

    // Persist immediately to Supabase
    await persistProjectToDb(newProj);
  };

  const handleUpdateProjectFolders = async (folders: string[]) => {
    if (!activeProject || isReadOnly) return;
    const updated: Project = { ...activeProject, taskFolders: folders };
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    await persistProjectToDb(updated);
  };

  const handleUpdateProjectStages = async (stages: ProjectStatusStage[]) => {
    if (!activeProject || isReadOnly) return;
    const updated: Project = { ...activeProject, statusStages: stages };
    setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    await persistProjectToDb(updated);
  };

  const handleDeleteProject = async (
    e: React.MouseEvent,
    projectToDelete: Project
  ) => {
    e.stopPropagation();
    const canDeleteThis = projectToDelete.isOwner !== false || projectToDelete.currentUserPermission === "full";
    if (!canDeleteThis) {
      alert("You do not have permission to delete this project (Owner or Full Access required).");
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to delete "${projectToDelete.name || "Untitled"}"?`
    );
    if (!confirmed) return;

    try {
      setSaveStatus("saving");
      const res = await fetch(
        `/api/projects?id=${encodeURIComponent(projectToDelete.id)}`,
        {
          method: "DELETE",
        }
      );
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to delete project");

      const remaining = projects.filter((p) => p.id !== projectToDelete.id);
      setProjects(remaining);
      if (activeProjectId === projectToDelete.id) {
        setActiveProjectId(remaining.length > 0 ? remaining[0].id : "");
      }
      setSaveStatus("saved");
    } catch (error) {
      console.error("Failed to delete project from Supabase:", error);
      setSaveStatus("error");
    }
  };

  const updateActiveProjectName = (name: string) => {
    if (!activeProject || isReadOnly) return;
    const updated = { ...activeProject, name };
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? updated : p))
    );
    setSaveStatus("unsaved");
  };

  // Section Actions
  const addSection = () => {
    if (!newHeading.trim() || !activeProject || isReadOnly) return;
    const newSection: Section = {
      id: Date.now(),
      heading: newHeading.trim(),
      content: "",
    };

    const updated = {
      ...activeProject,
      sections: [...activeProject.sections, newSection],
    };

    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? updated : p))
    );
    setNewHeading("");
    setSaveStatus("unsaved");
  };

  // "My Template" Quick Presets
  const applyMyTemplate = () => {
    if (!activeProject || isReadOnly) return;
    const now = Date.now();
    const newSections: Section[] = MY_TEMPLATE_HEADINGS.map((heading, idx) => ({
      id: now + idx,
      heading,
      content: "",
    }));

    const updated = {
      ...activeProject,
      sections: [...activeProject.sections, ...newSections],
    };

    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? updated : p))
    );
    setSaveStatus("unsaved");
  };

  const removeSection = (sectionId: number) => {
    if (!activeProject || isReadOnly || !canDelete) return;
    const updated = {
      ...activeProject,
      sections: activeProject.sections.filter((sec) => sec.id !== sectionId),
    };

    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? updated : p))
    );
    setSaveStatus("unsaved");
  };

  const updateSectionContent = (sectionId: number, content: string) => {
    if (!activeProject || isReadOnly) return;
    const updated = {
      ...activeProject,
      sections: activeProject.sections.map((sec) =>
        sec.id === sectionId ? { ...sec, content } : sec
      ),
    };

    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? updated : p))
    );
    setSaveStatus("unsaved");
  };

  const updateSectionHeading = (sectionId: number, heading: string) => {
    if (!activeProject || isReadOnly) return;
    const updated = {
      ...activeProject,
      sections: activeProject.sections.map((sec) =>
        sec.id === sectionId ? { ...sec, heading } : sec
      ),
    };

    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? updated : p))
    );
    setSaveStatus("unsaved");
  };

  const updateActiveProjectTasks = (tasks: string) => {
    if (!activeProject || isReadOnly) return;
    const updated = { ...activeProject, tasks };
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? updated : p))
    );
    setSaveStatus("unsaved");
  };

  const handleManualSaveTasks = () => {
    if (!activeProject || isReadOnly) return;
    persistProjectToDb(activeProject);
  };

  // Text generator & export
  const generateText = () => {
    if (!activeProject) return "";
    let text = `${activeProject.name}\n`;
    activeProject.sections.forEach((sec) => {
      text += `-------------------------------------------------------------- ${sec.heading}\n`;
      text += `${sec.content}\n`;
    });
    text += `--------------------------------------------------------------\n`;
    return text;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generateText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!activeProject) return;
    const element = document.createElement("a");
    const file = new Blob([generateText()], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${activeProject.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")}-details.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  // 1. Initial Checking Auth State
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-9 h-9 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Verifying access...</p>
      </div>
    );
  }

  // 2. Unauthenticated -> Show Login Form
  if (!isAuthenticated) {
    return (
      <LoginForm
        onLoginSuccess={() => {
          setIsAuthenticated(true);
        }}
      />
    );
  }

  // 3. Authenticated -> Render Workspace
  return (
    <div className="min-h-screen md:h-screen md:overflow-hidden bg-slate-950 flex flex-col md:flex-row text-slate-100 font-sans">
      {/* Mobile Header Bar */}
      <div className="md:hidden flex items-center justify-between p-4 bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-30">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition cursor-pointer"
          aria-label="Toggle navigation"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            {isSidebarOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate max-w-[150px]">
            {activeProject?.name || "Template Studio"}
          </span>
          <span
            className="w-2 h-2 rounded-full bg-emerald-400"
            title="Connected to Supabase"
          />
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            title="Back to Home Portal"
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 rounded-md text-xs font-medium transition"
          >
            Hub
          </Link>
          <button
            onClick={handleCreateProject}
            className="px-3 py-1.5 bg-blue-600 rounded-md text-xs font-medium hover:bg-blue-500 transition cursor-pointer"
          >
            + New
          </button>
          <button
            onClick={handleLogout}
            title="Log Out"
            className="p-1.5 bg-slate-800 text-slate-300 hover:text-red-400 rounded-md text-xs transition cursor-pointer"
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
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* LEFT SIDEBAR COMPONENT */}
      <Sidebar
        projects={projects}
        activeProjectId={activeProjectId}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={handleToggleSidebarCollapse}
        isLoading={isLoading}
        saveStatus={saveStatus}
        onSelectProject={(id) => {
          setActiveProjectId(id);
          setIsSidebarOpen(false);
        }}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onLogout={handleLogout}
        username={currentUser?.username}
        fullName={currentUser?.fullName}
      />

      {/* RIGHT SIDE: Main Content Workspace */}
      <main className="flex-1 overflow-y-auto bg-[#08090e]">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-medium">Loading projects...</p>
          </div>
        ) : activeProject ? (
          <div className="min-h-full flex flex-col">
            {/* STICKY STUDIO TOP HEADER */}
            <header className="sticky top-0 z-20 bg-[#0b0d14]/85 backdrop-blur-xl border-b border-white/[0.07] px-4 sm:px-8 py-3">
              <div className={`${isSidebarCollapsed ? "max-w-7xl" : "max-w-6xl"} mx-auto flex flex-col lg:flex-row lg:items-center justify-between gap-3`}>
                {/* Left: Sidebar Toggle + Active Project Title & Role Badge */}
                <div className="flex items-center justify-between lg:justify-start gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <h1 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                        {activeProject.name || "Untitled Project"}
                      </h1>
                      {!isOwner ? (
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0 ${
                            currentUserPermission === "full"
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              : currentUserPermission === "edit_no_delete"
                              ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                              : "bg-blue-500/15 text-blue-300 border-blue-500/30"
                          }`}
                        >
                          {currentUserPermission === "full"
                            ? "Full Access"
                            : currentUserPermission === "edit_no_delete"
                            ? "Can Edit"
                            : "Read Only"}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white/[0.05] text-slate-300 border border-white/[0.08] shrink-0">
                          Owner
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Actions on small screens */}
                  <div className="flex lg:hidden items-center gap-2">
                    <NotificationBell />
                  </div>
                </div>

                {/* Center: Segmented Module Switcher */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.03] border border-white/[0.07] overflow-x-auto no-scrollbar">
                  {canViewBuilder && (
                    <button
                      onClick={() => setActiveTab("builder")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                        activeTab === "builder"
                          ? "bg-white/[0.12] text-white font-semibold shadow-xs"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>Builder</span>
                    </button>
                  )}
                  {canViewPreview && (
                    <button
                      onClick={() => setActiveTab("preview")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                        activeTab === "preview"
                          ? "bg-white/[0.12] text-white font-semibold shadow-xs"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>Preview</span>
                    </button>
                  )}
                  {canViewBulkOpener && (
                    <button
                      onClick={() => setActiveTab("bulk_opener")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                        activeTab === "bulk_opener"
                          ? "bg-white/[0.12] text-white font-semibold shadow-xs"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>Bulk Opener</span>
                    </button>
                  )}
                  {canViewDocuments && (
                    <button
                      onClick={() => setActiveTab("documents")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                        activeTab === "documents"
                          ? "bg-white/[0.12] text-white font-semibold shadow-xs"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>Documents</span>
                    </button>
                  )}
                  {canViewTasks && (
                    <button
                      onClick={() => setActiveTab("tasks")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition cursor-pointer ${
                        activeTab === "tasks"
                          ? "bg-white/[0.12] text-white font-semibold shadow-xs"
                          : "text-slate-400 hover:text-white hover:bg-white/[0.04]"
                      }`}
                    >
                      <span>Tasks</span>
                    </button>
                  )}
                </div>

                {/* Right: Collaboration, Save Status & Project Settings */}
                <div className="flex items-center justify-end gap-2 shrink-0">
                  <button
                    onClick={() => setIsInviteModalOpen(true)}
                    title="Invite collaborators"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] text-slate-200 hover:text-white text-xs font-semibold transition cursor-pointer"
                  >
                    <span>+ Invite</span>
                  </button>

                  {isReadOnly ? (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.07] text-slate-400 text-xs font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                      <span>Read Only</span>
                    </div>
                  ) : (
                    <button
                      onClick={handleSaveActiveProject}
                      disabled={saveStatus === "saving"}
                      title="Save project changes (Ctrl+S)"
                      className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95 ${
                        saveStatus === "saving"
                          ? "bg-white/[0.04] text-slate-400 border border-white/[0.07]"
                          : saveStatus === "unsaved"
                          ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25"
                          : saveStatus === "error"
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : "bg-white/[0.04] hover:bg-white/[0.08] text-emerald-400 border border-white/[0.07]"
                      }`}
                    >
                      {saveStatus === "saving" ? (
                        <>
                          <span className="animate-spin text-xs">⟳</span>
                          <span>Saving</span>
                        </>
                      ) : saveStatus === "unsaved" ? (
                        <span>Save Changes</span>
                      ) : saveStatus === "error" ? (
                        <span>Retry Save</span>
                      ) : (
                        <>
                          <span>✓</span>
                          <span className="text-slate-300">Saved</span>
                        </>
                      )}
                    </button>
                  )}

                  <div className="hidden lg:block">
                    <NotificationBell />
                  </div>

                  <Link
                    href={`/projects/members?projectId=${encodeURIComponent(activeProject.id)}`}
                    title="Project Members & Permissions"
                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.09] text-slate-400 hover:text-white transition border border-white/[0.07]"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </Link>
                </div>
              </div>
            </header>

            {/* WORKSPACE MODULE BODY */}
            <div className={`${isSidebarCollapsed ? "max-w-7xl" : "max-w-6xl"} w-full mx-auto p-4 sm:p-8 space-y-6 transition-all duration-300`}>

            {/* VIEW 1: TEMPLATE BUILDER */}
            {activeTab === "builder" && canViewBuilder && (
              <TemplateEditor
                project={activeProject}
                newHeading={newHeading}
                setNewHeading={setNewHeading}
                onUpdateProjectName={updateActiveProjectName}
                onAddSection={addSection}
                onRemoveSection={removeSection}
                onUpdateSectionContent={updateSectionContent}
                onUpdateSectionHeading={updateSectionHeading}
                onApplyMyTemplate={applyMyTemplate}
                isReadOnly={isReadOnly}
                canDelete={canDelete}
              />
            )}

            {/* VIEW 2: LIVE PREVIEW */}
            {activeTab === "preview" && canViewPreview && (
              <LivePreview
                projectName={activeProject.name}
                generatedText={generateText()}
                onCopy={handleCopy}
                onDownload={handleDownload}
                onShare={() => setIsShareModalOpen(true)}
                copied={copied}
              />
            )}

            {/* SHARE MODAL */}
            <ShareModal
              isOpen={isShareModalOpen}
              onClose={() => setIsShareModalOpen(false)}
              projectId={activeProject.id}
              projectName={activeProject.name}
              content={generateText()}
            />

            {/* INVITE FRIEND MODAL */}
            <InviteFriendModal
              isOpen={isInviteModalOpen}
              onClose={() => setIsInviteModalOpen(false)}
              projectId={activeProject.id}
              projectName={activeProject.name}
            />

            {/* VIEW 3: BULK OPENER */}
            {activeTab === "bulk_opener" && canViewBulkOpener && (
              <BulkOpener
                project={activeProject}
                userPermission={activeProject.currentUserPermission}
              />
            )}

            {/* VIEW 4: DOCUMENTS */}
            {activeTab === "documents" && canViewDocuments && (
              <ProjectDocuments
                project={activeProject}
                userPermission={activeProject.currentUserPermission}
              />
            )}

            {/* VIEW 5: TASKS NOTEPAD */}
            {activeTab === "tasks" && canViewTasks && (
              <TaskNotepad
                project={activeProject}
                userPermission={activeProject.currentUserPermission}
                onUpdateTasks={updateActiveProjectTasks}
                onUpdateProjectFolders={handleUpdateProjectFolders}
                onUpdateProjectStages={handleUpdateProjectStages}
                onManualSave={handleManualSaveTasks}
                saveStatus={saveStatus}
              />
            )}

            {/* RESTRICTED ACCESS NOTICE */}
            {((activeTab === "builder" && !canViewBuilder) ||
              (activeTab === "preview" && !canViewPreview) ||
              (activeTab === "bulk_opener" && !canViewBulkOpener) ||
              (activeTab === "documents" && !canViewDocuments) ||
              (activeTab === "tasks" && !canViewTasks)) && (
              <div className="p-10 text-center bg-slate-900 border border-slate-800 rounded-2xl max-w-lg mx-auto space-y-3 my-8 shadow-xl">
                <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto text-xl">
                  🔒
                </div>
                <h3 className="text-base font-bold text-white">Access Restricted</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The project owner has restricted your access to this module. Please use the navigation buttons above to access your permitted sections.
                </p>
              </div>
            )}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[450px] text-slate-400 bg-slate-900 rounded-xl border border-slate-800 p-8 text-center max-w-md mx-auto mt-12 shadow-md">
            <div className="w-12 h-12 rounded-full bg-blue-950/60 border border-blue-500/30 flex items-center justify-center text-blue-400 mb-4">
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-white">No Projects Found</h3>
            <p className="text-sm text-slate-400 mt-1 mb-5">
              Create a new project file to start drafting your documentation templates.
            </p>
            <button
              onClick={handleCreateProject}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition shadow-sm shadow-blue-600/30 cursor-pointer"
            >
              + Create First Project
            </button>
          </div>
        )}

        {/* CREATE NEW PROJECT MODAL WITH FOLDERS & STATUS STAGES */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div
              className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-[750px] max-h-[90vh] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Create New Project</h3>
                    <p className="text-xs text-slate-400">Set up your project, task folders, and custom status stages</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handleConfirmCreateProject} className="p-6 space-y-16 overflow-y-auto flex-1">
                {/* Project Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 block">Project Name *</label>
                  <input
                    type="text"
                    autoFocus
                    required
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="e.g. E-Commerce Platform"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                </div>

                {/* Task Folders Configuration */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-300">
                      Task Folders <span className="text-slate-500 font-normal">(Optional)</span>
                    </label>
                    <span className="text-[11px] text-slate-400">Separate tasks into folders</span>
                  </div>

                  {/* Preset Suggestions */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-slate-400">Quick Presets:</span>
                    <div className="flex items-center flex-wrap gap-1.5">
                      {["Frontend", "Backend", "API", "Mobile", "DevOps"].map((preset) => {
                        const isSelected = newProjectFolders.includes(preset);
                        return (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                setNewProjectFolders((prev) => prev.filter((f) => f !== preset));
                              } else {
                                setNewProjectFolders((prev) => [...prev, preset]);
                              }
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                              isSelected
                                ? "bg-blue-600 text-white shadow-sm border border-blue-500"
                                : "bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800"
                            }`}
                          >
                            <span>{isSelected ? "✓" : "+"}</span>
                            <span>{preset}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom Folder Input */}
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      value={customFolderInput}
                      onChange={(e) => setCustomFolderInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customFolderInput.trim()) {
                          e.preventDefault();
                          const f = customFolderInput.trim();
                          if (!newProjectFolders.includes(f)) {
                            setNewProjectFolders((prev) => [...prev, f]);
                          }
                          setCustomFolderInput("");
                        }
                      }}
                      placeholder="Add custom folder name..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      disabled={!customFolderInput.trim()}
                      onClick={() => {
                        const f = customFolderInput.trim();
                        if (f && !newProjectFolders.includes(f)) {
                          setNewProjectFolders((prev) => [...prev, f]);
                        }
                        setCustomFolderInput("");
                      }}
                      className="px-3 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-200 rounded-xl border border-slate-700 transition cursor-pointer disabled:cursor-not-allowed"
                    >
                      + Add
                    </button>
                  </div>

                  {/* Selected Folders Badges */}
                  {newProjectFolders.length > 0 && (
                    <div className="pt-2 border-t border-slate-800/80 flex items-center flex-wrap gap-1.5">
                      <span className="text-[11px] text-slate-400 mr-1">Folders to create:</span>
                      {newProjectFolders.map((f) => (
                        <span
                          key={f}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-950/70 border border-blue-500/40 text-blue-300 text-xs font-semibold"
                        >
                          <span>📁 {f}</span>
                          <button
                            type="button"
                            onClick={() => setNewProjectFolders((prev) => prev.filter((item) => item !== f))}
                            className="hover:text-rose-400 transition cursor-pointer"
                          >
                            ✕
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Status Stage Configuration (Project Level) */}
                <div className="space-y-3 pt-3 border-t border-slate-800/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-300">
                        Status Stages <span className="text-blue-400">*</span>
                      </label>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 border border-blue-500/30 text-blue-300">
                        Dynamic Workflow
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">Project-level task stages</span>
                  </div>

                  {/* Preset Workflow Templates */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-slate-400">Workflow Presets:</span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                      {STAGE_PRESET_TEMPLATES.map((tpl) => {
                        const isPresetActive = activePresetKey === tpl.id;
                        return (
                          <button
                            key={tpl.id}
                            type="button"
                            onClick={() => {
                              setActivePresetKey(tpl.id);
                              setNewProjectStages(tpl.stages);
                            }}
                            className={`p-2 rounded-xl text-left border transition cursor-pointer flex flex-col justify-between ${
                              isPresetActive
                                ? "bg-blue-600/20 border-blue-500/60 ring-1 ring-blue-500/40 text-white"
                                : "bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-300"
                            }`}
                          >
                            <span className="text-xs font-semibold leading-tight">{tpl.name}</span>
                            <span className="text-[10px] text-slate-400 mt-1">
                              {tpl.stages.length} stages
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Quick Stage Suggestions */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] text-slate-400">Quick Add Stages:</span>
                    <div className="flex items-center flex-wrap gap-1.5">
                      {QUICK_STAGE_SUGGESTIONS.map((sug) => {
                        const slug = sug.name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
                        const isAdded = newProjectStages.some((s) => (s.slug && s.slug === slug) || (s.name && s.name.toLowerCase() === sug.name.toLowerCase()) || (s.label && s.label.toLowerCase() === sug.name.toLowerCase()));
                        return (
                          <button
                            key={sug.name}
                            type="button"
                            disabled={isAdded}
                            onClick={() => {
                              if (!isAdded) {
                                setNewProjectStages((prev) => [
                                  ...prev,
                                  {
                                    id: `stage-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                                    name: sug.name,
                                    slug,
                                    color: sug.color,
                                    description: sug.description,
                                  },
                                ]);
                                setActivePresetKey("custom");
                              }
                            }}
                            className={`px-2 py-0.5 rounded-lg text-xs font-medium transition flex items-center gap-1 ${
                              isAdded
                                ? "bg-slate-900 text-slate-500 border border-slate-800/60 opacity-60 cursor-not-allowed"
                                : "bg-slate-950 hover:bg-slate-800 text-slate-300 border border-slate-800 cursor-pointer"
                            }`}
                          >
                            <span>{isAdded ? "✓" : "+"}</span>
                            <span>{sug.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Active Stages in this Project */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-400">Active Stages for this project ({newProjectStages.length}):</span>
                      {newProjectStages.length < 2 && (
                        <span className="text-[10px] text-amber-400">At least 1 stage is required</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800">
                      {newProjectStages.map((stage, idx) => {
                        const dotColorMap: Record<StageColor, string> = {
                          amber: "bg-amber-400",
                          emerald: "bg-emerald-400",
                          rose: "bg-rose-400",
                          blue: "bg-blue-400",
                          purple: "bg-purple-400",
                          cyan: "bg-cyan-400",
                          indigo: "bg-indigo-400",
                          pink: "bg-pink-400",
                          orange: "bg-orange-400",
                          teal: "bg-teal-400",
                          slate: "bg-slate-400",
                        };
                        const dotColor = dotColorMap[stage.color] || "bg-blue-400";

                        return (
                          <div
                            key={stage.id || stage.slug}
                            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-200 shadow-sm"
                          >
                            <span className="text-[10px] text-slate-500 font-mono">#{idx + 1}</span>
                            <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                            <div className="flex flex-col text-left">
                              <span className="font-semibold text-slate-100">{stage.name || stage.label || stage.slug || stage.id}</span>
                              {stage.description && (
                                <span className="text-[9px] text-slate-400 leading-tight">{stage.description}</span>
                              )}
                            </div>
                            <button
                              type="button"
                              disabled={newProjectStages.length <= 1}
                              onClick={() => {
                                if (newProjectStages.length > 1) {
                                  setNewProjectStages((prev) => prev.filter((s) => (s.id ? s.id !== stage.id : s.slug !== stage.slug)));
                                  setActivePresetKey("custom");
                                }
                              }}
                              title={newProjectStages.length <= 1 ? "At least one stage is required" : `Remove ${stage.name}`}
                              className="ml-1 text-slate-500 hover:text-rose-400 disabled:opacity-30 disabled:hover:text-slate-500 transition cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Create Custom Stage */}
                  <div className="space-y-2 pt-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800/80">
                    <span className="text-[11px] font-semibold text-slate-300 block">Add Custom Stage:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={customStageName}
                        onChange={(e) => setCustomStageName(e.target.value)}
                        placeholder="Stage name (e.g. QA Review)..."
                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="text"
                        value={customStageDesc}
                        onChange={(e) => setCustomStageDesc(e.target.value)}
                        placeholder="Optional subtitle (e.g. Under Review)..."
                        className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] text-slate-400 mr-1">Color:</span>
                        {AVAILABLE_STAGE_COLORS.map((col) => {
                          const bgDots: Record<StageColor, string> = {
                            amber: "bg-amber-400",
                            emerald: "bg-emerald-400",
                            rose: "bg-rose-400",
                            blue: "bg-blue-400",
                            purple: "bg-purple-400",
                            cyan: "bg-cyan-400",
                            indigo: "bg-indigo-400",
                            pink: "bg-pink-400",
                            orange: "bg-orange-400",
                            teal: "bg-teal-400",
                            slate: "bg-slate-400",
                          };
                          const isSelected = customStageColor === col;
                          return (
                            <button
                              key={col}
                              type="button"
                              onClick={() => setCustomStageColor(col)}
                              title={col}
                              className={`w-5 h-5 rounded-full ${bgDots[col]} transition cursor-pointer flex items-center justify-center ${
                                isSelected ? "ring-2 ring-white ring-offset-2 ring-offset-slate-950 scale-110" : "opacity-70 hover:opacity-100"
                              }`}
                            >
                              {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
                            </button>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        disabled={!customStageName.trim()}
                        onClick={() => {
                          const name = customStageName.trim();
                          if (!name) return;
                          const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "_");
                          if (newProjectStages.some((s) => s.slug === slug)) {
                            alert("A stage with this name or slug already exists.");
                            return;
                          }
                          setNewProjectStages((prev) => [
                            ...prev,
                            {
                              id: `stage-${Date.now()}`,
                              name,
                              slug,
                              color: customStageColor,
                              description: customStageDesc.trim() || undefined,
                            },
                          ]);
                          setCustomStageName("");
                          setCustomStageDesc("");
                          setActivePresetKey("custom");
                        }}
                        className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-xl transition cursor-pointer disabled:cursor-not-allowed shadow-sm"
                      >
                        + Add Stage
                      </button>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition shadow-sm shadow-blue-600/30 cursor-pointer active:scale-95"
                  >
                    Create Project
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
