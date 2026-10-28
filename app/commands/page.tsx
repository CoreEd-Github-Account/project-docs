"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { NotificationBell } from "@/components/NotificationBell";
import type { SavedCommand } from "@/lib/types";

interface CategoryMeta {
  id: string;
  label: string;
  promptPrefix: string;
  badgeClass: string;
  dotClass: string;
  placeholderCmd: string;
  placeholderTitle: string;
  isCustom?: boolean;
}

const DEFAULT_CATEGORIES: CategoryMeta[] = [
  {
    id: "github",
    label: "Git & GitHub",
    promptPrefix: "git",
    badgeClass: "bg-orange-950/60 text-orange-300 border-orange-500/30",
    dotClass: "bg-orange-400",
    placeholderCmd: "git log --oneline --graph --decorate --all",
    placeholderTitle: "Shows a clean ASCII branch graph of all commits across branches.",
  },
  {
    id: "npm",
    label: "npm & Node",
    promptPrefix: "npm",
    badgeClass: "bg-rose-950/60 text-rose-300 border-rose-500/30",
    dotClass: "bg-rose-400",
    placeholderCmd: "npm outdated --depth=0",
    placeholderTitle: "Lists direct dependencies that have newer versions available on the registry.",
  },
  {
    id: "linux",
    label: "Linux & Shell",
    promptPrefix: "sh",
    badgeClass: "bg-emerald-950/60 text-emerald-300 border-emerald-500/30",
    dotClass: "bg-emerald-400",
    placeholderCmd: "lsof -i :3000",
    placeholderTitle: "Shows the PID and process name listening on TCP port 3000 so you can free it.",
  },
  {
    id: "docker",
    label: "Docker & Infra",
    promptPrefix: "docker",
    badgeClass: "bg-sky-950/60 text-sky-300 border-sky-500/30",
    dotClass: "bg-sky-400",
    placeholderCmd: "docker system prune -af --volumes",
    placeholderTitle: "Removes stopped containers, unused networks, dangling images, and volumes.",
  },
  {
    id: "database",
    label: "Database & SQL",
    promptPrefix: "sql",
    badgeClass: "bg-indigo-950/60 text-indigo-300 border-indigo-500/30",
    dotClass: "bg-indigo-400",
    placeholderCmd: "pg_dump -Fc --no-acl --no-owner -h localhost -U postgres mydb > mydb.dump",
    placeholderTitle: "Creates a portable custom-format backup ready for pg_restore.",
  },
  {
    id: "other",
    label: "General CLI",
    promptPrefix: "cli",
    badgeClass: "bg-slate-800 text-slate-300 border-slate-700",
    dotClass: "bg-slate-400",
    placeholderCmd: "ssh -i ~/.ssh/id_ed25519 user@server-ip",
    placeholderTitle: "Opens an authenticated SSH session using your ed25519 private key.",
  },
];

const CUSTOM_PALETTES = [
  {
    badgeClass: "bg-teal-950/60 text-teal-300 border-teal-500/30",
    dotClass: "bg-teal-400",
  },
  {
    badgeClass: "bg-purple-950/60 text-purple-300 border-purple-500/30",
    dotClass: "bg-purple-400",
  },
  {
    badgeClass: "bg-amber-950/60 text-amber-300 border-amber-500/30",
    dotClass: "bg-amber-400",
  },
  {
    badgeClass: "bg-cyan-950/60 text-cyan-300 border-cyan-500/30",
    dotClass: "bg-cyan-400",
  },
  {
    badgeClass: "bg-pink-950/60 text-pink-300 border-pink-500/30",
    dotClass: "bg-pink-400",
  },
  {
    badgeClass: "bg-blue-950/60 text-blue-300 border-blue-500/30",
    dotClass: "bg-blue-400",
  },
];

function buildCustomCategoryMeta(rawName: string): CategoryMeta {
  const clean = rawName.trim();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  const palette = CUSTOM_PALETTES[hash % CUSTOM_PALETTES.length];
  return {
    id: clean,
    label: clean,
    promptPrefix: clean.toLowerCase().slice(0, 6),
    badgeClass: palette.badgeClass,
    dotClass: palette.dotClass,
    placeholderCmd: `${clean.toLowerCase().split(/\s+/)[0]} --help`,
    placeholderTitle: `What does this ${clean} command do?`,
    isCustom: true,
  };
}

