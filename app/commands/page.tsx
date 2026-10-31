"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { LoginForm } from "@/components/LoginForm";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
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
    label: "Git",
    promptPrefix: "git",
    badgeClass: "bg-orange-500/10 text-orange-300 border-orange-500/25",
    dotClass: "bg-orange-400",
    placeholderCmd: "git log --oneline --graph --decorate --all",
    placeholderTitle: "Shows a clean branch graph of all commits.",
  },
  {
    id: "npm",
    label: "npm",
    promptPrefix: "npm",
    badgeClass: "bg-rose-500/10 text-rose-300 border-rose-500/25",
    dotClass: "bg-rose-400",
    placeholderCmd: "npm outdated --depth=0",
    placeholderTitle: "Lists direct dependencies with newer versions.",
  },
  {
    id: "linux",
    label: "Linux",
    promptPrefix: "sh",
    badgeClass: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25",
    dotClass: "bg-emerald-400",
    placeholderCmd: "lsof -i :3000",
    placeholderTitle: "Shows the process listening on port 3000.",
  },
  {
    id: "docker",
    label: "Docker",
    promptPrefix: "docker",
    badgeClass: "bg-sky-500/10 text-sky-300 border-sky-500/25",
    dotClass: "bg-sky-400",
    placeholderCmd: "docker system prune -af --volumes",
    placeholderTitle: "Removes stopped containers, networks, and dangling images.",
  },
  {
    id: "database",
    label: "SQL",
    promptPrefix: "sql",
    badgeClass: "bg-indigo-500/10 text-indigo-300 border-indigo-500/25",
    dotClass: "bg-indigo-400",
    placeholderCmd: "pg_dump -Fc --no-acl --no-owner mydb > mydb.dump",
    placeholderTitle: "Creates a portable Postgres backup.",
  },
  {
    id: "other",
    label: "CLI",
    promptPrefix: "cli",
    badgeClass: "bg-white/[0.05] text-slate-300 border-white/[0.1]",
    dotClass: "bg-slate-400",
    placeholderCmd: "ssh -i ~/.ssh/id_ed25519 user@server-ip",
    placeholderTitle: "Opens an SSH session using ed25519 key.",
  },
];

