"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Project, Section } from "@/lib/types";
import { Sidebar } from "@/components/Sidebar";
import { TemplateEditor } from "@/components/TemplateEditor";
import { LivePreview } from "@/components/LivePreview";
import { TaskNotepad } from "@/components/TaskNotepad";
import { LoginForm } from "@/components/LoginForm";
import { ShareModal } from "@/components/ShareModal";
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
  const [copied, setCopied] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // 1. Check Authentication Status on mount
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();
      if (data.authenticated) {
        setIsAuthenticated(true);
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

  // 2. Fetch projects from Supabase database
  const fetchProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/projects");
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch projects");
      const data: Project[] = await res.json();
      setProjects(data);
      if (data.length > 0) {
        setActiveProjectId(data[0].id);
      }
    } catch (err) {
      console.error("Error loading projects from Supabase:", err);
      setSaveStatus("error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProjects();
    }
  }, [isAuthenticated, fetchProjects]);

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

  // Persist project changes to Supabase via API
  const persistProjectToDb = async (projectToSave: Project) => {
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
      if (!res.ok) throw new Error("Failed to save project");
      setSaveStatus("saved");
    } catch (error) {
      console.error("Failed to save project to Supabase:", error);
      setSaveStatus("error");
    }
  };

  // Manual Save Active Project to Database
  const handleSaveActiveProject = async () => {
    if (!activeProject) return;
    await persistProjectToDb(activeProject);
  };

  // Keyboard shortcut Ctrl+S / Cmd+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (activeProject) {
          persistProjectToDb(activeProject);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeProject]);

  // Project Actions
  const handleCreateProject = async () => {
    const newId = `project-${Date.now()}`;
    const newProj: Project = {
      id: newId,
      name: `New Project ${projects.length + 1}`,
      createdAt: Date.now(),
      sections: [],
    };

    setProjects((prev) => [newProj, ...prev]);
    setActiveProjectId(newId);
    setSearchQuery("");
    setIsSidebarOpen(false);
    setActiveTab("builder");

    // Persist immediately to Supabase
    await persistProjectToDb(newProj);
  };

  const handleDeleteProject = async (
    e: React.MouseEvent,
    projectToDelete: Project
  ) => {
    e.stopPropagation();
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
    if (!activeProject) return;
    const updated = { ...activeProject, name };
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? updated : p))
    );
    setSaveStatus("unsaved");
  };

  // Section Actions
  const addSection = () => {
    if (!newHeading.trim() || !activeProject) return;
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
    if (!activeProject) return;
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
    if (!activeProject) return;
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
    if (!activeProject) return;
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
    if (!activeProject) return;
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
    if (!activeProject) return;
    const updated = { ...activeProject, tasks };
    setProjects((prev) =>
      prev.map((p) => (p.id === activeProject.id ? updated : p))
    );
    setSaveStatus("unsaved");
  };

  const handleManualSaveTasks = () => {
    if (!activeProject) return;
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
        isLoading={isLoading}
        saveStatus={saveStatus}
        onSelectProject={(id) => {
          setActiveProjectId(id);
          setIsSidebarOpen(false);
        }}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onLogout={handleLogout}
      />

      {/* RIGHT SIDE: Main Content Workspace */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-medium">Loading projects from Supabase...</p>
          </div>
        ) : activeProject ? (
          <div className="max-w-5xl mx-auto space-y-6">
            {/* VIEW TOGGLE BUTTONS: Template Builder vs Live Preview */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 p-3.5 rounded-xl border border-slate-800 shadow-md">
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
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
                  <span>Tasks</span>
                </button>
              </div>

              <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end flex-wrap">
                <Link
                  href="/"
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-lg text-sm font-medium transition shadow-sm cursor-pointer"
                  title="Back to Navigation Hub"
                >
                  <span>←</span>
                  <span>Hub</span>
                </Link>

                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white shadow-sm">
                  <span className="text-sm font-medium text-slate-400">Project:</span>
                  <span className="text-sm sm:text-base font-bold text-white tracking-wide">
                    {activeProject.name || "Untitled"}
                  </span>
                </div>

                {/* MANUAL SAVE BUTTON */}
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
              </div>
            </div>

            {/* VIEW 1: TEMPLATE BUILDER */}
            {activeTab === "builder" && (
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
              />
            )}

            {/* VIEW 2: LIVE PREVIEW */}
            {activeTab === "preview" && (
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

            {/* VIEW 3: TASKS NOTEPAD */}
            {activeTab === "tasks" && (
              <TaskNotepad
                project={activeProject}
                onUpdateTasks={updateActiveProjectTasks}
                onManualSave={handleManualSaveTasks}
                saveStatus={saveStatus}
              />
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
      </main>
    </div>
  );
}
