"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import type { SavedPrompt } from "@/lib/types";

export default function PromptsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">("saved");

  // Copy notification state (tracks promptId -> boolean)
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formHeading, setFormHeading] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrompt, setFormPrompt] = useState("");

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

  // Load prompts from database
  const loadPrompts = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/prompts");
      if (res.ok) {
        const data: SavedPrompt[] = await res.json();
        setPrompts(data || []);
      }
    } catch (err) {
      console.error("Failed to load prompts:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadPrompts();
    }
  }, [isAuthenticated, loadPrompts]);

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

  // Open modal for new prompt
  const handleOpenAdd = () => {
    setEditingId(null);
    setFormHeading("");
    setFormDescription("");
    setFormPrompt("");
    setIsModalOpen(true);
  };

  // Open modal for editing
  const handleOpenEdit = (item: SavedPrompt) => {
    setEditingId(item.id);
    setFormHeading(item.heading);
    setFormDescription(item.description || "");
    setFormPrompt(item.prompt);
    setIsModalOpen(true);
  };

  // 1-Click Clipboard Copy
  const handleCopyPrompt = (id: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((cur) => (cur === id ? null : cur));
    }, 2000);
  };

  // Save via API
  const handleSavePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formHeading.trim() || !formPrompt.trim()) {
      alert("Heading and Prompt content are required.");
      return;
    }

    const idToUse = editingId || `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const payload: Partial<SavedPrompt> = {
      id: idToUse,
      heading: formHeading.trim(),
      description: formDescription.trim(),
      prompt: formPrompt.trim(),
    };

    setSaveStatus("saving");
    try {
      const res = await fetch("/api/prompts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to save prompt");
      const { item }: { item: SavedPrompt } = await res.json();

      if (editingId) {
        setPrompts((prev) => prev.map((p) => (p.id === editingId ? item : p)));
      } else {
        setPrompts((prev) => [item, ...prev]);
      }

      setSaveStatus("saved");
      setIsModalOpen(false);
    } catch (err) {
      console.error("Save prompt error:", err);
      setSaveStatus("error");
      alert("Failed to save prompt to database.");
    }
  };

  // Delete via API
  const handleDeletePrompt = async (id: string, heading: string) => {
    if (!confirm(`Delete prompt "${heading}" from database?`)) return;

    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/prompts?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete prompt");

      setPrompts((prev) => prev.filter((p) => p.id !== id));
      setSaveStatus("saved");
    } catch (err) {
      console.error("Delete prompt error:", err);
      setSaveStatus("error");
      alert("Failed to delete prompt from database.");
    }
  };

  // Filtered prompts
  const filteredPrompts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return prompts;
    return prompts.filter(
      (p) =>
        p.heading.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)) ||
        p.prompt.toLowerCase().includes(q)
    );
  }, [prompts, searchQuery]);

  // Auth loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-blue-600/30">
              P
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">
                Prompt Saver
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span className="text-[11px] text-slate-400">
                  Supabase PG: {saveStatus === "saving" ? "Saving..." : saveStatus === "error" ? "Sync Error" : "Synced"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 transition"
              title="Home Hub"
            >
              ← Hub
            </Link>
            <Link
              href="/projects"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 transition"
              title="Projects"
            >
              Projects
            </Link>
            <Link
              href="/subscriptions"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 transition"
              title="Subscriptions"
            >
              Subscriptions
            </Link>
            <Link
              href="/passwords"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 transition"
              title="Passwords"
            >
              Passwords
            </Link>
            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition cursor-pointer shadow-sm shadow-blue-600/30 flex items-center gap-1.5"
            >
              <span>+ Add Prompt</span>
            </button>
            <Link
              href="/settings"
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition flex items-center justify-center"
              title="Settings & Theme Selector"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/60 px-2.5 py-1.5 rounded-lg border border-red-500/30 transition cursor-pointer"
              title="Log Out"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 space-y-6">
        {/* Banner with Stats & Search */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>AI Prompt Library</span>
              <span className="text-xs font-semibold bg-blue-950/80 text-blue-400 border border-blue-500/30 px-2.5 py-0.5 rounded-full">
                {prompts.length} {prompts.length === 1 ? "Prompt" : "Prompts"}
              </span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Store and reuse your high-impact prompts with headings, descriptions, and 1-click clipboard copy.
            </p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <svg
                className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search by heading, text, or tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 focus:border-blue-500 pl-9 pr-8 py-2 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 text-xs cursor-pointer"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              onClick={handleOpenAdd}
              className="hidden sm:flex shrink-0 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-600/20 transition cursor-pointer items-center gap-1.5"
            >
              <span>+ Add Prompt</span>
            </button>
          </div>
        </div>

        {/* Loading state */}
        {isLoading ? (
          <div className="py-20 text-center text-slate-500">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm font-medium">Loading prompts from database...</p>
          </div>
        ) : filteredPrompts.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center rounded-2xl bg-slate-900/40 border border-slate-800/80 space-y-4 max-w-lg mx-auto my-12">
            <div className="w-14 h-14 rounded-2xl bg-blue-950/60 border border-blue-500/30 text-2xl flex items-center justify-center mx-auto text-blue-400">
              💡
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {searchQuery ? "No matching prompts found" : "No saved prompts yet"}
              </h3>
              <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                {searchQuery
                  ? "Try searching with a different term or clear the filter."
                  : "Save your favorite ChatGPT, Claude, and Gemini prompts to use whenever you need them."}
              </p>
            </div>
            {!searchQuery && (
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-md shadow-blue-600/30 transition cursor-pointer"
              >
                + Add Your First Prompt
              </button>
            )}
          </div>
        ) : (
          /* Prompt Cards Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredPrompts.map((item) => {
              const isCopied = copiedId === item.id;
              const wordCount = item.prompt ? item.prompt.trim().split(/\s+/).length : 0;
              const charCount = item.prompt ? item.prompt.length : 0;

              return (
                <div
                  key={item.id}
                  className="group bg-slate-900/80 border border-slate-800 hover:border-blue-500/50 rounded-2xl p-5 shadow-lg transition-all duration-200 flex flex-col justify-between space-y-4"
                >
                  {/* Card Header */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <h3 className="font-bold text-white text-base leading-snug group-hover:text-blue-400 transition-colors truncate">
                          {item.heading}
                        </h3>
                        {item.description && (
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* Top Action Buttons */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* 1-Click Copy Button */}
                        <button
                          onClick={() => handleCopyPrompt(item.id, item.prompt)}
                          title="Copy prompt text to clipboard"
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all duration-150 flex items-center gap-1.5 cursor-pointer ${
                            isCopied
                              ? "bg-emerald-950 border border-emerald-500/40 text-emerald-400 shadow-sm shadow-emerald-500/20"
                              : "bg-blue-950/60 hover:bg-blue-600 border border-blue-500/30 text-blue-300 hover:text-white"
                          }`}
                        >
                          {isCopied ? (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                              </svg>
                              <span>Copy</span>
                            </>
                          )}
                        </button>

                        {/* Edit Button */}
                        <button
                          onClick={() => handleOpenEdit(item)}
                          title="Edit Prompt"
                          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeletePrompt(item.id, item.heading)}
                          title="Delete Prompt"
                          className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Prompt Content Preview Box */}
                    <div className="relative mt-2">
                      <pre className="bg-slate-950/90 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-300 font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 selection:bg-blue-600/30">
                        {item.prompt}
                      </pre>
                    </div>
                  </div>

                  {/* Card Footer Info */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                      {wordCount} words • {charCount} chars
                    </span>
                    <span className="text-slate-400 font-mono text-[10px]">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ADD / EDIT PROMPT MODAL */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
                  💡
                </div>
                <h3 className="text-base font-bold text-white">
                  {editingId ? "Edit Prompt" : "Save New Prompt"}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm p-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePrompt} className="space-y-4">
              {/* Heading Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Prompt Heading / Title *</span>
                  <span className="text-[11px] text-slate-400 font-normal">e.g., Code Refactor Specialist</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next.js Architecture Review"
                  value={formHeading}
                  onChange={(e) => setFormHeading(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition"
                  autoFocus
                />
              </div>

              {/* Description Field */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Description / Context</span>
                  <span className="text-[11px] text-slate-400 font-normal">(Optional note or tags)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Use for optimizing app router structure and components"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition"
                />
              </div>

              {/* Prompt Text Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Prompt Content *
                  </label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {formPrompt ? formPrompt.length : 0} characters
                  </span>
                </div>
                <textarea
                  required
                  rows={8}
                  placeholder={`You are an expert AI coding assistant. Review the following code for performance bottlenecks, edge cases, and architectural clean code principles:\n\n[Code snippet or variables]`}
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-lg p-3 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none transition resize-y leading-relaxed"
                />
              </div>

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
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-md shadow-blue-600/30 transition cursor-pointer flex items-center gap-2"
                >
                  {saveStatus === "saving" && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  )}
                  <span>{editingId ? "Update Prompt" : "Save Prompt to Database"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