function resolveCategoryMeta(catId?: string, allCategories: CategoryMeta[] = DEFAULT_CATEGORIES): CategoryMeta {
  if (!catId) return DEFAULT_CATEGORIES[0];
  const found = allCategories.find((c) => c.id.toLowerCase() === catId.toLowerCase());
  if (found) return found;
  return buildCustomCategoryMeta(catId);
}

const STARTER_COMMANDS: Array<Omit<SavedCommand, "id" | "createdAt">> = [
  {
    title: "Undo last commit but keep all file changes staged",
    command: "git reset --soft HEAD~1",
    category: "github",
    isPinned: true,
  },
  {
    title: "Create and switch to a new branch, then push upstream",
    command: "git checkout -b feat/new-branch && git push -u origin feat/new-branch",
    category: "github",
    isPinned: false,
  },
  {
    title: "Find and kill process running on port 3000 (Linux / macOS)",
    command: "kill -9 $(lsof -t -i:3000)",
    category: "linux",
    isPinned: true,
  },
  {
    title: "Check disk space usage by folder in current directory",
    command: "du -sh * | sort -hr",
    category: "linux",
    isPinned: false,
  },
  {
    title: "Clean install exact dependencies from package-lock.json",
    command: "rm -rf node_modules && npm ci",
    category: "npm",
    isPinned: false,
  },
];

// Highlight CLI flags (-f, --flag), operators (&&, |, >), and strings for instant terminal legibility
function renderHighlightedCommand(raw: string): React.ReactNode {
  const lines = raw.split("\n");
  return lines.map((line, lineIdx) => {
    const tokens = line.split(/(\s+)/);
    return (
      <div key={lineIdx} className="leading-relaxed">
        <span className="text-emerald-500 select-none mr-2.5 font-bold">$</span>
        {tokens.map((token, idx) => {
          if (/^\s+$/.test(token)) {
            return <span key={idx}>{token}</span>;
          }
          if (idx === 0) {
            return (
              <span key={idx} className="text-emerald-300 font-semibold">
                {token}
              </span>
            );
          }
          if (/^(&&|\|\||\|+|>>?|<|;)$/.test(token)) {
            return (
              <span key={idx} className="text-amber-400 font-bold">
                {token}
              </span>
            );
          }
          if (/^--?[a-zA-Z0-9_-]+/.test(token)) {
            return (
              <span key={idx} className="text-sky-300">
                {token}
              </span>
            );
          }
          if (token.startsWith("$")) {
            return (
              <span key={idx} className="text-purple-300">
                {token}
              </span>
            );
          }
          return (
            <span key={idx} className="text-slate-100">
              {token}
            </span>
          );
        })}
      </div>
    );
  });
}

const CUSTOM_ENVS_STORAGE_KEY = "workspace_custom_command_envs";

