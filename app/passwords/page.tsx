"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

import type { PasswordItem } from "@/lib/types";
export type { PasswordItem };

export default function PasswordManagerPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passwords, setPasswords] = useState<PasswordItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Visible passwords map: id -> boolean (masked vs revealed)
  const [visibleMap, setVisibleMap] = useState<Record<string, boolean>>({});

  // Copy feedback state: { id, field: 'id' | 'password' }
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formProjectName, setFormProjectName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formIdentifier, setFormIdentifier] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [showFormPassword, setShowFormPassword] = useState(true);

  // 1. Check Authentication Status
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

  // Handle Logout
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

  // Fetch passwords from database API
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
      console.error("Error loading passwords from Supabase:", err);
      setSaveStatus("error");
    } finally {
      setIsLoading(false);
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchPasswords();
    }
  }, [isAuthenticated, fetchPasswords]);

  // Open modal to add new password
  const handleOpenAdd = () => {
    setEditingId(null);
    setFormProjectName("");
    setFormUrl("");
    setFormIdentifier("");
    setFormPassword("");
    setShowFormPassword(true);
    setIsModalOpen(true);
  };

  // Open modal to edit existing password
  const handleOpenEdit = (item: PasswordItem) => {
    setEditingId(item.id);
    setFormProjectName(item.projectName);
    setFormUrl(item.url || "");
    setFormIdentifier(item.identifier);
    setFormPassword(item.password);
    setShowFormPassword(true);
    setIsModalOpen(true);
  };

  // Save (Add or Update) via API
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formProjectName.trim() || !formIdentifier.trim() || !formPassword) return;

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

  // Delete via API
  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete password for "${name}" from database?`)) return;

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

  // Toggle mask/reveal for individual password
  const toggleVisibility = (id: string) => {
    setVisibleMap((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // 1-Click Clipboard copy helper
  const handleCopyText = (text: string, feedbackKey: string) => {
    navigator.clipboard.writeText(text);
    setCopyFeedback(feedbackKey);
    setTimeout(() => {
      setCopyFeedback((prev) => (prev === feedbackKey ? null : prev));
    }, 2000);
  };

  // Filtered Passwords List
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

  // Auth Loading state
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
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-blue-600/20">
              P
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">
                Password Manager
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
            <button
              onClick={handleOpenAdd}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition cursor-pointer shadow-sm shadow-blue-600/30"
            >
              + Add Password
            </button>
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

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* Search & Stats Bar */}
        <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search by project name, ID, or URL..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="text-xs text-slate-400 font-medium shrink-0 flex items-center gap-2">
            <span>Saved Credentials:</span>
            <span className="font-bold text-white bg-slate-800 px-2.5 py-0.5 rounded border border-slate-700">
              {passwords.length}
            </span>
          </div>
        </div>

        {/* Passwords List */}
        {isLoading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm font-medium">Loading credentials from Supabase PG...</p>
          </div>
        ) : filteredPasswords.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
            <p className="text-sm font-medium">No credentials found in database.</p>
            <button
              onClick={handleOpenAdd}
              className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg cursor-pointer shadow-sm shadow-blue-600/30"
            >
              + Add Password
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPasswords.map((item) => {
              const isRevealed = Boolean(visibleMap[item.id]);
              const idCopied = copyFeedback === `id-${item.id}`;
              const pwdCopied = copyFeedback === `pwd-${item.id}`;

              return (
                <div
                  key={item.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 transition"
                >
                  {/* Left: Project Name & URL */}
                  <div className="space-y-1 md:max-w-xs w-full">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">🔑</span>
                      <h3 className="font-bold text-white text-sm truncate" title={item.projectName}>
                        {item.projectName}
                      </h3>
                    </div>
                    {item.url ? (
                      <a
                        href={item.url.startsWith("http") ? item.url : `https://${item.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:text-blue-300 hover:underline block truncate flex items-center gap-1"
                        title={item.url}
                      >
                        <span className="truncate">{item.url}</span>
                        <span className="text-[10px]">↗</span>
                      </a>
                    ) : (
                      <span className="text-xs text-slate-500 italic">No URL provided</span>
                    )}
                  </div>

                  {/* Middle: ID & Password Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 flex-1 w-full text-xs">
                    {/* ID Box */}
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="text-[10px] text-slate-500 block font-semibold uppercase">
                          ID / User
                        </span>
                        <span className="font-mono text-slate-200 font-medium truncate block select-all">
                          {item.identifier}
                        </span>
                      </div>
                      <button
                        onClick={() => handleCopyText(item.identifier, `id-${item.id}`)}
                        className={`text-[11px] px-2 py-1 rounded transition shrink-0 font-medium cursor-pointer ${
                          idCopied
                            ? "bg-emerald-950/70 text-emerald-400 border border-emerald-500/40 font-bold"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                        }`}
                        title="Copy ID"
                      >
                        {idCopied ? "Copied! ✓" : "Copy"}
                      </button>
                    </div>

                    {/* Password Box (Plain text) */}
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between gap-2">
                      <div className="truncate">
                        <span className="text-[10px] text-slate-500 block font-semibold uppercase">
                          Password
                        </span>
                        <span className="font-mono text-slate-200 font-medium truncate block select-all">
                          {isRevealed ? item.password : "••••••••••••"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => toggleVisibility(item.id)}
                          className="text-[11px] px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded transition font-medium cursor-pointer"
                          title={isRevealed ? "Hide Password" : "Show Plain-text Password"}
                        >
                          {isRevealed ? "Hide" : "Show"}
                        </button>
                        <button
                          onClick={() => handleCopyText(item.password, `pwd-${item.id}`)}
                          className={`text-[11px] px-2 py-1 rounded transition font-medium cursor-pointer ${
                            pwdCopied
                              ? "bg-emerald-950/70 text-emerald-400 border border-emerald-500/40 font-bold"
                              : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                          }`}
                          title="Copy Password"
                        >
                          {pwdCopied ? "Copied! ✓" : "Copy"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800 justify-end shrink-0">
                    <button
                      onClick={() => handleOpenEdit(item)}
                      className="text-xs text-slate-300 hover:text-white hover:bg-slate-800 px-2.5 py-1.5 rounded-md border border-slate-700 transition cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id, item.projectName)}
                      className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2.5 py-1.5 rounded-md border border-red-500/20 transition cursor-pointer"
                    >
                      Delete
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
        <div className="fixed inset-0 z-30 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-800 w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">
                {editingId ? "Edit Credentials" : "Add Password"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              {/* 1. Project Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supabase DB, AWS, Client Admin"
                  value={formProjectName}
                  onChange={(e) => setFormProjectName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              {/* 2. URL */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  URL (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. https://admin.example.com"
                  value={formUrl}
                  onChange={(e) => setFormUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              {/* 3. ID / Username / Email */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  ID / Username / Email *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. admin or user@company.com"
                  value={formIdentifier}
                  onChange={(e) => setFormIdentifier(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              {/* 4. Password (Plain text) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-300">
                    Password (Plain Text) *
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowFormPassword(!showFormPassword)}
                    className="text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer"
                  >
                    {showFormPassword ? "Mask" : "Show"}
                  </button>
                </div>
                <input
                  type={showFormPassword ? "text" : "password"}
                  required
                  placeholder="Enter plain text password"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm shadow-blue-600/30 transition cursor-pointer"
                >
                  {editingId ? "Save Changes" : "Save Password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
