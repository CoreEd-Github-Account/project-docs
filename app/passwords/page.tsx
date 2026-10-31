"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { LoginForm } from "@/components/LoginForm";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import type { PasswordItem } from "@/lib/types";
export type { PasswordItem };

export default function PasswordManagerPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwords, setPasswords] = useState<PasswordItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const [visibleMap, setVisibleMap] = useState<Record<string, boolean>>({});
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formProjectName, setFormProjectName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formIdentifier, setFormIdentifier] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showFormPassword, setShowFormPassword] = useState(true);

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

  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved"
  );

  const fetchPasswords = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/passwords");
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch passwords");
      const data: PasswordItem[] = await res.json();
      setPasswords(data);
      setSaveStatus("saved");
    } catch (err) {
      console.error("Error loading passwords:", err);
      setSaveStatus("error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPasswords();
    }
  }, [isAuthenticated, fetchPasswords]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormProjectName("");
    setFormUrl("");
    setFormIdentifier("");
    setFormPassword("");
    setShowFormPassword(true);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (item: PasswordItem) => {
    setEditingId(item.id);
    setFormProjectName(item.projectName);
    setFormUrl(item.url || "");
    setFormIdentifier(item.identifier);
    setFormPassword(item.password);
    setShowFormPassword(true);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProjectName.trim() || !formIdentifier.trim() || !formPassword)
      return;

    const idToUse = editingId || `pwd-${Date.now()}`;
    const item: PasswordItem = {
      id: idToUse,
      projectName: formProjectName.trim(),
      url: formUrl.trim(),
      identifier: formIdentifier.trim(),
      password: formPassword,
      createdAt: new Date().toISOString(),
    };

    setSaveStatus("saving");
    try {
      const res = await fetch("/api/passwords", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item),
      });

      if (!res.ok) throw new Error("Failed to save password");

      if (editingId) {
        setPasswords((prev) =>
          prev.map((p) => (p.id === editingId ? item : p))
        );
      } else {
        setPasswords((prev) => [item, ...prev]);
      }
      setSaveStatus("saved");
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error saving password:", err);
      setSaveStatus("error");
      alert("Failed to save password to database.");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete credentials for "${name}"?`)) return;

    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/passwords?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete password");

      setPasswords((prev) => prev.filter((item) => item.id !== id));
      setSaveStatus("saved");
    } catch (err) {
      console.error("Error deleting password:", err);
      setSaveStatus("error");
      alert("Failed to delete password from database.");
    }
  };

  const toggleVisibility = (id: string) => {
    setVisibleMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyText = (text: string, feedbackKey: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(feedbackKey);
    setTimeout(() => {
      setCopyFeedback((prev) => (prev === feedbackKey ? null : prev));
    }, 1800);
  };

  const filteredPasswords = useMemo(() => {
    if (!searchQuery.trim()) return passwords;
    const q = searchQuery.toLowerCase();
    return passwords.filter(
      (item) =>
        item.projectName.toLowerCase().includes(q) ||
        item.identifier.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q)
    );
  }, [passwords, searchQuery]);

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
        title="Passwords"
        icon="🔑"
        saveStatus={saveStatus}
        primaryAction={{
          label: "Add Password",
          onClick: handleOpenAdd,
          icon: "+",
        }}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-5">
        {/* Minimal Single-Row Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Passwords
            </h1>
            <span className="text-xs font-mono font-semibold text-slate-400 bg-[#10131c] border border-white/[0.07] px-2.5 py-0.5 rounded-lg">
              {passwords.length}
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
              placeholder="Search credentials..."
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

        {/* Unified Credentials Ledger */}
        {isLoading ? (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] p-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5" />
            <p className="text-xs">Loading credentials...</p>
          </div>
        ) : filteredPasswords.length === 0 ? (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] p-12 text-center space-y-3">
            <p className="text-sm text-slate-400">No credentials found.</p>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              + Add Password
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] divide-y divide-white/[0.06] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            {filteredPasswords.map((item) => {
              const isRevealed = Boolean(visibleMap[item.id]);
              const idCopied = copyFeedback === `id-${item.id}`;
              const pwdCopied = copyFeedback === `pwd-${item.id}`;

              return (
                <div
                  key={item.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3.5 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Left: Project Monogram + Name + URL */}
                  <div className="flex items-center gap-3 min-w-0 md:w-56 shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-[#151926] border border-white/[0.08] flex items-center justify-center text-xs font-bold uppercase text-amber-300 shrink-0">
                      {item.projectName.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white text-sm truncate">
                        {item.projectName}
                      </h3>
                      {item.url ? (
                        <a
                          href={
                            item.url.startsWith("http")
                              ? item.url
                              : `https://${item.url}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-slate-400 hover:text-orange-400 truncate block transition-colors"
                        >
                          {item.url.replace(/^https?:\/\//, "")} ↗
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">No URL</span>
                      )}
                    </div>
                  </div>

                  {/* Middle: Compact Copyable Pills for Username & Password */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 min-w-0">
                    {/* Username Pill */}
                    <div className="flex items-center justify-between gap-2 bg-[#07090e] border border-white/[0.07] rounded-xl px-3 py-2">
                      <span className="font-mono text-xs text-slate-200 truncate select-all">
                        {item.identifier}
                      </span>
                      <button
                        onClick={() =>
                          handleCopyText(item.identifier, `id-${item.id}`)
                        }
                        className={`text-[11px] font-semibold px-2 py-0.5 rounded-md transition shrink-0 cursor-pointer ${
                          idCopied
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "text-slate-400 hover:text-white bg-white/[0.05]"
                        }`}
                      >
                        {idCopied ? "✓" : "Copy ID"}
                      </button>
                    </div>

                    {/* Password Pill */}
                    <div className="flex items-center justify-between gap-2 bg-[#07090e] border border-white/[0.07] rounded-xl px-3 py-2">
                      <span className="font-mono text-xs text-slate-200 truncate select-all">
                        {isRevealed ? item.password : "••••••••••"}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleVisibility(item.id)}
                          className="text-[11px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded transition cursor-pointer"
                        >
                          {isRevealed ? "Hide" : "Show"}
                        </button>
                        <button
                          onClick={() =>
                            handleCopyText(item.password, `pwd-${item.id}`)
                          }
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md transition cursor-pointer ${
                            pwdCopied
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "text-slate-400 hover:text-white bg-white/[0.05]"
                          }`}
                        >
                          {pwdCopied ? "✓" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right: Edit / Delete Icons */}
                  <div className="flex items-center justify-end gap-1 shrink-0">
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
                      onClick={() => handleDelete(item.id, item.projectName)}
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
              );
            })}
          </div>
        )}
      </main>

      {/* Add / Edit Password Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-[#10131c] rounded-2xl shadow-2xl border border-white/[0.08] w-full max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
              <h2 className="text-sm font-bold text-white">
                {editingId ? "Edit Password" : "Add Password"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Project / Service
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supabase, AWS, GitHub"
                  value={formProjectName}
                  onChange={(e) => setFormProjectName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#07090e] border border-white/[0.09] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  URL <span className="text-slate-500">(optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="https://..."
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#07090e] border border-white/[0.09] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Username / Email
                </label>
                <input
                  type="text"
                  required
                  placeholder="admin@example.com"
                  value={formIdentifier}
                  onChange={(e) => setFormIdentifier(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#07090e] border border-white/[0.09] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="text-[11px] text-orange-400 hover:text-orange-300 cursor-pointer"
                  >
                    {showFormPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <input
                  type={showFormPassword ? "text" : "password"}
                  required
                  placeholder="Password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-[#07090e] border border-white/[0.09] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-400 rounded-lg transition cursor-pointer"
                >
                  {editingId ? "Save" : "Add Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
