"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Project, Section, ProjectViewTab, ProjectRole } from "@/lib/types";
import { Sidebar } from "@/components/Sidebar";
import { TemplateEditor } from "@/components/TemplateEditor";
import { LivePreview } from "@/components/LivePreview";
import { TaskNotepad } from "@/components/TaskNotepad";
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
  const [activeTab, setActiveTab] = useState<
    "builder" | "preview" | "tasks"
  >("builder");
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
      ? ["builder", "preview", "tasks"]
      : activeProject.allowedViews && activeProject.allowedViews.length > 0
      ? activeProject.allowedViews
      : ["builder", "preview", "tasks"]
    : ["builder", "preview", "tasks"];

  const canViewBuilder = isOwner || allowedViews.includes("builder");
  const canViewPreview = isOwner || allowedViews.includes("preview");
  const canViewTasks = isOwner || allowedViews.includes("tasks");

  // Dynamically auto-switch active tab if current tab is restricted for collaborator
  useEffect(() => {
    if (!activeProject || isOwner) return;
    if (!allowedViews.includes(activeTab)) {
      const firstAllowed = (["builder", "preview", "tasks"] as const).find((t) =>
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
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-medium">Loading projects from Supabase...</p>
          </div>
        ) : activeProject ? (
          <div className={`${isSidebarCollapsed ? "max-w-7xl" : "max-w-5xl"} mx-auto space-y-6 transition-all duration-300`}>
            {/* VIEW TOGGLE BUTTONS: Template Builder vs Live Preview */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 p-3.5 rounded-xl border border-slate-800 shadow-md">
              <div className="flex items-center gap-2.5 flex-wrap">
                {/* Desktop Sidebar Toggle Button */}
                <button
                  type="button"
                  onClick={handleToggleSidebarCollapse}
                  title={isSidebarCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
                  aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                  className="hidden md:flex items-center justify-center w-9 h-9 rounded-lg bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer border border-slate-800 shadow-sm shrink-0"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {isSidebarCollapsed ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    )}
                  </svg>
                </button>

                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                  {canViewBuilder && (
                    <button
                      onClick={() => setActiveTab("builder")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition cursor-pointer ${
                        activeTab === "builder"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white hover:bg-slate-800/80"
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
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                      <span>Template Builder</span>
                    </button>
                  )}
                  {canViewPreview && (
                    <button
                      onClick={() => setActiveTab("preview")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition cursor-pointer ${
                        activeTab === "preview"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white hover:bg-slate-800/80"
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      <span>Live Preview</span>
                    </button>
                  )}
                  {canViewTasks && (
                    <button
                      onClick={() => setActiveTab("tasks")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-semibold transition cursor-pointer ${
                        activeTab === "tasks"
                          ? "bg-blue-600 text-white shadow-sm"
                          : "text-slate-400 hover:text-white hover:bg-slate-800/80"
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
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                        />
                      </svg>
                      <span>Project Tasks &amp; Notepad</span>
                    </button>
                  )}
                </div>
            </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                {activeTab === "tasks" && (
                  <button
                    onClick={() => setIsInviteModalOpen(true)}
                    title="Invite collaborators to this project"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs sm:text-sm font-semibold transition cursor-pointer shadow-sm hover:shadow-indigo-600/30"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    <span>Invite</span>
                  </button>
                )}

                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white shadow-sm">
                  <span className="text-sm font-medium text-slate-400">Project:</span>
                  <span className="text-sm sm:text-base font-bold text-white tracking-wide">
                    {activeProject.name || "Untitled"}
                  </span>
                  {!isOwner ? (
                    <span
                      className={`ml-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${
                        currentUserPermission === "full"
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                          : currentUserPermission === "edit_no_delete"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-blue-500/20 text-blue-300 border-blue-500/30"
                      }`}
                    >
                      {currentUserPermission === "full"
                        ? "Full Access"
                        : currentUserPermission === "edit_no_delete"
                        ? "Read & Edit"
                        : "Read Only"}
                    </span>
                  ) : (
                    <span className="ml-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      Owner
                    </span>
                  )}
                </div>

                {/* NOTIFICATION BELL IN HEADER */}
                <NotificationBell />

                {/* MANUAL SAVE BUTTON OR READ ONLY BADGE */}
                {isReadOnly ? (
                  <div
                    title="Read Only Mode — Modifications are disabled"
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/80 text-slate-400 text-xs sm:text-sm font-semibold select-none cursor-default shadow-sm"
                  >
                    <span className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
                    <span>Read Only</span>
                  </div>
                ) : (
                  <button
                    onClick={handleSaveActiveProject}
                    disabled={saveStatus === "saving"}
                    title="Save current project to database (Ctrl+S)"
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition cursor-pointer active:scale-95 shadow-sm ${
                      saveStatus === "saving"
                        ? "bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed"
                        : saveStatus === "unsaved"
                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 ring-2 ring-blue-400/50"
                        : saveStatus === "error"
                        ? "bg-rose-900/80 hover:bg-rose-800 text-rose-200 border border-rose-500/40"
                        : "bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700"
                    }`}
                  >
                    {saveStatus === "saving" ? (
                      <>
                        <span className="animate-spin text-xs">⟳</span>
                        <span>Saving...</span>
                      </>
                    ) : saveStatus === "unsaved" ? (
                      <>
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
                            d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                          />
                        </svg>
                        <span>Save Changes</span>
                      </>
                    ) : saveStatus === "error" ? (
                      <>
                        <span>⚠</span>
                        <span>Retry Save</span>
                      </>
                    ) : (
                      <>
                        <span className="text-emerald-400">✓</span>
                        <span className="text-slate-200">Saved</span>
                      </>
                    )}
                  </button>
                )}

                {/* PROJECT SETTINGS & MEMBERS ICON */}
                <Link
                  href={`/projects/members?projectId=${encodeURIComponent(activeProject.id)}`}
                  title="Project Members & Permissions Settings"
                  aria-label="Project Members & Permissions Settings"
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-400 hover:text-white transition border border-slate-700 shadow-sm cursor-pointer shrink-0"
                >
                  <svg
                    className="w-4 h-4 transition-transform duration-300 hover:rotate-45"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </Link>
              </div>
            </div>

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

            {/* VIEW 3: TASKS NOTEPAD */}
            {activeTab === "tasks" && canViewTasks && (
              <TaskNotepad
                project={activeProject}
                userPermission={activeProject.currentUserPermission}
                onUpdateTasks={updateActiveProjectTasks}
                onUpdateProjectFolders={handleUpdateProjectFolders}
                onManualSave={handleManualSaveTasks}
                saveStatus={saveStatus}
              />
            )}

            {/* RESTRICTED ACCESS NOTICE */}
            {((activeTab === "builder" && !canViewBuilder) ||
              (activeTab === "preview" && !canViewPreview) ||
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

        {/* CREATE NEW PROJECT MODAL WITH FOLDERS */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
            <div
              className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">Create New Project</h3>
                    <p className="text-xs text-slate-400">Set up your project and optional task folders</p>
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
              <form onSubmit={handleConfirmCreateProject} className="p-6 space-y-5">
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
                <div className="space-y-2.5">
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

                  <p className="text-[11px] text-slate-500 leading-relaxed pt-1">
                    You can also create, rename, or delete folders inside existing projects at any time from the Tasks tab.
                  </p>
                </div>

                {/* Actions */}
                <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
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
