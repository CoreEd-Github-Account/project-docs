"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { LoginForm } from "@/components/LoginForm";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import type { SavedSnippet, SnippetCategory } from "@/lib/types";

const EMOJI_OPTIONS = ["🏷️", "📁", "💻", "⚡", "🔑", "📝", "🚀", "💡", "🛠️", "🔗", "🔒", "🌐"];

export default function SnippetsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [snippets, setSnippets] = useState<SavedSnippet[]>([]);
  const [customCategories, setCustomCategories] = useState<SnippetCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Snippet Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formCategory, setFormCategory] = useState("");

  // Category Modal / Inline Creator State
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatIcon, setNewCatIcon] = useState("🏷️");
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  // Auth check
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

  // Load Snippets
  const loadSnippets = useCallback(async () => {
    try {
      const res = await fetch("/api/snippets");
      if (res.ok) {
        const data = await res.json();
        setSnippets(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error("Failed to load snippets:", err);
    }
  }, []);

  // Load Custom Categories from Database
  const loadCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/snippets/categories");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.categories)) {
          setCustomCategories(data.categories);
        }
      }
    } catch (err) {
      console.error("Failed to load snippet categories:", err);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      setIsLoading(true);
      Promise.all([loadSnippets(), loadCategories()]).finally(() => {
        setIsLoading(false);
      });
    }
  }, [isAuthenticated, loadSnippets, loadCategories]);

  // URL query check
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("imported") === "1") {
        setImportNotice("✓ Shared snippet successfully saved to your Snippets library!");
        const newUrl = window.location.pathname;
        window.history.replaceState({}, "", newUrl);
      }
    }
  }, []);

  // Keyboard shortcut '/' to search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      ) {
        e.preventDefault();
        const searchInput = document.getElementById("snippet-search-input");
        searchInput?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

  // Add / Edit Snippet handlers
  const handleOpenAdd = () => {
    setEditingId(null);
    setFormTitle("");
    setFormDescription("");
    setFormContent("");
    setFormCategory(selectedCategory !== "all" ? selectedCategory : "");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: SavedSnippet) => {
    setEditingId(item.id);
    setFormTitle(item.title);
    setFormDescription(item.description || "");
    setFormContent(item.content);
    setFormCategory(item.category || "");
    setIsModalOpen(true);
  };

  const handleSaveSnippet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formContent.trim()) return;

    const payload = {
      id: editingId || undefined,
      title: formTitle.trim(),
      description: formDescription.trim(),
      content: formContent.trim(),
      category: formCategory.trim(),
    };

    setSaveStatus("saving");
    try {
      const res = await fetch("/api/snippets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save snippet");
      const { item }: { item: SavedSnippet } = await res.json();

      if (editingId) {
        setSnippets((prev) => prev.map((s) => (s.id === editingId ? item : s)));
      } else {
        setSnippets((prev) => [item, ...prev]);
      }

      setSaveStatus("saved");
      setIsModalOpen(false);
    } catch (err) {
      console.error("Save snippet error:", err);
      setSaveStatus("error");
      alert("Failed to save snippet to database.");
    }
  };

  const handleDeleteSnippet = async (id: string, title: string) => {
    if (!confirm(`Delete snippet "${title}"?`)) return;

    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/snippets?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete snippet");

      setSnippets((prev) => prev.filter((s) => s.id !== id));
      setSaveStatus("saved");
    } catch (err) {
      console.error("Delete snippet error:", err);
      setSaveStatus("error");
      alert("Failed to delete snippet from database.");
    }
  };

  const handleCopySnippet = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId(null);
    }, 2000);
  };

  const handleShareSnippet = (id: string) => {
    const url = `${window.location.origin}/snippets/share/${id}`;
    navigator.clipboard.writeText(url);
    setSharedId(id);
    setTimeout(() => {
      setSharedId(null);
    }, 2500);
  };

  // Custom Category Creation with Live Database Sync
  const handleCreateCategory = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const name = newCatName.trim();
    if (!name) return;

    setIsSavingCategory(true);
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/snippets/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, icon: newCatIcon }),
      });

      if (!res.ok) throw new Error("Failed to create category");
      const data = await res.json();
      if (data.success && data.category) {
        setCustomCategories((prev) => {
          const exists = prev.some(
            (c) => c.name.toLowerCase() === data.category.name.toLowerCase()
          );
          if (exists) {
            return prev.map((c) =>
              c.name.toLowerCase() === data.category.name.toLowerCase()
                ? data.category
                : c
            );
          }
          return [...prev, data.category];
        });
        setSelectedCategory(data.category.name);
        setFormCategory(data.category.name);
        setNewCatName("");
        setIsAddCategoryOpen(false);
        setSaveStatus("saved");
      }
    } catch (err) {
      console.error("Failed to create category:", err);
      setSaveStatus("error");
      alert("Failed to create custom category in database.");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (cat: SnippetCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete category "${cat.name}"? Snippets inside will become uncategorized.`)) {
      return;
    }

    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/snippets/categories?id=${encodeURIComponent(cat.id)}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete category");

      setCustomCategories((prev) => prev.filter((c) => c.id !== cat.id));
      if (selectedCategory.toLowerCase() === cat.name.toLowerCase()) {
        setSelectedCategory("all");
      }
      // Update local snippets category if matching
      setSnippets((prev) =>
        prev.map((s) =>
          s.category?.toLowerCase() === cat.name.toLowerCase()
            ? { ...s, category: "" }
            : s
        )
      );
      setSaveStatus("saved");
    } catch (err) {
      console.error("Delete category error:", err);
      setSaveStatus("error");
      alert("Failed to delete category from database.");
    }
  };

  // Filtered snippets based on selected category & search query
  const filteredSnippets = useMemo(() => {
    let list = snippets;

    if (selectedCategory !== "all") {
      if (selectedCategory === "uncategorized") {
        list = list.filter((s) => !s.category || s.category.trim() === "");
      } else {
        list = list.filter(
          (s) => s.category?.toLowerCase() === selectedCategory.toLowerCase()
        );
      }
    }

    const q = searchQuery.toLowerCase().trim();
    if (q) {
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (s.description && s.description.toLowerCase().includes(q)) ||
          s.content.toLowerCase().includes(q)
      );
    }

    return list;
  }, [snippets, selectedCategory, searchQuery]);

  // Uncategorized count
  const uncategorizedCount = useMemo(() => {
    return snippets.filter((s) => !s.category || s.category.trim() === "").length;
  }, [snippets]);

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center text-slate-400">
        <div className="w-7 h-7 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
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
        title="Snippets"
        icon="📋"
        saveStatus={saveStatus}
        primaryAction={{
          label: "New Snippet",
          onClick: handleOpenAdd,
          icon: "+",
        }}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Import notification banner */}
        {importNotice && (
          <div className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between shadow-lg">
            <span>{importNotice}</span>
            <button
              onClick={() => setImportNotice(null)}
              className="text-emerald-400 hover:text-white text-xs cursor-pointer ml-3"
            >
              ✕
            </button>
          </div>
        )}

        {/* Header Controls: Title + Counts + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Snippets
            </h1>
            <span className="text-xs font-mono font-semibold text-rose-400/90 bg-rose-500/10 border border-rose-500/20 px-2.5 py-0.5 rounded-lg">
              {snippets.length}
            </span>
          </div>

          <div className="relative w-full sm:w-80">
            <svg
              className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              id="snippet-search-input"
              type="text"
              placeholder="Search snippets (press '/' to focus)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#10131c] border border-white/[0.08] focus:border-rose-500/60 pl-8 pr-7 py-1.5 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Dynamic Custom Categories Bar (Live Sync) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {/* Base Filter: All */}
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border shrink-0 ${
              selectedCategory === "all"
                ? "bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)]"
                : "bg-[#0d1017] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-[#121620]"
            }`}
          >
            <span>📑</span>
            <span>All</span>
            <span
              className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                selectedCategory === "all"
                  ? "bg-rose-500/20 text-rose-200"
                  : "bg-white/[0.05] text-slate-500"
              }`}
            >
              {snippets.length}
            </span>
          </button>

          {/* User's Custom Categories */}
          {customCategories.map((cat) => {
            const isActive = selectedCategory.toLowerCase() === cat.name.toLowerCase();
            const count = snippets.filter(
              (s) => s.category?.toLowerCase() === cat.name.toLowerCase()
            ).length;

            return (
              <div
                key={cat.id}
                onClick={() => setSelectedCategory(cat.name)}
                className={`group px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border shrink-0 ${
                  isActive
                    ? "bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)]"
                    : "bg-[#0d1017] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-[#121620]"
                }`}
              >
                <span>{cat.icon || "🏷️"}</span>
                <span>{cat.name}</span>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-md ${
                    isActive
                      ? "bg-rose-500/20 text-rose-200"
                      : "bg-white/[0.05] text-slate-500"
                  }`}
                >
                  {count}
                </span>

                {/* Delete Category Button */}
                <button
                  type="button"
                  title="Delete category"
                  onClick={(e) => handleDeleteCategory(cat, e)}
                  className="opacity-0 group-hover:opacity-100 hover:text-rose-400 ml-0.5 text-slate-500 transition cursor-pointer text-xs"
                >
                  ×
                </button>
              </div>
            );
          })}

          {/* Uncategorized if any exist */}
          {uncategorizedCount > 0 && (
            <button
              onClick={() => setSelectedCategory("uncategorized")}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border shrink-0 ${
                selectedCategory === "uncategorized"
                  ? "bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)]"
                  : "bg-[#0d1017] border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-[#121620]"
              }`}
            >
              <span>📁</span>
              <span>Uncategorized</span>
              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-white/[0.05] text-slate-500">
                {uncategorizedCount}
              </span>
            </button>
          )}

          {/* + New Category Button */}
          <button
            type="button"
            onClick={() => setIsAddCategoryOpen(true)}
            className="px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer border border-dashed border-white/[0.15] hover:border-rose-400/50 text-slate-400 hover:text-rose-300 bg-white/[0.02] hover:bg-rose-500/10 shrink-0"
          >
            <span className="text-rose-400 font-bold">+</span>
            <span>New Category</span>
          </button>
        </div>

        {/* Snippets Grid */}
        {isLoading ? (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] p-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5" />
            <p className="text-xs">Loading snippets...</p>
          </div>
        ) : filteredSnippets.length === 0 ? (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] p-12 text-center space-y-3">
            <p className="text-sm text-slate-400">
              {searchQuery
                ? "No matching snippets found."
                : selectedCategory !== "all"
                ? `No snippets in category "${selectedCategory}".`
                : "No saved snippets yet."}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-xl transition cursor-pointer shadow-lg shadow-rose-500/20"
              >
                + New Snippet
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSnippets.map((item) => {
              const isCopied = copiedId === item.id;
              const isShared = sharedId === item.id;
              const catObj = customCategories.find(
                (c) => c.name.toLowerCase() === item.category?.toLowerCase()
              );

              return (
                <div
                  key={item.id}
                  className="group bg-[#0d1017] border border-white/[0.07] hover:border-rose-500/30 rounded-2xl p-4 flex flex-col justify-between gap-3.5 transition-all shadow-[0_12px_30px_rgba(0,0,0,0.5)]"
                >
                  {/* Top: Heading & Category & Actions */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white text-sm truncate">
                          {item.title}
                        </h3>
                        {item.category && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/25 text-rose-300 flex items-center gap-1 shrink-0">
                            <span>{catObj?.icon || "🏷️"}</span>
                            <span>{item.category}</span>
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleCopySnippet(item.id, item.content)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                          isCopied
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                            : "bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08]"
                        }`}
                        title="Copy text snippet to clipboard"
                      >
                        {isCopied ? "✓ Copied" : "Copy"}
                      </button>

                      <button
                        onClick={() => handleShareSnippet(item.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                          isShared
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                            : "bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 border border-white/[0.08]"
                        }`}
                        title="Copy public share link (auto-imports to recipient)"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                          />
                        </svg>
                        {isShared ? "Link Copied!" : "Share"}
                      </button>

                      <button
                        onClick={() => handleOpenEdit(item)}
                        className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/[0.07] transition cursor-pointer"
                        title="Edit snippet"
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
                        onClick={() => handleDeleteSnippet(item.id, item.title)}
                        className="p-1 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
                        title="Delete snippet"
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

                  {/* Snippet Content Box */}
                  <div className="relative rounded-xl bg-[#07090e] border border-white/[0.06] p-3 font-mono text-xs text-slate-200 select-text whitespace-pre-wrap break-words max-h-48 overflow-y-auto scrollbar-thin">
                    {item.content}
                  </div>

                  {/* Bottom: Date & Char count */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      {item.createdAt
                        ? new Date(item.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Recently added"}
                    </span>
                    <span className="font-mono text-[10px]">
                      {item.content.length} chars
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal: Create Custom Category */}
      {isAddCategoryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsAddCategoryOpen(false)}
        >
          <div
            className="bg-[#0d1017] border border-rose-500/30 rounded-2xl w-full max-w-sm shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="text-rose-400">🏷️</span>
                <span>Create Custom Category</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddCategoryOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Category Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Work, Prompts, Credentials..."
                  className="w-full bg-[#07090e] border border-white/[0.09] focus:border-rose-400/60 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Pick an Icon
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {EMOJI_OPTIONS.map((emo) => (
                    <button
                      type="button"
                      key={emo}
                      onClick={() => setNewCatIcon(emo)}
                      className={`h-8 rounded-lg text-sm flex items-center justify-center transition border ${
                        newCatIcon === emo
                          ? "bg-rose-500/20 border-rose-400 text-white"
                          : "bg-[#07090e] border-white/[0.06] hover:bg-white/[0.05] text-slate-300"
                      }`}
                    >
                      {emo}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newCatName.trim() || isSavingCategory}
                  className="px-4 py-1.5 text-xs font-semibold bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-lg shadow-sm shadow-rose-500/20 transition cursor-pointer"
                >
                  {isSavingCategory ? "Saving..." : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add / Edit Snippet */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-[#0d1017] border border-rose-500/30 rounded-2xl w-full max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.8)] p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="text-rose-400">📋</span>
                <span>{editingId ? "Edit Snippet" : "New Snippet"}</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSnippet} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Heading / Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. WiFi Password, Server IP, API Secret..."
                  className="w-full bg-[#07090e] border border-white/[0.09] focus:border-rose-400/60 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      Category
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsAddCategoryOpen(true)}
                      className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                    >
                      + New
                    </button>
                  </div>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-[#07090e] border border-white/[0.09] focus:border-rose-400/60 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none transition cursor-pointer"
                  >
                    <option value="">(No Category)</option>
                    {customCategories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.icon || "🏷️"} {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                    Description{" "}
                    <span className="text-slate-500 text-[10px] normal-case font-normal">
                      (optional)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="e.g. Production credentials or notes..."
                    className="w-full bg-[#07090e] border border-white/[0.09] focus:border-rose-400/60 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase tracking-wider mb-1">
                  Text / Content <span className="text-rose-400">*</span>
                </label>
                <textarea
                  required
                  rows={6}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Paste your important text or snippet here..."
                  className="w-full bg-[#07090e] border border-white/[0.09] focus:border-rose-400/60 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder:text-slate-500 focus:outline-none resize-none transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl cursor-pointer transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!formTitle.trim() || !formContent.trim()}
                  className="px-5 py-2 text-xs font-semibold bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white rounded-xl shadow-md shadow-rose-500/20 transition cursor-pointer"
                >
                  {editingId ? "Update Snippet" : "Save Snippet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
