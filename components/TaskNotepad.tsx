"use client";

import React, { useState, useRef } from "react";
import type { Project } from "@/lib/types";

interface TaskNotepadProps {
  project: Project;
  onUpdateTasks: (tasks: string) => void;
  onManualSave?: () => void;
  saveStatus: "saved" | "saving" | "error";
}

export function TaskNotepad({
  project,
  onUpdateTasks,
  onManualSave,
  saveStatus,
}: TaskNotepadProps) {
  const [copied, setCopied] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const text = project.tasks ?? "";

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onUpdateTasks(e.target.value);
  };

  const insertAtCursor = (insertion: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      onUpdateTasks((text ? text + "\n" : "") + insertion);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = text.substring(0, start);
    const after = text.substring(end);

    // Add newline if needed
    const prefix = before.length > 0 && !before.endsWith("\n") ? "\n" : "";
    const updated = before + prefix + insertion + after;
    onUpdateTasks(updated);

    setTimeout(() => {
      textarea.focus();
      const newPos = start + prefix.length + insertion.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleAddTodoItem = () => {
    insertAtCursor("- [ ] ");
  };

  const handleAddTimestamp = () => {
    const now = new Date();
    const formatted = `[${now.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })} ${now.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    })}] `;
    insertAtCursor(formatted);
  };

  const handleCopy = () => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualSave = () => {
    if (onManualSave) {
      onManualSave();
    }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  const handleClear = () => {
    if (!text.trim()) return;
    const confirmed = confirm(
      "Are you sure you want to clear your tasks and notes for this project?"
    );
    if (confirmed) {
      onUpdateTasks("");
    }
  };

  // Metrics
  const charCount = text.length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const lineCount = text ? text.split("\n").length : 0;

  return (
    <div className="bg-slate-900 p-6 sm:p-8 rounded-xl shadow-md border border-slate-800 space-y-6 flex flex-col min-h-[680px]">
      {/* HEADER SECTION */}
      <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Project Tasks & Notepad
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950/60 text-blue-400 font-medium border border-blue-500/30 truncate max-w-[220px]">
              {project.name}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Write down your to-dos, ongoing progress, and reminders for this project. Auto-saves to database.
          </p>
        </div>

        {/* TOP ACTION BUTTONS */}
        <div className="flex items-center flex-wrap gap-2">
          {/* Add Todo Button */}
          <button
            onClick={handleAddTodoItem}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition border border-slate-700 cursor-pointer"
            title="Insert a checkbox item"
          >
            <svg
              className="w-3.5 h-3.5 text-blue-400"
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
            <span>+ Todo Item</span>
          </button>

          {/* Add Timestamp Button */}
          <button
            onClick={handleAddTimestamp}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition border border-slate-700 cursor-pointer"
            title="Insert current date and timestamp"
          >
            <svg
              className="w-3.5 h-3.5 text-amber-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>+ Timestamp</span>
          </button>

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            type="button"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition border border-slate-700 cursor-pointer"
            title="Copy tasks text"
          >
            {copied ? (
              <>
                <svg
                  className="w-3.5 h-3.5 text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <span className="text-emerald-400 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <svg
                  className="w-3.5 h-3.5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Save Button */}
          <button
            onClick={handleManualSave}
            type="button"
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition shadow-sm shadow-blue-600/30 cursor-pointer active:scale-95"
            title="Save tasks to database immediately"
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
                strokeWidth={2}
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            <span>{justSaved ? "Saved!" : "Save Now"}</span>
          </button>
        </div>
      </div>

      {/* NOTEPAD WORKSPACE */}
      <div className="flex-1 flex flex-col relative rounded-xl border border-slate-700 bg-slate-950 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition shadow-inner">
        {/* Top bar inside notepad with accent line */}
        <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-blue-400 rounded-t-xl" />

        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          placeholder={`Write your tasks, notes, and reminders for ${project.name} here...

Example:
- [ ] Implement database connection pooling
- [x] Configure environment variables
- [ ] Add deployment guide to README
- Next step: Check API response codes`}
          className="w-full flex-1 min-h-[460px] p-5 sm:p-6 bg-transparent text-slate-100 placeholder:text-slate-500 font-mono text-sm leading-relaxed outline-none resize-y selection:bg-blue-900 selection:text-white"
          spellCheck={false}
        />

        {/* BOTTOM STATUS BAR */}
        <div className="px-5 py-3 bg-slate-900/90 border-t border-slate-800 rounded-b-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-4">
            <span>
              <strong>{lineCount}</strong> lines
            </span>
            <span>•</span>
            <span>
              <strong>{wordCount}</strong> words
            </span>
            <span>•</span>
            <span>
              <strong>{charCount}</strong> characters
            </span>
          </div>

          <div className="flex items-center gap-3">
            {saveStatus === "saving" && (
              <span className="text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded font-medium flex items-center gap-1.5 border border-amber-500/30">
                <span className="animate-spin text-xs">⟳</span> Auto-saving to database...
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded font-medium flex items-center gap-1 border border-emerald-500/30">
                ✓ Auto-saved to database
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-red-400 bg-red-950/40 px-2 py-0.5 rounded font-medium flex items-center gap-1 border border-red-500/30">
                ⚠ Save error
              </span>
            )}

            {text.trim() && (
              <button
                onClick={handleClear}
                type="button"
                className="text-slate-500 hover:text-red-400 transition underline cursor-pointer ml-2"
              >
                Clear notes
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
