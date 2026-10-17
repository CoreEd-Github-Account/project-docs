"use client";

import React, { useState, useEffect } from "react";
import type { ProjectPermissionLevel, ProjectInvitation, ProjectViewTab } from "@/lib/types";

interface InviteFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
}

export function InviteFriendModal({
  isOpen,
  onClose,
  projectId,
  projectName,
}: InviteFriendModalProps) {
  const [friendName, setFriendName] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const [permissionLevel, setPermissionLevel] = useState<ProjectPermissionLevel>("read");
  const [allowedViews, setAllowedViews] = useState<ProjectViewTab[]>([
    "builder",
    "preview",
    "tasks",
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [recentInvitations, setRecentInvitations] = useState<ProjectInvitation[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [updatingInvId, setUpdatingInvId] = useState<string | null>(null);

  // Reset form or load history on open
  useEffect(() => {
    if (!isOpen) {
      setFriendName("");
      setFriendEmail("");
      setPermissionLevel("read");
      setAllowedViews(["builder", "preview", "tasks"]);
      setIsLoading(false);
      setError(null);
      setGeneratedInviteUrl(null);
      setCopied(false);
      return;
    }

    async function loadInvitations() {
      setIsLoadingHistory(true);
      try {
        const res = await fetch(`/api/invitations?projectId=${encodeURIComponent(projectId)}`);
        if (res.ok) {
          const data = await res.json();
          setRecentInvitations(data.invitations || []);
        }
      } catch (err) {
        console.error("Failed to load invitations:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    }

    loadInvitations();
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const toggleViewModule = (tab: ProjectViewTab) => {
    if (allowedViews.includes(tab)) {
      if (allowedViews.length === 1) {
        // Must allow at least one module
        return;
      }
      setAllowedViews(allowedViews.filter((t) => t !== tab));
    } else {
      setAllowedViews([...allowedViews, tab]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!friendName.trim()) {
      setError("Friend name is required.");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const cleanEmail = friendEmail.trim();
    if (cleanEmail && !emailRegex.test(cleanEmail)) {
      setError("Please provide a valid email address.");
      return;
    }

    if (allowedViews.length === 0) {
      setError("Please allow your friend to watch at least one module.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          friendName: friendName.trim(),
          friendEmail: friendEmail.trim(),
          permissionLevel,
          allowedViews,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate invitation link.");
      }

      const fullUrl =
        data.inviteUrl ||
        data.link ||
        (data.token ? `${window.location.origin}/invite/${data.token}` : "");

      if (!fullUrl) {
        throw new Error("Invitation link was not returned by the server.");
      }

      setGeneratedInviteUrl(fullUrl);
      if (data.invitation) {
        setRecentInvitations((prev) => [data.invitation, ...prev]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate invitation link.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateInvitationViews = async (invitationId: string, newViews: ProjectViewTab[]) => {
    setUpdatingInvId(invitationId);
    try {
      const res = await fetch("/api/invitations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, allowedViews: newViews }),
      });
      if (res.ok) {
        setRecentInvitations((prev) =>
          prev.map((inv) => (inv.id === invitationId ? { ...inv, allowedViews: newViews } : inv))
        );
      }
    } catch (err) {
      console.error("Failed to update invitation modules:", err);
    } finally {
      setUpdatingInvId(null);
    }
  };

  const handleCopyLink = async (urlToCopy?: string) => {
    const url = urlToCopy || generatedInviteUrl;
    if (!url) return;

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const input = document.getElementById("invite-url-input") as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    }
  };

  const handleResetForAnother = () => {
    setFriendName("");
    setFriendEmail("");
    setPermissionLevel("read");
    setAllowedViews(["builder", "preview", "tasks"]);
    setGeneratedInviteUrl(null);
    setError(null);
    setCopied(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 sm:p-7 shadow-2xl shadow-black/80 relative space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">Invite Friend to Project</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Project: <span className="font-semibold text-blue-400">{projectName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs sm:text-sm flex items-start gap-2.5">
            <svg className="w-5 h-5 shrink-0 text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* Generated Link Display Mode */}
        {generatedInviteUrl ? (
          <div className="space-y-5 animate-in fade-in duration-200">
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-3">
              <svg className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <div>
                <p className="font-semibold text-emerald-200">Invitation Link Generated!</p>
                <p className="text-emerald-300/80 mt-0.5 text-xs">
                  Copy and share this secure link with your friend via WhatsApp, Email, or Slack. They can set up their password and will instantly gain access with the selected permissions.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Invitation Link
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="invite-url-input"
                  type="text"
                  readOnly
                  value={generatedInviteUrl}
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-blue-300 font-mono focus:outline-none focus:border-blue-500 selection:bg-blue-600/30"
                />
                <button
                  onClick={() => handleCopyLink()}
                  className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer shadow-md ${
                    copied
                      ? "bg-emerald-600 text-white"
                      : "bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20"
                  }`}
                >
                  {copied ? (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Quick Share via WhatsApp button */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  `Hey ${friendName || "friend"}, you've been invited to collaborate on project "${projectName}". Click this link to set up your password and get started: ${generatedInviteUrl}`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-semibold transition"
              >
                <span>Share via WhatsApp</span>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>

              <button
                onClick={handleResetForAnother}
                className="text-xs text-slate-400 hover:text-white underline underline-offset-4 cursor-pointer"
              >
                + Invite Another Friend
              </button>
            </div>
          </div>
        ) : (
          /* Form Mode */
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Friend Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Friend Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Alex Johnson"
                value={friendName}
                onChange={(e) => setFriendName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>

            {/* Friend Email */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Friend Email <span className="text-slate-500 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="email"
                placeholder="friend@example.com (optional)"
                value={friendEmail}
                onChange={(e) => setFriendEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
              />
            </div>

            {/* Project Permissions Interactive Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Project Permissions <span className="text-rose-400">*</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  {permissionLevel === "full"
                    ? "Full Access"
                    : permissionLevel === "edit_no_delete"
                    ? "Read & Edit"
                    : "Read Only"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPermissionLevel("read")}
                  className={`px-3 py-2.5 rounded-xl text-xs font-medium border flex items-center justify-between transition cursor-pointer text-left ${
                    permissionLevel === "read"
                      ? "bg-blue-600/15 border-blue-500/50 text-blue-300 shadow-sm shadow-blue-500/10 ring-1 ring-blue-500/30"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>👁️</span>
                    <span className="truncate">Read Only</span>
                  </span>
                  {permissionLevel === "read" ? (
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] shrink-0 font-bold ml-1.5">
                      ✓
                    </span>
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-700 shrink-0 ml-1.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPermissionLevel("edit_no_delete")}
                  className={`px-3 py-2.5 rounded-xl text-xs font-medium border flex items-center justify-between transition cursor-pointer text-left ${
                    permissionLevel === "edit_no_delete"
                      ? "bg-amber-600/15 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/10 ring-1 ring-amber-500/30"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>✏️</span>
                    <span className="truncate">Read &amp; Edit (No Delete)</span>
                  </span>
                  {permissionLevel === "edit_no_delete" ? (
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] shrink-0 font-bold ml-1.5">
                      ✓
                    </span>
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-700 shrink-0 ml-1.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setPermissionLevel("full")}
                  className={`px-3 py-2.5 rounded-xl text-xs font-medium border flex items-center justify-between transition cursor-pointer text-left ${
                    permissionLevel === "full"
                      ? "bg-emerald-600/15 border-emerald-500/50 text-emerald-300 shadow-sm shadow-emerald-500/10 ring-1 ring-emerald-500/30"
                      : "bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-300 hover:border-slate-700"
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>⚡</span>
                    <span className="truncate">Full Access</span>
                  </span>
                  {permissionLevel === "full" ? (
                    <span className="w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] shrink-0 font-bold ml-1.5">
                      ✓
                    </span>
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-700 shrink-0 ml-1.5" />
                  )}
                </button>
              </div>

              {/* Permission description callout */}
              <div className="mt-2 text-xs p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-400">
                {permissionLevel === "read" && (
                  <p>
                    <strong className="text-blue-400">Read Only:</strong> Your friend can explore tasks, stages, and project content. Add, edit, delete, and checkboxes are disabled.
                  </p>
                )}
                {permissionLevel === "edit_no_delete" && (
                  <p>
                    <strong className="text-amber-400">Read &amp; Edit (No Delete):</strong> Your friend can create tasks, edit notes, add comments, and complete items, but destructive delete operations are prohibited.
                  </p>
                )}
                {permissionLevel === "full" && (
                  <p>
                    <strong className="text-emerald-400">Full Access:</strong> Your friend has full editing and deletion access across all project tasks and content.
                  </p>
                )}
              </div>
            </div>

            {/* Allowed to Watch Interactive Buttons */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                  Allowed to Watch <span className="text-rose-400">*</span>
                </label>
                <span className="text-[11px] text-slate-400 font-medium">
                  {allowedViews.length} of 3 modules allowed
                </span>
              </div>

              {/* Interactive Module Pills (Click to dynamically toggle) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => toggleViewModule("builder")}
                  className={`px-3 py-2.5 rounded-xl text-xs font-medium border flex items-center justify-between transition cursor-pointer text-left ${
                    allowedViews.includes("builder")
                      ? "bg-blue-600/15 border-blue-500/50 text-blue-300 shadow-sm shadow-blue-500/10 ring-1 ring-blue-500/30"
                      : "bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>🛠️</span>
                    <span className="truncate">Template Builder</span>
                  </span>
                  {allowedViews.includes("builder") ? (
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] shrink-0 font-bold ml-1.5">
                      ✓
                    </span>
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-700 shrink-0 ml-1.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => toggleViewModule("preview")}
                  className={`px-3 py-2.5 rounded-xl text-xs font-medium border flex items-center justify-between transition cursor-pointer text-left ${
                    allowedViews.includes("preview")
                      ? "bg-purple-600/15 border-purple-500/50 text-purple-300 shadow-sm shadow-purple-500/10 ring-1 ring-purple-500/30"
                      : "bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>👁️</span>
                    <span className="truncate">Live Preview</span>
                  </span>
                  {allowedViews.includes("preview") ? (
                    <span className="w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center text-[10px] shrink-0 font-bold ml-1.5">
                      ✓
                    </span>
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-700 shrink-0 ml-1.5" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => toggleViewModule("tasks")}
                  className={`px-3 py-2.5 rounded-xl text-xs font-medium border flex items-center justify-between transition cursor-pointer text-left ${
                    allowedViews.includes("tasks")
                      ? "bg-amber-600/15 border-amber-500/50 text-amber-300 shadow-sm shadow-amber-500/10 ring-1 ring-amber-500/30"
                      : "bg-slate-950/60 border-slate-800 text-slate-500 hover:text-slate-400 hover:border-slate-700"
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <span>📋</span>
                    <span className="truncate">Tasks &amp; Notepad</span>
                  </span>
                  {allowedViews.includes("tasks") ? (
                    <span className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px] shrink-0 font-bold ml-1.5">
                      ✓
                    </span>
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-slate-700 shrink-0 ml-1.5" />
                  )}
                </button>
              </div>

              {/* Dynamic Explanatory Text */}
              <div className="mt-2 text-xs p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/80 text-slate-400">
                <span className="text-slate-300 font-medium">Friend will be allowed to watch: </span>
                {allowedViews.length === 3 ? (
                  <span className="text-emerald-400 font-medium">
                    All 3 modules (Template Builder, Live Preview, and Project Tasks &amp; Notepad).
                  </span>
                ) : allowedViews.length === 1 && allowedViews[0] === "tasks" ? (
                  <span className="text-amber-400 font-medium">
                    Project Tasks &amp; Notepad only. (Template Builder &amp; Live Preview tabs will be hidden for this friend).
                  </span>
                ) : allowedViews.length === 2 && allowedViews.includes("builder") && allowedViews.includes("preview") ? (
                  <span className="text-purple-400 font-medium">
                    Template Builder &amp; Live Preview only. (Tasks &amp; Notepad tab will be hidden).
                  </span>
                ) : (
                  <span className="text-blue-400 font-medium">
                    {allowedViews
                      .map((v) =>
                        v === "builder"
                          ? "Template Builder"
                          : v === "preview"
                          ? "Live Preview"
                          : "Project Tasks & Notepad"
                      )
                      .join(" + ")}
                  </span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 active:scale-95 text-white transition flex items-center gap-2 shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                      />
                    </svg>
                    <span>Generate Invitation Link</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Existing Invitations / History */}
        {recentInvitations.length > 0 && (
          <div className="border-t border-slate-800/80 pt-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Invitations for this project ({recentInvitations.length})
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {recentInvitations.map((inv) => {
                const invViews = inv.allowedViews && inv.allowedViews.length > 0
                  ? inv.allowedViews
                  : (["builder", "preview", "tasks"] as ProjectViewTab[]);

                return (
                  <div
                    key={inv.id}
                    className="p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="truncate mr-2">
                        <div className="font-semibold text-slate-200 truncate">
                          {inv.invitedUserName || "Friend"}
                          {inv.invitedUserEmail && (
                            <span className="font-normal text-slate-400 ml-1.5">({inv.invitedUserEmail})</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                              inv.permissionLevel === "full"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                : inv.permissionLevel === "edit_no_delete"
                                ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                            }`}
                          >
                            {inv.permissionLevel === "full"
                              ? "Full Access"
                              : inv.permissionLevel === "edit_no_delete"
                              ? "Read & Edit"
                              : "Read Only"}
                          </span>
                          <span>•</span>
                          <span
                            className={
                              inv.status === "accepted"
                                ? "text-emerald-400 font-medium"
                                : inv.status === "expired"
                                ? "text-slate-500"
                                : "text-amber-400"
                            }
                          >
                            {inv.status}
                          </span>
                        </div>
                      </div>

                      {inv.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => {
                            setFriendName(inv.invitedUserName);
                            setFriendEmail(inv.invitedUserEmail || "");
                            setPermissionLevel(inv.permissionLevel);
                            if (inv.allowedViews && inv.allowedViews.length > 0) {
                              setAllowedViews(inv.allowedViews);
                            }
                            setGeneratedInviteUrl(null);
                          }}
                          className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-white rounded-lg transition shrink-0 cursor-pointer border border-slate-700/60"
                          title="Re-fill form with this friend's details to generate a link"
                        >
                          Re-generate
                        </button>
                      )}
                    </div>

                    {/* Allowed to Watch Badges & Quick Live Sync Toggles */}
                    <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between flex-wrap gap-2 text-[11px]">
                      <span className="text-slate-400 text-[10px] uppercase font-semibold">Allowed to watch:</span>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          disabled={updatingInvId === inv.id}
                          title="Click to toggle Template Builder for this collaborator (live synced with DB)"
                          onClick={() => {
                            const has = invViews.includes("builder");
                            if (has && invViews.length === 1) return;
                            const next = has ? invViews.filter((v) => v !== "builder") : [...invViews, "builder" as ProjectViewTab];
                            handleUpdateInvitationViews(inv.id, next);
                          }}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition cursor-pointer ${
                            invViews.includes("builder")
                              ? "bg-blue-500/15 border-blue-500/40 text-blue-300"
                              : "bg-slate-900 border-slate-800 text-slate-600 line-through"
                          }`}
                        >
                          🛠️ Builder
                        </button>

                        <button
                          type="button"
                          disabled={updatingInvId === inv.id}
                          title="Click to toggle Live Preview for this collaborator (live synced with DB)"
                          onClick={() => {
                            const has = invViews.includes("preview");
                            if (has && invViews.length === 1) return;
                            const next = has ? invViews.filter((v) => v !== "preview") : [...invViews, "preview" as ProjectViewTab];
                            handleUpdateInvitationViews(inv.id, next);
                          }}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition cursor-pointer ${
                            invViews.includes("preview")
                              ? "bg-purple-500/15 border-purple-500/40 text-purple-300"
                              : "bg-slate-900 border-slate-800 text-slate-600 line-through"
                          }`}
                        >
                          👁️ Preview
                        </button>

                        <button
                          type="button"
                          disabled={updatingInvId === inv.id}
                          title="Click to toggle Tasks & Notepad for this collaborator (live synced with DB)"
                          onClick={() => {
                            const has = invViews.includes("tasks");
                            if (has && invViews.length === 1) return;
                            const next = has ? invViews.filter((v) => v !== "tasks") : [...invViews, "tasks" as ProjectViewTab];
                            handleUpdateInvitationViews(inv.id, next);
                          }}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-medium border transition cursor-pointer ${
                            invViews.includes("tasks")
                              ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                              : "bg-slate-900 border-slate-800 text-slate-600 line-through"
                          }`}
                        >
                          📋 Tasks &amp; Notepad
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
