"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { LoginForm } from "@/components/LoginForm";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import type { SavedPrompt } from "@/lib/types";

export default function PromptsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [prompts, setPrompts] = useState<SavedPrompt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved"
  );

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sharedId, setSharedId] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formHeading, setFormHeading] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formPrompt, setFormPrompt] = useState("");

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

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormHeading("");
    setFormDescription("");
    setFormPrompt("");
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: SavedPrompt) => {
    setEditingId(item.id);
    setFormHeading(item.heading);
    setFormDescription(item.description || "");
    setFormPrompt(item.prompt);
    setIsModalOpen(true);
  };

  const handleCopyPrompt = (id: string, text: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => {
      setCopiedId((cur) => (cur === id ? null : cur));
    }, 1800);
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("imported")) {
        setImportNotice("✓ Shared prompt successfully saved to your collection!");
        setTimeout(() => setImportNotice(null), 4000);
        window.history.replaceState({}, "", "/prompts");
      }
    }
  }, []);

  const handleSharePrompt = (id: string) => {
    const shareUrl = `${window.location.origin}/prompts/share/${encodeURIComponent(id)}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(shareUrl);
    } else {
      const el = document.createElement("textarea");
      el.value = shareUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setSharedId(id);
    setTimeout(() => {
      setSharedId((cur) => (cur === id ? null : cur));
    }, 2000);
  };

  const handleSavePrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formHeading.trim() || !formPrompt.trim()) {
      alert("Heading and Prompt content are required.");
      return;
    }

    const idToUse =
      editingId ||
      `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
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

  const handleDeletePrompt = async (id: string, heading: string) => {
    if (!confirm(`Delete prompt "${heading}"?`)) return;

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
        title="Prompts"
        icon="💡"
        saveStatus={saveStatus}
        primaryAction={{
          label: "New Prompt",
          onClick: handleOpenAdd,
          icon: "+",
        }}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 space-y-5">
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

        {/* Minimal Single-Row Header: Title + Count on Left, Search on Right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Prompts
            </h1>
            <span className="text-xs font-mono font-semibold text-slate-400 bg-[#10131c] border border-white/[0.07] px-2.5 py-0.5 rounded-lg">
              {prompts.length}
            </span>
          </div>

          <div className="relative w-full sm:w-72">
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
              type="text"
              placeholder="Search prompts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#10131c] border border-white/[0.07] focus:border-orange-500/60 pl-8 pr-7 py-1.5 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none transition"
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

        {/* Content */}
        {isLoading ? (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] p-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5" />
            <p className="text-xs">Loading prompts...</p>
          </div>
        ) : filteredPrompts.length === 0 ? (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] p-12 text-center space-y-3">
            <p className="text-sm text-slate-400">
              {searchQuery ? "No matching prompts." : "No saved prompts yet."}
            </p>
            {!searchQuery && (
              <button
                onClick={handleOpenAdd}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
              >
                + New Prompt
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredPrompts.map((item) => {
              const isCopied = copiedId === item.id;

              return (
                <div
                  key={item.id}
                  className="group bg-[#0d1017] border border-white/[0.07] hover:border-white/[0.15] rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all shadow-[0_14px_34px_rgba(0,0,0,0.45)]"
                >
                  {/* Top Row: Heading + Actions */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white text-sm truncate">
                        {item.heading}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-slate-400 truncate mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleCopyPrompt(item.id, item.prompt)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                          isCopied
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                            : "bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08]"
                        }`}
                      >
                        {isCopied ? "✓ Copied" : "Copy"}
                      </button>

                      <button
                        onClick={() => handleSharePrompt(item.id)}
                        title="Copy public share link (auto-saves to recipient's account)"
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                          sharedId === item.id
                            ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                            : "bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08]"
                        }`}
                      >
                        <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                          />
                        </svg>
                        <span>{sharedId === item.id ? "✓ Copied Link" : "Share"}</span>
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
                          handleDeletePrompt(item.id, item.heading)
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

                  {/* Prompt Box */}
                  <pre
                    onClick={() => handleCopyPrompt(item.id, item.prompt)}
                    title="Click to copy prompt"
                    className="bg-[#07090e] border border-white/[0.06] rounded-xl p-3 text-xs text-slate-300 font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto leading-relaxed cursor-pointer hover:border-white/[0.12] transition"
                  >
                    {item.prompt}
                  </pre>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ADD / EDIT PROMPT MODAL */}
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
                {editingId ? "Edit Prompt" : "New Prompt"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSavePrompt} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Next.js Refactor Prompt"
                  value={formHeading}
                  onChange={(e) => setFormHeading(e.target.value)}
                  className="w-full bg-[#07090e] border border-white/[0.09] focus:border-orange-500 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none transition"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Note <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Short context or tag"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  className="w-full bg-[#07090e] border border-white/[0.09] focus:border-orange-500 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Prompt
                </label>
                <textarea
                  required
                  rows={7}
                  placeholder="Paste or write your prompt..."
                  value={formPrompt}
                  onChange={(e) => setFormPrompt(e.target.value)}
                  className="w-full bg-[#07090e] border border-white/[0.09] focus:border-orange-500 rounded-xl p-3 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none transition resize-y leading-relaxed"
                />
              </div>

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
                  {editingId ? "Save" : "Add Prompt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
