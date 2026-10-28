"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Project, ProjectRole } from "@/lib/types";

interface BulkOpenerProps {
  project: Project;
  userPermission?: ProjectRole;
}

export function BulkOpener({ project, userPermission }: BulkOpenerProps) {
  const isOwner = userPermission === "owner" || project.isOwner;
  const isReadOnly = !isOwner && userPermission === "read";
  const canDelete = isOwner || userPermission === "full";

  const [content, setContent] = useState("");
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>("");

  // 1. Fetch Bulk Opener Text on project load
  const fetchContent = useCallback(async () => {
    if (!project?.id) return;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/projects/bulk-opener?projectId=${encodeURIComponent(project.id)}`);
      if (!res.ok) throw new Error("Failed to load bulk opener content");
      const data = await res.json();
      if (data.success) {
        const text = data.content || "";
        setContent(text);
        lastSavedContentRef.current = text;
        setLastSavedTime(data.updatedAt || new Date().toISOString());
        setSaveStatus("saved");
      }
    } catch (err) {
      console.error("Error loading bulk opener:", err);
      setSaveStatus("error");
    } finally {
      setIsLoading(false);
      setInitialLoaded(true);
    }
  }, [project?.id]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  // 2. Save text to database (CRUD: Create / Update)
  const handleSave = useCallback(
    async (textToSave: string) => {
      if (!project?.id || isReadOnly) return;
      setSaveStatus("saving");

      try {
        const res = await fetch("/api/projects/bulk-opener", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId: project.id,
            content: textToSave,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to save");
        }

        lastSavedContentRef.current = textToSave;
        setLastSavedTime(data.updatedAt || new Date().toISOString());
        setSaveStatus("saved");
      } catch (err) {
        console.error("Failed to save bulk opener text:", err);
        setSaveStatus("error");
      }
    },
    [project?.id, isReadOnly]
  );

  // 3. Auto-save with debounce when user types
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setContent(newText);

    if (newText !== lastSavedContentRef.current) {
      setSaveStatus("unsaved");

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      // Auto-save after 1.2s of inactivity
      autoSaveTimerRef.current = setTimeout(() => {
        handleSave(newText);
      }, 1200);
    } else {
      setSaveStatus("saved");
    }
  };

  // Keyboard shortcut Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
        handleSave(content);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [content, handleSave]);

  // Sync scroll between textarea and line numbers
  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Handle Tab key in textarea
  const handleKeyDownInTextarea = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      const newText = content.substring(0, start) + "  " + content.substring(end);
      setContent(newText);
      setSaveStatus("unsaved");

      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      }, 0);
    }
  };

  // 4. Delete / Clear operation (CRUD: Delete)
  const handleClear = async () => {
    if (!project?.id || isReadOnly) return;
    setSaveStatus("saving");

    try {
      const res = await fetch(`/api/projects/bulk-opener?projectId=${encodeURIComponent(project.id)}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to clear");
      }

      setContent("");
      lastSavedContentRef.current = "";
      setLastSavedTime(new Date().toISOString());
      setSaveStatus("saved");
      setIsClearModalOpen(false);
    } catch (err) {
      console.error("Error clearing bulk opener:", err);
      setSaveStatus("error");
    }
  };

  // 5. Bulk Opener: Detect URLs from text
  const detectedUrls = useMemo(() => {
    if (!content) return [];
    const lines = content.split("\n");
    const urls: string[] = [];
    const urlPattern = /^(https?:\/\/[^\s]+|www\.[^\s]+|localhost:\d+[^\s]*)/i;

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("//")) return;

      if (urlPattern.test(trimmed)) {
        let finalUrl = trimmed;
        if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
          finalUrl = `https://${finalUrl}`;
        }
        urls.push(finalUrl);
      }
    });

    return urls;
  }, [content]);

  // Open All detected URLs in browser tabs
  const handleOpenAllUrls = () => {
    if (detectedUrls.length === 0) {
      alert("No valid URLs found in the text! Enter lines starting with http://, https://, or localhost.");
      return;
    }

    if (detectedUrls.length > 15) {
      const confirmOpen = window.confirm(
        `You have ${detectedUrls.length} URLs. Opening more than 15 tabs at once might be blocked by your browser's popup blocker. Do you want to proceed?`
      );
      if (!confirmOpen) return;
    }

    let openedCount = 0;
    detectedUrls.forEach((url, i) => {
      setTimeout(() => {
        const win = window.open(url, "_blank", "noopener,noreferrer");
        if (win) openedCount++;
      }, i * 150); // Stagger by 150ms to help avoid popup blocker
    });
  };

  // Copy entire content
  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download as text file
  const handleDownload = () => {
    const filename = `${(project.name || "project").toLowerCase().replace(/[^a-z0-9]/g, "-")}-bulk-opener.txt`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Compute stats
  const lineCount = useMemo(() => {
    return content ? content.split("\n").length : 1;
  }, [content]);

  const wordCount = useMemo(() => {
    if (!content.trim()) return 0;
    return content.trim().split(/\s+/).length;
  }, [content]);

  const charCount = content.length;

  return (
    <div className="space-y-4 pb-12 animate-fade-in">
      {/* HEADER SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/20 text-lg">
                🚀
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Bulk Opener
                  </h2>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    Single Text Writer
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Write or paste text, links &amp; commands for{" "}
                  <span className="text-slate-200 font-semibold">{project.name}</span>. Saved live to database.
                </p>
              </div>
            </div>
          </div>

          {/* ACTIONS & SYNC STATUS */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Sync Status Badge */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold backdrop-blur-md transition ${
                saveStatus === "saving"
                  ? "bg-blue-950/40 border-blue-500/30 text-blue-300"
                  : saveStatus === "unsaved"
                  ? "bg-amber-950/40 border-amber-500/30 text-amber-300"
                  : saveStatus === "error"
                  ? "bg-rose-950/40 border-rose-500/30 text-rose-300"
                  : "bg-emerald-950/40 border-emerald-500/30 text-emerald-300"
              }`}
              title="Database sync status"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  saveStatus === "saving"
                    ? "bg-blue-400 animate-ping"
                    : saveStatus === "unsaved"
                    ? "bg-amber-400"
                    : saveStatus === "error"
                    ? "bg-rose-400"
                    : "bg-emerald-400 animate-pulse"
                }`}
              />
              <span>
                {saveStatus === "saving"
                  ? "Saving to Supabase..."
                  : saveStatus === "unsaved"
                  ? "Unsaved (Auto-saving...)"
                  : saveStatus === "error"
                  ? "Sync Error"
                  : "Saved • Supabase PG"}
              </span>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchContent}
              disabled={isLoading || saveStatus === "saving"}
              title="Refresh text from database"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white border border-slate-700 text-xs sm:text-sm font-semibold transition shadow-sm cursor-pointer disabled:opacity-60"
            >
              <svg
                className={`w-3.5 h-3.5 text-emerald-400 ${isLoading ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>Refresh</span>
            </button>

            {/* Open All URLs Button */}
            <button
              type="button"
              onClick={handleOpenAllUrls}
              disabled={detectedUrls.length === 0}
              title={`Open all ${detectedUrls.length} detected URLs in browser tabs`}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition shadow-md cursor-pointer ${
                detectedUrls.length > 0
                  ? "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-cyan-600/30 active:scale-95"
                  : "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
              }`}
            >
              <span>🌐</span>
              <span>Open All Links ({detectedUrls.length})</span>
            </button>

            {/* Save Button */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => handleSave(content)}
                disabled={saveStatus === "saving"}
                title="Save immediately (Ctrl+S)"
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white text-xs sm:text-sm font-bold transition shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-50"
              >
                <span>💾</span>
                <span>{saveStatus === "saving" ? "Saving..." : "Save"}</span>
              </button>
            )}
          </div>
        </div>

        {/* TOOLBAR ACTIONS */}
        <div className="mt-4 pt-3.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={handleCopy}
              disabled={!content}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 font-medium transition cursor-pointer disabled:opacity-40"
            >
              <span>{copied ? "✓" : "📋"}</span>
              <span>{copied ? "Copied!" : "Copy Text"}</span>
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!content}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/60 font-medium transition cursor-pointer disabled:opacity-40"
            >
              <span>⬇️</span>
              <span>Download .txt</span>
            </button>

            {canDelete && (
              <button
                type="button"
                onClick={() => setIsClearModalOpen(true)}
                disabled={!content}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-500/30 font-medium transition cursor-pointer disabled:opacity-40"
              >
                <span>🗑️</span>
                <span>Clear Text</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-4 text-slate-400 font-mono text-[11px] flex-wrap">
            <span>{lineCount} {lineCount === 1 ? "line" : "lines"}</span>
            <span>{wordCount} words</span>
            <span>{charCount} chars</span>
            <span className="text-cyan-400">{detectedUrls.length} links detected</span>
          </div>
        </div>
      </div>

      {/* MAIN TEXT WRITER EDITOR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col min-h-[500px]">
        {/* Editor Subheader */}
        <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
            <span className="ml-2 font-mono text-[11px] text-slate-400">
              {project.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_bulk_opener.txt
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span>Tab: 2 spaces</span>
            <span>Encoding: UTF-8</span>
            {lastSavedTime && (
              <span className="text-slate-500">
                Last saved: {new Date(lastSavedTime).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>

        {/* Editor Body with Line Numbers */}
        <div className="relative flex-1 flex bg-slate-950 overflow-hidden min-h-[460px]">
          {/* Line Numbers Column */}
          <div
            ref={lineNumbersRef}
            className="w-12 sm:w-14 py-4 pr-3 text-right font-mono text-xs text-slate-600 select-none bg-slate-950/90 border-r border-slate-800/80 overflow-hidden leading-6"
            style={{ minHeight: "460px" }}
          >
            {Array.from({ length: Math.max(lineCount, 18) }).map((_, i) => (
              <div key={i} className="h-6">
                {i + 1}
              </div>
            ))}
          </div>

          {/* Text Area */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onScroll={handleScroll}
            onKeyDown={handleKeyDownInTextarea}
            disabled={isReadOnly || isLoading}
            placeholder={`# Bulk Opener & Text Writer for ${project.name}
# Enter links, URLs, notes, or credentials line by line.
# Example:
https://github.com
https://supabase.com
http://localhost:3000
https://vercel.com

# Clicking "Open All Links" will open each detected URL in a new browser tab.
# All text is automatically saved to your Supabase PostgreSQL database table.`}
            className="flex-1 p-4 bg-transparent text-slate-100 font-mono text-xs sm:text-sm leading-6 resize-none focus:outline-none focus:ring-0 border-none selection:bg-cyan-600/40 placeholder-slate-600"
            style={{ minHeight: "460px" }}
            spellCheck={false}
          />
        </div>

        {/* Footer info bar */}
        <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-cyan-400">💡 Tip:</span>
            <span>
              Press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[10px]">Ctrl+S</kbd> to save instantly, or let auto-save persist your changes.
            </span>
          </div>

          {detectedUrls.length > 0 && (
            <button
              onClick={handleOpenAllUrls}
              className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline"
            >
              Open {detectedUrls.length} detected links →
            </button>
          )}
        </div>
      </div>

      {/* CLEAR CONFIRMATION MODAL */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-xl mx-auto">
              🗑️
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Clear Bulk Opener Text?</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to delete and reset the bulk opener text for{" "}
                <span className="text-white font-semibold">&quot;{project.name}&quot;</span>? This cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition"
              >
                Yes, Clear Text
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
