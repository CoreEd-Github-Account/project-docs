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
  const [ isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "unsaved" | "saving" | "error">("saved");
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [blockedUrls, setBlockedUrls] = useState<string[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedContentRef = useRef<string>("");

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
    }
  }, [project?.id]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

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

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setContent(newText);

    if (newText !== lastSavedContentRef.current) {
      setSaveStatus("unsaved");

      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }

      autoSaveTimerRef.current = setTimeout(() => {
        handleSave(newText);
      }, 1200);
    } else {
      setSaveStatus("saved");
    }
  };

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

  const handleScroll = () => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

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

    const blocked: string[] = [];

    // Open all URLs synchronously within the user click gesture
    for (const url of detectedUrls) {
      const win = window.open(url, "_blank");
      if (win) {
        try {
          win.opener = null;
        } catch {
          // ignore cross-origin opener assignment
        }
      } else {
        blocked.push(url);
      }
    }

    setBlockedUrls(blocked);
  };

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  const lineCount = useMemo(() => {
    return content ? content.split("\n").length : 1;
  }, [content]);

  return (
    <div className="space-y-4 pb-12">
      {/* MAIN CONTAINER */}
      <div className="bg-[#0d1017] border border-white/[0.07] rounded-2xl overflow-hidden flex flex-col min-h-[580px]">
        {/* Clean Monochrome Toolbar */}
        <div className="p-4 border-b border-white/[0.06] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-white tracking-tight">
              Bulk Opener
            </h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/[0.05] text-slate-400 border border-white/[0.06]">
              {detectedUrls.length} {detectedUrls.length === 1 ? "link" : "links"}
            </span>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 ml-1">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  saveStatus === "saving"
                    ? "bg-white animate-ping"
                    : saveStatus === "unsaved"
                    ? "bg-amber-400"
                    : saveStatus === "error"
                    ? "bg-rose-400"
                    : "bg-emerald-400"
                }`}
              />
              <span>
                {saveStatus === "saving"
                  ? "Saving..."
                  : saveStatus === "unsaved"
                  ? "Unsaved"
                  : saveStatus === "error"
                  ? "Sync Error"
                  : "Saved"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={fetchContent}
              disabled={isLoading || saveStatus === "saving"}
              title="Refresh text from database"
              className="px-2.5 py-1.5 rounded-xl bg-[#10131c] hover:bg-white/[0.06] text-slate-300 hover:text-white border border-white/[0.08] text-xs font-medium transition cursor-pointer disabled:opacity-50"
            >
              Refresh
            </button>

            <button
              type="button"
              onClick={handleCopy}
              disabled={!content}
              className="px-2.5 py-1.5 rounded-xl bg-[#10131c] hover:bg-white/[0.06] text-slate-300 hover:text-white border border-white/[0.08] text-xs font-medium transition cursor-pointer disabled:opacity-40"
            >
              {copied ? "Copied" : "Copy"}
            </button>

            <button
              type="button"
              onClick={handleDownload}
              disabled={!content}
              className="px-2.5 py-1.5 rounded-xl bg-[#10131c] hover:bg-white/[0.06] text-slate-300 hover:text-white border border-white/[0.08] text-xs font-medium transition cursor-pointer disabled:opacity-40"
            >
              Download .txt
            </button>

            {canDelete && (
              <button
                type="button"
                onClick={() => setIsClearModalOpen(true)}
                disabled={!content}
                className="px-2.5 py-1.5 rounded-xl bg-[#10131c] hover:bg-rose-500/10 text-slate-400 hover:text-rose-300 border border-white/[0.08] text-xs font-medium transition cursor-pointer disabled:opacity-40"
              >
                Clear
              </button>
            )}

            {!isReadOnly && (
              <button
                type="button"
                onClick={() => handleSave(content)}
                disabled={saveStatus === "saving"}
                title="Save immediately (Ctrl+S)"
                className="px-3 py-1.5 rounded-xl bg-[#10131c] hover:bg-white/[0.08] text-white border border-white/[0.12] text-xs font-semibold transition cursor-pointer disabled:opacity-50"
              >
                {saveStatus === "saving" ? "Saving..." : "Save"}
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenAllUrls}
              disabled={detectedUrls.length === 0}
              title={`Open all ${detectedUrls.length} detected URLs in browser tabs`}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                detectedUrls.length > 0
                  ? "bg-white hover:bg-slate-200 text-slate-950 active:scale-[0.98]"
                  : "bg-white/[0.04] text-slate-500 border border-white/[0.06] cursor-not-allowed"
              }`}
            >
              Open Links ({detectedUrls.length})
            </button>
          </div>
        </div>

        {/* Popup Blocker Notice (shown only if browser blocked 2nd+ tabs) */}
        {blockedUrls.length > 0 && (
          <div className="px-4 py-3 bg-[#10131c] border-b border-white/[0.08] flex flex-col gap-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <p className="text-slate-200 font-medium">
                Browser blocked {blockedUrls.length} {blockedUrls.length === 1 ? "tab" : "tabs"} from opening at once.{" "}
                <span className="text-slate-400 font-normal">
                  Click the <strong className="text-white">Pop-up blocked</strong> icon on the right side of your address bar and select <strong className="text-white">&quot;Always allow pop-ups and redirects&quot;</strong>, then click <strong className="text-white">Open Links</strong> again.
                </span>
              </p>
              <button
                type="button"
                onClick={() => setBlockedUrls([])}
                className="text-slate-400 hover:text-white px-1.5 py-0.5 rounded cursor-pointer shrink-0"
              >
                ✕
              </button>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {blockedUrls.map((url, idx) => (
                <a
                  key={`${url}-${idx}`}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    setBlockedUrls((prev) => prev.filter((_, i) => i !== idx))
                  }
                  className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-slate-200 hover:text-white font-mono text-[11px] truncate max-w-[260px] transition"
                >
                  ↗ {url}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Editor Body with Line Numbers */}
        <div className="relative flex-1 flex bg-[#07090e] overflow-hidden min-h-[480px]">
          <div
            ref={lineNumbersRef}
            className="w-12 py-4 pr-3 text-right font-mono text-xs text-slate-600 select-none bg-[#07090e] border-r border-white/[0.06] overflow-hidden leading-6"
            style={{ minHeight: "480px" }}
          >
            {Array.from({ length: Math.max(lineCount, 18) }).map((_, i) => (
              <div key={i} className="h-6">
                {i + 1}
              </div>
            ))}
          </div>

          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onScroll={handleScroll}
            onKeyDown={handleKeyDownInTextarea}
            disabled={isReadOnly || isLoading}
            placeholder={`# Enter links, URLs, notes, or credentials line by line.\nhttps://github.com\nhttp://localhost:3000`}
            className="flex-1 p-4 bg-transparent text-slate-100 font-mono text-xs sm:text-sm leading-6 resize-none focus:outline-none focus:ring-0 border-none selection:bg-white/20 placeholder-slate-600"
            style={{ minHeight: "480px" }}
            spellCheck={false}
          />
        </div>

        {/* Minimal Footer Status Bar */}
        <div className="px-4 py-2 bg-[#0d1017] border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <div className="flex items-center gap-4">
            <span>{lineCount} {lineCount === 1 ? "line" : "lines"}</span>
            <span>{content.length} chars</span>
          </div>
          {lastSavedTime && (
            <span>Last saved {new Date(lastSavedTime).toLocaleTimeString()}</span>
          )}
        </div>
      </div>

      {/* CLEAR CONFIRMATION MODAL */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0d1017] border border-white/[0.08] rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Clear Bulk Opener Text?</h3>
              <p className="text-xs text-slate-400">
                Delete and reset the bulk opener text for{" "}
                <span className="text-white font-medium">&quot;{project.name}&quot;</span>? This cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsClearModalOpen(false)}
                className="px-3.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-300 text-xs font-medium transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition cursor-pointer"
              >
                Clear Text
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