const CUSTOM_PALETTES = [
  {
    badgeClass: "bg-teal-500/10 text-teal-300 border-teal-500/25",
    dotClass: "bg-teal-400",
  },
  {
    badgeClass: "bg-purple-500/10 text-purple-300 border-purple-500/25",
    dotClass: "bg-purple-400",
  },
  {
    badgeClass: "bg-amber-500/10 text-amber-300 border-amber-500/25",
    dotClass: "bg-amber-400",
  },
  {
    badgeClass: "bg-cyan-500/10 text-cyan-300 border-cyan-500/25",
    dotClass: "bg-cyan-400",
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

function resolveCategoryMeta(
  catId?: string,
  allCategories: CategoryMeta[] = DEFAULT_CATEGORIES
): CategoryMeta {
  if (!catId) return DEFAULT_CATEGORIES[0];
  const found = allCategories.find(
    (c) => c.id.toLowerCase() === catId.toLowerCase()
  );
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
    title: "Find and kill process running on port 3000",
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

function renderHighlightedCommand(raw: string): React.ReactNode {
  const lines = raw.split("\n");
  return lines.map((line, lineIdx) => {
    const tokens = line.split(/(\s+)/);
    return (
      <div key={lineIdx} className="leading-relaxed">
        <span className="text-emerald-400 select-none mr-2 font-bold">$</span>
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
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved"
  );
  const [isSeeding, setIsSeeding] = useState(false);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState("");
  const [formCommand, setFormCommand] = useState("");
  const [formCategory, setFormCategory] = useState<string>("github");
  const [formPinned, setFormPinned] = useState(false);

  const [isAddingCustomEnv, setIsAddingCustomEnv] = useState(false);
  const [customEnvInput, setCustomEnvInput] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);
  const customEnvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(CUSTOM_ENVS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCustomEnvs(
            parsed.filter((x) => typeof x === "string" && x.trim())
          );
        }
      }
    } catch {}
  }, []);

  const persistCustomEnv = useCallback((envName: string) => {
    const clean = envName.trim();
    if (!clean) return;
    const isDefault = DEFAULT_CATEGORIES.some(
      (d) =>
        d.id.toLowerCase() === clean.toLowerCase() ||
        d.label.toLowerCase() === clean.toLowerCase()
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

  const handleOpenAdd = (defaultCat?: string) => {
    setEditingId(null);
    setFormTitle("");
    setFormCommand("");
    setFormCategory(
      defaultCat && defaultCat !== "all" && defaultCat !== "pinned"
        ? defaultCat
        : "github"
    );
    setFormPinned(false);
    setIsAddingCustomEnv(false);
    setCustomEnvInput("");
    setIsModalOpen(true);
  };

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

  const handleConfirmCustomEnv = () => {
    const clean = customEnvInput.trim();
    if (!clean) return;
    const existing = allCategories.find(
      (c) =>
        c.id.toLowerCase() === clean.toLowerCase() ||
        c.label.toLowerCase() === clean.toLowerCase()
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

  const handleRemoveCustomEnv = (envId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCustomEnvs((prev) => {
      const next = prev.filter(
        (item) => item.toLowerCase() !== envId.toLowerCase()
      );
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

  const handleCopyCommand = (id: string, cmdText: string) => {
    if (!cmdText) return;
    navigator.clipboard.writeText(cmdText);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((cur) => (cur === id ? null : cur));
    }, 1800);
  };

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
        prev.map((c) =>
          c.id === item.id ? { ...c, isPinned: item.isPinned } : c
        )
      );
    }
  };

  const handleSaveCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCommand.trim()) return;

    let finalCategory = formCategory.trim() || "github";
    if (isAddingCustomEnv && customEnvInput.trim()) {
      finalCategory = customEnvInput.trim();
      persistCustomEnv(finalCategory);
    } else {
      persistCustomEnv(finalCategory);
    }

    const idToUse =
      editingId ||
      `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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
      alert("Could not save command to the database.");
    }
  };

  const handleDeleteCommand = async (id: string, label?: string) => {
    const display = label?.trim() || "this command";
    if (!confirm(`Remove "${display}"?`)) return;

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
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
  }, [commands, activeCategory, searchQuery]);

  const selectedCatMeta = useMemo(
    () => resolveCategoryMeta(formCategory, allCategories),
    [formCategory, allCategories]
  );

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center text-slate-400">
        <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans flex flex-col">
      <WorkspaceHeader
        title="Commands"
        icon=">_"
        saveStatus={saveStatus}
        primaryAction={{
          label: "New Command",
          onClick: () => handleOpenAdd(activeCategory),
          icon: "+",
        }}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-5">
        {/* Minimal Single-Row Header: Title + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Commands
            </h1>
            <span className="text-xs font-mono font-semibold text-slate-400 bg-[#10131c] border border-white/[0.07] px-2.5 py-0.5 rounded-lg">
              {commands.length}
            </span>
          </div>

          <div className="relative flex items-center bg-[#10131c] border border-white/[0.07] focus-within:border-orange-500/60 rounded-xl px-3 py-1.5 w-full sm:w-80 transition">
            <span className="font-mono text-xs font-bold text-emerald-400 mr-2 select-none">
              $
            </span>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Filter commands... (press /)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="text-slate-400 hover:text-white text-xs ml-1.5 cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Compact Environment Pills Bar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => setActiveCategory("all")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              activeCategory === "all"
                ? "bg-white/[0.1] text-white border border-white/[0.12]"
                : "bg-[#10131c] text-slate-400 hover:text-white border border-white/[0.06]"
            }`}
          >
            <span>All</span>
            <span className="font-mono text-[10px] opacity-75">
              {counts.all}
            </span>
          </button>

          {counts.pinned > 0 && (
            <button
              onClick={() => setActiveCategory("pinned")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1 ${
                activeCategory === "pinned"
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/35"
                  : "bg-[#10131c] text-slate-400 hover:text-amber-300 border border-white/[0.06]"
              }`}
            >
              <span>★ Pinned</span>
              <span className="font-mono text-[10px] opacity-75">
                {counts.pinned}
              </span>
            </button>
          )}

          {allCategories.map((cat) => {
            const count = counts[cat.id] || 0;
            const isActive =
              activeCategory.toLowerCase() === cat.id.toLowerCase();
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? "bg-white/[0.1] text-white border border-white/[0.12]"
                    : "bg-[#10131c] text-slate-400 hover:text-white border border-white/[0.06]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${cat.dotClass}`} />
                <span>{cat.label}</span>
                {count > 0 && (
                  <span className="font-mono text-[10px] opacity-70">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Command List */}
        {isLoading ? (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] p-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5" />
            <p className="text-xs">Loading commands...</p>
          </div>
        ) : filteredCommands.length === 0 ? (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] p-12 text-center space-y-3">
            <p className="text-sm text-slate-400">
              {searchQuery || activeCategory !== "all"
                ? "No matching commands."
                : "No commands saved yet."}
            </p>
            <div className="flex items-center justify-center gap-2.5">
              {searchQuery || activeCategory !== "all" ? (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setActiveCategory("all");
                  }}
                  className="px-3.5 py-1.5 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] text-white text-xs font-medium transition cursor-pointer"
                >
                  Reset filter
                </button>
              ) : (
                <>
                  <button
                    onClick={() => handleOpenAdd("github")}
                    className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white font-semibold text-xs rounded-xl transition cursor-pointer"
                  >
                    + New Command
                  </button>
                  <button
                    onClick={handleLoadStarterCommands}
                    disabled={isSeeding}
                    className="px-3.5 py-2 bg-[#10131c] hover:bg-white/[0.06] text-slate-300 border border-white/[0.08] text-xs font-medium rounded-xl transition cursor-pointer"
                  >
                    {isSeeding ? "Loading..." : "Load Starter Pack"}
                  </button>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] divide-y divide-white/[0.06] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            {filteredCommands.map((item) => {
              const cat = resolveCategoryMeta(item.category, allCategories);
              const isCopied = copiedId === item.id;

              return (
                <div
                  key={item.id}
                  className="group p-4 hover:bg-white/[0.015] transition-colors space-y-2"
                >
                  {/* Command Strip + Controls */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border shrink-0 ${cat.badgeClass}`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${cat.dotClass}`}
                        />
                        {cat.label}
                      </span>

                      {item.title && (
                        <span className="text-xs text-slate-300 truncate">
                          {item.title}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleCopyCommand(item.id, item.command)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer ${
                          isCopied
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08]"
                        }`}
                      >
                        {isCopied ? "✓ Copied" : "Copy"}
                      </button>

                      <button
                        onClick={() => handleTogglePin(item)}
                        title={item.isPinned ? "Unpin" : "Pin to top"}
                        className={`w-7 h-7 rounded-lg text-xs flex items-center justify-center transition cursor-pointer ${
                          item.isPinned
                            ? "text-amber-400 bg-amber-500/15"
                            : "text-slate-500 hover:text-slate-300 hover:bg-white/[0.05]"
                        }`}
                      >
                        ★
                      </button>

                      <button
                        onClick={() => handleOpenEdit(item)}
                        title="Edit"
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition cursor-pointer"
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
                            strokeWidth="2"
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>

                      <button
                        onClick={() =>
                          handleDeleteCommand(
                            item.id,
                            item.title || item.command
                          )
                        }
                        title="Delete"
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition cursor-pointer"
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
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Terminal Code Box */}
                  <div
                    onClick={() => handleCopyCommand(item.id, item.command)}
                    title="Click to copy command"
                    className="rounded-xl bg-[#07090e] border border-white/[0.06] hover:border-white/[0.12] px-3.5 py-2.5 font-mono text-xs overflow-x-auto cursor-pointer transition"
                  >
                    {renderHighlightedCommand(item.command)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* SAVE / EDIT COMMAND MODAL */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-[#10131c] border border-white/[0.08] rounded-2xl w-full max-w-lg p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
              <h3 className="text-sm font-bold text-white">
                {editingId ? "Edit Command" : "New Command"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCommand} className="space-y-3.5">
              {/* Environment Selector */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Environment
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingCustomEnv(!isAddingCustomEnv);
                      setTimeout(() => customEnvInputRef.current?.focus(), 50);
                    }}
                    className="text-[11px] font-semibold text-orange-400 hover:text-orange-300 transition cursor-pointer"
                  >
                    {isAddingCustomEnv ? "Cancel" : "+ Custom"}
                  </button>
                </div>

                {isAddingCustomEnv && (
                  <div className="flex items-center gap-1.5">
                    <input
                      ref={customEnvInputRef}
                      type="text"
                      placeholder="e.g. Python, AWS, Rust..."
                      value={customEnvInput}
                      onChange={(e) => setCustomEnvInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleConfirmCustomEnv();
                        }
                      }}
                      className="flex-1 bg-[#07090e] border border-white/[0.1] rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmCustomEnv}
                      className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white font-semibold text-xs transition cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                )}

                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {allCategories.map((cat) => {
                    const selected =
                      formCategory.toLowerCase() === cat.id.toLowerCase();
                    const canRemoveCustom =
                      cat.isCustom && (counts[cat.id] || 0) === 0;
                    return (
                      <div
                        key={cat.id}
                        onClick={() => setFormCategory(cat.id)}
                        className={`group/pill px-2.5 py-1 rounded-lg border text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                          selected
                            ? "bg-orange-500/20 border-orange-500/50 text-orange-200"
                            : "bg-[#07090e] border-white/[0.08] text-slate-400 hover:text-white"
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${cat.dotClass}`}
                        />
                        <span>{cat.label}</span>
                        {canRemoveCustom && (
                          <button
                            type="button"
                            onClick={(e) => handleRemoveCustomEnv(cat.id, e)}
                            className="text-[10px] text-slate-500 hover:text-rose-400 ml-0.5"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Command Input */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Command
                </label>
                <div className="flex items-start gap-2 rounded-xl bg-[#07090e] border border-white/[0.09] focus-within:border-orange-500 p-2.5 transition">
                  <span className="font-mono text-xs font-bold text-emerald-400 pt-0.5 select-none">
                    $
                  </span>
                  <textarea
                    required
                    rows={2}
                    placeholder={selectedCatMeta.placeholderCmd}
                    value={formCommand}
                    onChange={(e) => setFormCommand(e.target.value)}
                    className="w-full bg-transparent text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none resize-y leading-relaxed"
                  />
                </div>
              </div>

              {/* Optional description */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  What does this command do?{" "}
                  <span className="text-slate-500">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  placeholder={selectedCatMeta.placeholderTitle}
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-[#07090e] border border-white/[0.09] focus:border-orange-500 rounded-xl p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition resize-y"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={formPinned}
                  onChange={(e) => setFormPinned(e.target.checked)}
                  className="rounded border-white/20 bg-[#07090e] text-orange-500"
                />
                <span className="text-xs text-slate-300">Pin to top</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveStatus === "saving"}
                  className="px-4 py-1.5 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition cursor-pointer"
                >
                  {editingId ? "Save" : "Add Command"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