export default function CommandsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [commands, setCommands] = useState<SavedCommand[]>([]);
  const [customEnvs, setCustomEnvs] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");
  const [isSeeding, setIsSeeding] = useState(false);

  // Copy state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formCommand, setFormCommand] = useState("");
  const [formCategory, setFormCategory] = useState<string>("github");
  const [formPinned, setFormPinned] = useState(false);

  // Custom Environment Creation State inside Modal / Filter Bar
  const [isAddingCustomEnv, setIsAddingCustomEnv] = useState(false);
  const [customEnvInput, setCustomEnvInput] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const customEnvInputRef = useRef<HTMLInputElement>(null);

  // Load saved custom environments from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_ENVS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCustomEnvs(parsed.filter((x) => typeof x === "string" && x.trim()));
        }
      }
    } catch {}
  }, []);

  const persistCustomEnv = useCallback((envName: string) => {
    const clean = envName.trim();
    if (!clean) return;
    const isDefault = DEFAULT_CATEGORIES.some(
      (d) => d.id.toLowerCase() === clean.toLowerCase() || d.label.toLowerCase() === clean.toLowerCase()
    );
    if (isDefault) return;

    setCustomEnvs((prev) => {
      if (prev.some((p) => p.toLowerCase() === clean.toLowerCase())) return prev;
      const next = [...prev, clean];
      try {
        localStorage.setItem(CUSTOM_ENVS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Merge default categories + custom environments from both saved commands and user-created customEnvs
  const allCategories = useMemo<CategoryMeta[]>(() => {
    const list: CategoryMeta[] = [...DEFAULT_CATEGORIES];
    const seen = new Set(DEFAULT_CATEGORIES.map((c) => c.id.toLowerCase()));
    for (const d of DEFAULT_CATEGORIES) {
      seen.add(d.label.toLowerCase());
    }

    const candidates = [
      ...customEnvs,
      ...commands.map((c) => c.category).filter(Boolean),
    ];

    for (const raw of candidates) {
      const clean = raw.trim();
      if (!clean) continue;
      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        list.push(buildCustomCategoryMeta(clean));
      }
    }
    return list;
  }, [customEnvs, commands]);

  // Check auth
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

  // Press "/" anywhere outside an input to focus the command search bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const isInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
      if (e.key === "/" && !isInput && !isModalOpen) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === "Escape" && isModalOpen) {
        setIsModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isModalOpen]);

  // Load commands from database
  const loadCommands = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/commands");
      if (res.ok) {
        const data: SavedCommand[] = await res.json();
        setCommands(data || []);
      }
    } catch (err) {
      console.error("Failed to load commands:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadCommands();
    }
  }, [isAuthenticated, loadCommands]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuthenticated(false);
      window.location.href = "/";
    }
  };

  // Open modal for new command
  const handleOpenAdd = (defaultCat?: string) => {
    setEditingId(null);
    setFormTitle("");
    setFormCommand("");
    setFormCategory(
      defaultCat && defaultCat !== "all" && defaultCat !== "pinned" ? defaultCat : "github"
    );
    setFormPinned(false);
    setIsAddingCustomEnv(false);
    setCustomEnvInput("");
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEdit = (item: SavedCommand) => {
    setEditingId(item.id);
    setFormTitle(item.title || "");
    setFormCommand(item.command);
    setFormCategory(item.category || "github");
    setFormPinned(Boolean(item.isPinned));
    setIsAddingCustomEnv(false);
    setCustomEnvInput("");
    setIsModalOpen(true);
  };

  // Confirm adding a custom environment inside the modal
  const handleConfirmCustomEnv = () => {
    const clean = customEnvInput.trim();
    if (!clean) return;
    // Check if matches an existing category
    const existing = allCategories.find(
      (c) => c.id.toLowerCase() === clean.toLowerCase() || c.label.toLowerCase() === clean.toLowerCase()
    );
    if (existing) {
      setFormCategory(existing.id);
    } else {
      persistCustomEnv(clean);
      setFormCategory(clean);
    }
    setCustomEnvInput("");
    setIsAddingCustomEnv(false);
  };

  // Delete a custom environment pill if no commands use it (or remove from saved list)
  const handleRemoveCustomEnv = (envId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomEnvs((prev) => {
      const next = prev.filter((item) => item.toLowerCase() !== envId.toLowerCase());
      try {
        localStorage.setItem(CUSTOM_ENVS_STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
    if (formCategory.toLowerCase() === envId.toLowerCase()) {
      setFormCategory("github");
    }
    if (activeCategory.toLowerCase() === envId.toLowerCase()) {
      setActiveCategory("all");
    }
  };

  // 1-Click Clipboard Copy
  const handleCopyCommand = (id: string, cmdText: string) => {
    if (!cmdText) return;
    navigator.clipboard.writeText(cmdText);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((cur) => (cur === id ? null : cur));
    }, 1800);
  };

  // Toggle Pin directly from row
  const handleTogglePin = async (item: SavedCommand) => {
    const updatedPin = !item.isPinned;
    setCommands((prev) =>
      prev.map((c) => (c.id === item.id ? { ...c, isPinned: updatedPin } : c))
    );
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...item,
          isPinned: updatedPin,
        }),
      });
      if (!res.ok) throw new Error("Failed to update pin");
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
      setCommands((prev) =>
        prev.map((c) => (c.id === item.id ? { ...c, isPinned: item.isPinned } : c))
      );
    }
  };

  // Save via API
  const handleSaveCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCommand.trim()) {
      return;
    }

    // If user typed a custom environment name in the input box and didn't click "Add" yet, use it automatically
    let finalCategory = formCategory.trim() || "github";
    if (isAddingCustomEnv && customEnvInput.trim()) {
      finalCategory = customEnvInput.trim();
      persistCustomEnv(finalCategory);
    } else {
      persistCustomEnv(finalCategory);
    }

    const idToUse = editingId || `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const payload: Partial<SavedCommand> = {
      id: idToUse,
      title: formTitle.trim(),
      command: formCommand.trim(),
      category: finalCategory,
      isPinned: formPinned,
    };

    setSaveStatus("saving");
    try {
      const res = await fetch("/api/commands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save command");
      const { item }: { item: SavedCommand } = await res.json();

      if (editingId) {
        setCommands((prev) => prev.map((c) => (c.id === editingId ? item : c)));
      } else {
        setCommands((prev) => [item, ...prev]);
      }

      setSaveStatus("saved");
      setIsModalOpen(false);
    } catch (err) {
      console.error("Save command error:", err);
      setSaveStatus("error");
      alert("Could not save command to the database. Check your connection and try again.");
    }
  };

  // Delete via API
  const handleDeleteCommand = async (id: string, label?: string) => {
    const display = label?.trim() || "this command";
    if (!confirm(`Remove "${display}" from your command vault?`)) return;

    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/commands?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete command");

      setCommands((prev) => prev.filter((c) => c.id !== id));
      setSaveStatus("saved");
    } catch (err) {
      console.error("Delete command error:", err);
      setSaveStatus("error");
      alert("Could not remove command from the database.");
    }
  };

  // Seed starter commands for new users
  const handleLoadStarterCommands = async () => {
    if (isSeeding) return;
    setIsSeeding(true);
    setSaveStatus("saving");
    try {
      const created: SavedCommand[] = [];
      for (const sample of STARTER_COMMANDS) {
        const res = await fetch("/api/commands", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            ...sample,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.item) created.push(data.item);
        }
      }
      setCommands((prev) => [...created, ...prev]);
      setSaveStatus("saved");
    } catch (err) {
      console.error("Starter seed error:", err);
      setSaveStatus("error");
    } finally {
      setIsSeeding(false);
    }
  };

  // Counts per category
  const counts = useMemo(() => {
    const map: Record<string, number> = {
      all: commands.length,
      pinned: commands.filter((c) => c.isPinned).length,
    };
    for (const cat of allCategories) {
      map[cat.id] = commands.filter(
        (c) => (c.category || "").toLowerCase() === cat.id.toLowerCase()
      ).length;
    }
    return map;
  }, [commands, allCategories]);

  // Filtered & sorted commands (pinned always float to top)
  const filteredCommands = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return commands
      .filter((item) => {
        if (activeCategory === "pinned" && !item.isPinned) return false;
        if (
          activeCategory !== "all" &&
          activeCategory !== "pinned" &&
          (item.category || "").toLowerCase() !== activeCategory.toLowerCase()
        ) {
          return false;
        }
        if (!q) return true;
        return (
          (item.title && item.title.toLowerCase().includes(q)) ||
          item.command.toLowerCase().includes(q) ||
          (item.category && item.category.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        if (Boolean(a.isPinned) !== Boolean(b.isPinned)) {
          return a.isPinned ? -1 : 1;
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [commands, activeCategory, searchQuery]);

  const selectedCatMeta = useMemo(
    () => resolveCategoryMeta(formCategory, allCategories),
    [formCategory, allCategories]
  );

  // Auth loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Verifying access...</p>
      </div>
    );
  }

  // Unauthenticated -> Show Login Form
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
    <div className="min-h-screen bg-[#060911] text-slate-100 font-sans flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Navigation Bar */}
      <header className="bg-slate-950/90 border-b border-slate-800/80 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-950/90 border border-emerald-500/40 flex items-center justify-center font-mono font-bold text-emerald-400 text-xs shadow-inner">
              &gt;_
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight tracking-tight">
                Commands
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    saveStatus === "saving"
                      ? "bg-amber-400 animate-pulse"
                      : saveStatus === "error"
                      ? "bg-rose-500"
                      : "bg-emerald-400"
                  }`}
                />
                <span className="text-[11px] text-slate-400 font-mono">
                  {saveStatus === "saving"
                    ? "syncing..."
                    : saveStatus === "error"
                    ? "sync error"
                    : "lifetime vault synced"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Link
              href="/"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/70 hover:bg-slate-800 transition"
            >
              ← Hub
            </Link>
            <Link
              href="/projects"
              className="hidden sm:inline-block text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/70 hover:bg-slate-800 transition"
            >
              Projects
            </Link>
            <Link
              href="/subscriptions"
              className="hidden md:inline-block text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/70 hover:bg-slate-800 transition"
            >
              Subscriptions
            </Link>
            <Link
              href="/passwords"
              className="hidden md:inline-block text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/70 hover:bg-slate-800 transition"
            >
              Passwords
            </Link>
            <Link
              href="/prompts"
              className="hidden sm:inline-block text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-900/70 hover:bg-slate-800 transition"
            >
              Prompts
            </Link>

            <button
              onClick={() => handleOpenAdd(activeCategory)}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold rounded-lg text-xs transition cursor-pointer shadow-sm shadow-emerald-600/20 flex items-center gap-1.5"
            >
              <span>+ Save command</span>
            </button>

            <NotificationBell />

            <Link
              href="/settings"
              className="p-1.5 rounded-lg border border-slate-800 bg-slate-900/70 hover:bg-slate-800 text-slate-300 hover:text-white transition flex items-center justify-center"
              title="Settings"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>

            <button
              onClick={handleLogout}
              className="text-xs text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/60 px-2.5 py-1.5 rounded-lg border border-red-500/30 transition cursor-pointer"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workbench */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 sm:py-10 space-y-6">
        {/* Characteristic Hero: Live Terminal Search & Environment Bar */}
        <section className="rounded-2xl bg-[#0B101D] border border-slate-800/90 shadow-2xl overflow-hidden">
          <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5 border-b border-slate-800/80">
            <div className="space-y-1.5 max-w-xl">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Personal CLI Reference
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
                Keep the exact GitHub, npm, Linux, and custom environment commands you never want to look up twice.
              </p>
            </div>

            {/* Interactive Terminal Search Input */}
            <div className="w-full lg:w-96">
              <div className="relative flex items-center bg-[#050811] border border-slate-800 focus-within:border-emerald-500/70 rounded-xl px-3.5 py-2.5 transition">
                <span className="font-mono text-xs font-bold text-emerald-400 mr-2.5 select-none">
                  grep
                </span>
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Filter by command, flag, or description..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-xs sm:text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none"
                />
                {searchQuery ? (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="text-slate-400 hover:text-white text-xs ml-2 cursor-pointer"
                    title="Clear filter"
                  >
                    ✕
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 rounded ml-2 select-none">
                    /
                  </kbd>
                )}
              </div>
            </div>
          </div>

          {/* Environment Filter Rail */}
          <div className="px-5 py-3 bg-[#080C17] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setActiveCategory("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
                  activeCategory === "all"
                    ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                }`}
              >
                <span>All environments</span>
                <span className="font-mono text-[11px] text-slate-400">{counts.all}</span>
              </button>

              {counts.pinned > 0 && (
                <button
                  onClick={() => setActiveCategory("pinned")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                    activeCategory === "pinned"
                      ? "bg-amber-950/70 text-amber-300 border border-amber-500/40"
                      : "text-slate-400 hover:text-amber-300 hover:bg-slate-900"
                  }`}
                >
                  <span>★ Pinned</span>
                  <span className="font-mono text-[11px] opacity-80">{counts.pinned}</span>
                </button>
              )}

              <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

              {allCategories.map((cat) => {
                const count = counts[cat.id] || 0;
                const isActive = activeCategory.toLowerCase() === cat.id.toLowerCase();
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-2 ${
                      isActive
                        ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${cat.dotClass}`} />
                    <span>{cat.label}</span>
                    {count > 0 && (
                      <span className="font-mono text-[11px] text-slate-400">{count}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => handleOpenAdd(activeCategory)}
              className="text-xs font-mono text-emerald-400 hover:text-emerald-300 transition cursor-pointer hidden md:flex items-center gap-1"
            >
              <span>+ new entry</span>
            </button>
          </div>
        </section>

        {/* Command Ledger Content */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-400">
            <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm font-mono">Loading saved commands...</p>
          </div>
        ) : filteredCommands.length === 0 ? (
          /* Empty State */
          <div className="rounded-2xl bg-[#0B101D] border border-slate-800/80 p-8 sm:p-12 text-center max-w-xl mx-auto my-8 space-y-5">
            <div className="w-12 h-12 rounded-xl bg-emerald-950/70 border border-emerald-500/30 font-mono text-base font-bold text-emerald-400 flex items-center justify-center mx-auto">
              &gt;_
            </div>
            <div className="space-y-1.5">
              <h3 className="text-base font-bold text-white">
                {searchQuery || activeCategory !== "all"
                  ? "No commands match this filter"
                  : "Your command vault is empty"}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto leading-relaxed">
                {searchQuery || activeCategory !== "all"
                  ? "Clear the search filter or switch back to all environments to see your saved commands."
                  : "Save GitHub workflows, npm scripts, Linux diagnostics, or any custom CLI commands with a short note so they are always one click away."}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 flex-wrap pt-1">
              {searchQuery || activeCategory !== "all" ? (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("all");
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer"
                >
                  Show all commands
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleOpenAdd("github")}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg transition cursor-pointer"
                  >
                    + Save your first command
                  </button>
                  <button
                    onClick={handleLoadStarterCommands}
                    disabled={isSeeding}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium rounded-lg transition cursor-pointer disabled:opacity-50"
                  >
                    {isSeeding ? "Loading starter pack..." : "Load 5 essential Git & Linux commands"}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Terminal Rack List */
          <div className="space-y-3">
            {filteredCommands.map((item) => {
              const cat = resolveCategoryMeta(item.category, allCategories);
              const isCopied = copiedId === item.id;

              return (
                <article
                  key={item.id}
                  className={`group rounded-2xl bg-[#0B101D] border transition-colors ${
                    item.isPinned
                      ? "border-emerald-500/35 hover:border-emerald-500/60"
                      : "border-slate-800/90 hover:border-slate-700"
                  } p-4 sm:p-5 shadow-lg`}
                >
                  <div className="flex flex-col gap-3">
                    {/* Top Row: Category Badge & Row Controls */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-medium border ${cat.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${cat.dotClass}`} />
                          {cat.label}
                        </span>
                      </div>

                      {/* Pin, Edit, Delete Controls */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleTogglePin(item)}
                          title={item.isPinned ? "Unpin command" : "Pin command to top"}
                          className={`p-1.5 rounded-lg text-xs transition cursor-pointer ${
                            item.isPinned
                              ? "text-amber-400 bg-amber-950/40 border border-amber-500/30"
                              : "text-slate-500 hover:text-slate-300 hover:bg-slate-900"
                          }`}
                        >
                          ★
                        </button>

                        <button
                          onClick={() => handleOpenEdit(item)}
                          title="Edit command"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>

                        <button
                          onClick={() => handleDeleteCommand(item.id, item.title || item.command)}
                          title="Remove command"
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800/80 rounded-lg transition cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Centerpiece: Terminal Command Strip with Integrated Copy Button */}
                    <div className="relative flex items-center justify-between gap-3 rounded-xl bg-[#050811] border border-slate-800/90 px-4 py-3 font-mono text-xs sm:text-sm overflow-x-auto">
                      <div className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all pr-2">
                        {renderHighlightedCommand(item.command)}
                      </div>

                      <button
                        onClick={() => handleCopyCommand(item.id, item.command)}
                        className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-sans font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                          isCopied
                            ? "bg-emerald-500 text-slate-950 shadow-sm"
                            : "bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80"
                        }`}
                      >
                        {isCopied ? (
                          <>
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth="2"
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                            <span>Copy command</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Optional "What does this command do?" note */}
                    {item.title && (
                      <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-wrap leading-relaxed pl-1">
                        {item.title}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* SAVE / EDIT COMMAND MODAL */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-[#0B101D] border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-emerald-950 border border-emerald-500/40 flex items-center justify-center text-emerald-400 text-xs font-mono font-bold">
                  &gt;_
                </div>
                <h3 className="text-base font-bold text-white">
                  {editingId ? "Edit command" : "Save command to vault"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm p-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCommand} className="space-y-4">
              {/* Category Selector Pills + Custom Environment Creator */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-slate-300">
                    Environment
                  </label>
                  {!isAddingCustomEnv && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCustomEnv(true);
                        setTimeout(() => customEnvInputRef.current?.focus(), 50);
                      }}
                      className="text-xs font-mono text-emerald-400 hover:text-emerald-300 transition cursor-pointer flex items-center gap-1"
                    >
                      <span>+ Custom environment</span>
                    </button>
                  )}
                </div>

                {/* Custom Environment Input Box (when toggled) */}
                {isAddingCustomEnv && (
                  <div className="flex items-center gap-2 p-2 rounded-xl bg-[#050811] border border-emerald-500/50">
                    <input
                      ref={customEnvInputRef}
                      type="text"
                      placeholder="e.g. Python, AWS CLI, Kubernetes, PowerShell, Rust..."
                      value={customEnvInput}
                      onChange={(e) => setCustomEnvInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleConfirmCustomEnv();
                        }
                      }}
                      className="flex-1 bg-transparent px-2 py-1 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmCustomEnv}
                      className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCustomEnv(false);
                        setCustomEnvInput("");
                      }}
                      className="px-2 py-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto pr-0.5">
                  {allCategories.map((cat) => {
                    const selected = formCategory.toLowerCase() === cat.id.toLowerCase();
                    const canRemoveCustom =
                      cat.isCustom && (counts[cat.id] || 0) === 0;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => setFormCategory(cat.id)}
                        className={`group/pill px-3 py-2 rounded-xl border text-left text-xs font-medium transition cursor-pointer flex items-center justify-between gap-2 ${
                          selected
                            ? "bg-slate-800/90 border-emerald-500/60 text-white shadow-sm"
                            : "bg-[#050811] border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2 h-2 rounded-full shrink-0 ${cat.dotClass}`} />
                          <span className="truncate">{cat.label}</span>
                        </div>
                        {canRemoveCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleRemoveCustomEnv(cat.id, e)}
                            title="Remove custom environment"
                            className="text-[10px] text-slate-500 hover:text-rose-400 opacity-0 group-hover/pill:opacity-100 transition px-1"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {/* Quick "+ Custom" Tile inside Grid */}
                  {!isAddingCustomEnv && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingCustomEnv(true);
                        setTimeout(() => customEnvInputRef.current?.focus(), 50);
                      }}
                      className="px-3 py-2 rounded-xl border border-dashed border-slate-700 hover:border-emerald-500/60 bg-[#050811]/60 text-slate-400 hover:text-emerald-400 text-xs font-mono transition cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>+ Custom...</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Command Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  Command *
                </label>
                <div className="relative rounded-xl bg-[#050811] border border-slate-800 focus-within:border-emerald-500/70 p-3 transition">
                  <div className="flex items-start gap-2">
                    <span className="font-mono text-xs font-bold text-emerald-400 pt-0.5 select-none">
                      $
                    </span>
                    <textarea
                      required
                      rows={3}
                      placeholder={selectedCatMeta.placeholderCmd}
                      value={formCommand}
                      onChange={(e) => setFormCommand(e.target.value)}
                      className="w-full bg-transparent text-xs sm:text-sm font-mono text-slate-100 placeholder-slate-600 focus:outline-none resize-y leading-relaxed"
                    />
                  </div>
                </div>
              </div>

              {/* What does this command do? (Optional Textarea) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300">
                  What does this command do? <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder={selectedCatMeta.placeholderTitle}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-[#050811] border border-slate-800 focus:border-emerald-500/70 rounded-xl p-3 text-xs sm:text-sm text-slate-200 placeholder-slate-600 focus:outline-none transition resize-y leading-relaxed"
                />
              </div>

              {/* Pin Toggle */}
              <label className="flex items-center gap-2.5 pt-1 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formPinned}
                  onChange={(e) => setFormPinned(e.target.checked)}
                  className="rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
                />
                <span className="text-xs text-slate-300">
                  Pin this command to the top of my list
                </span>
              </label>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveStatus === "saving"}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 rounded-lg text-xs font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-2"
                >
                  {saveStatus === "saving" && (
                    <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{editingId ? "Save changes" : "Save command"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
