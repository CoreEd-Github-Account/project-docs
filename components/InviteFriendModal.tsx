"use client";

import React, { useState, useEffect } from "react";
import type { ProjectPermissionLevel, ProjectInvitation, ProjectViewTab } from "@/lib/types";

interface InviteFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  initialView?: "select" | "friend" | "public";
}

export function InviteFriendModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  initialView = "select",
}: InviteFriendModalProps) {
  // Navigation state within modal: "select" (chooser) | "friend" | "public"
  const [viewMode, setViewMode] = useState<"select" | "friend" | "public">(initialView);

  // Friend Invite State
  const [friendName, setFriendName] = useState("");
  const [friendEmail, setFriendEmail] = useState("");
  const [friendPermissionLevel, setFriendPermissionLevel] = useState<ProjectPermissionLevel>("read");
  const [friendAllowedViews, setFriendAllowedViews] = useState<ProjectViewTab[]>([
    "builder",
    "preview",
    "tasks",
  ]);

  // Public Link State (no name, no email needed!)
  const [publicPermissionLevel, setPublicPermissionLevel] = useState<ProjectPermissionLevel>("full");
  const [publicAllowedViews, setPublicAllowedViews] = useState<ProjectViewTab[]>([
    "builder",
    "preview",
    "tasks",
  ]);
  const [publicExpiresInDays, setPublicExpiresInDays] = useState<number>(30);

  // Common UI State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [generatedIsPublic, setGeneratedIsPublic] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recentInvitations, setRecentInvitations] = useState<ProjectInvitation[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [updatingInvId, setUpdatingInvId] = useState<string | null>(null);

  // Reset form or load history on open
  useEffect(() => {
    if (!isOpen) {
      setViewMode(initialView);
      setFriendName("");
      setFriendEmail("");
      setFriendPermissionLevel("read");
      setFriendAllowedViews(["builder", "preview", "tasks"]);
      setPublicPermissionLevel("full");
      setPublicAllowedViews(["builder", "preview", "tasks"]);
      setPublicExpiresInDays(30);
      setIsLoading(false);
      setError(null);
      setGeneratedInviteUrl(null);
      setGeneratedIsPublic(false);
      setCopied(false);
      return;
    }

    setViewMode(initialView);

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
  }, [isOpen, projectId, initialView]);

  if (!isOpen) return null;

  // Toggle module access for Friend invite
  const toggleFriendViewModule = (tab: ProjectViewTab) => {
    if (friendAllowedViews.includes(tab)) {
      if (friendAllowedViews.length === 1) return;
      setFriendAllowedViews(friendAllowedViews.filter((t) => t !== tab));
    } else {
      setFriendAllowedViews([...friendAllowedViews, tab]);
    }
  };

  // Toggle module access for Public link
  const togglePublicViewModule = (tab: ProjectViewTab) => {
    if (publicAllowedViews.includes(tab)) {
      if (publicAllowedViews.length === 1) return;
      setPublicAllowedViews(publicAllowedViews.filter((t) => t !== tab));
    } else {
      setPublicAllowedViews([...publicAllowedViews, tab]);
    }
  };

  // Submit Friend Invite
  const handleFriendSubmit = async (e: React.FormEvent) => {
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

    if (friendAllowedViews.length === 0) {
      setError("Please allow your friend to access at least one module.");
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
          friendEmail: cleanEmail,
          permissionLevel: friendPermissionLevel,
          allowedViews: friendAllowedViews,
          isPublic: false,
          expiresInDays: 7,
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
      setGeneratedIsPublic(false);
      if (data.invitation) {
        setRecentInvitations((prev) => [data.invitation, ...prev]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate invitation link.");
    } finally {
      setIsLoading(false);
    }
  };

  // Submit Public Link (no username, no email needed!)
  const handlePublicSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (publicAllowedViews.length === 0) {
      setError("Please allow access to at least one module.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          isPublic: true,
          permissionLevel: publicPermissionLevel,
          allowedViews: publicAllowedViews,
          expiresInDays: publicExpiresInDays,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to generate public link.");
      }

      const fullUrl =
        data.inviteUrl ||
        data.link ||
        (data.token ? `${window.location.origin}/invite/${data.token}` : "");

      if (!fullUrl) {
        throw new Error("Public link was not returned by the server.");
      }

      setGeneratedInviteUrl(fullUrl);
      setGeneratedIsPublic(true);
      if (data.invitation) {
        setRecentInvitations((prev) => [data.invitation, ...prev]);
      }
    } catch (err: any) {
      setError(err.message || "Failed to generate public link.");
    } finally {
      setIsLoading(false);
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

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!confirm("Are you sure you want to revoke this invitation link?")) return;
    try {
      const res = await fetch(`/api/invitations?id=${encodeURIComponent(invitationId)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setRecentInvitations((prev) => prev.filter((i) => i.id !== invitationId));
        if (generatedInviteUrl && generatedInviteUrl.includes(invitationId)) {
          setGeneratedInviteUrl(null);
        }
      }
    } catch (err) {
      console.error("Failed to revoke invitation:", err);
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

  const handleResetForAnother = () => {
    setFriendName("");
    setFriendEmail("");
    setGeneratedInviteUrl(null);
    setError(null);
    setCopied(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div
        className={`bg-slate-900 border border-slate-800 rounded-3xl w-full ${
          viewMode === "select" ? "max-w-md" : "max-w-xl"
        } max-h-[92vh] overflow-y-auto p-6 sm:p-7 shadow-2xl shadow-black/90 relative space-y-6 transition-all duration-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ========================================================= */}
        {/* MODAL HEADER                                              */}
        {/* ========================================================= */}
        <div className="flex items-start justify-between border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-3">
            {viewMode !== "select" && (
              <button
                type="button"
                onClick={() => {
                  setViewMode("select");
                  setGeneratedInviteUrl(null);
                  setError(null);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                title="Back to link choices"
                aria-label="Back to link choices"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}

            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-lg ${
              viewMode === "public"
                ? "bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-500/20"
                : "bg-gradient-to-tr from-indigo-600 to-blue-500 shadow-indigo-500/20"
            }`}>
              {viewMode === "public" ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                  />
                </svg>
              )}
            </div>

            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-wide leading-snug">
                {viewMode === "select"
                  ? "Project Invitations"
                  : viewMode === "public"
                  ? "Create Public Link"
                  : "Invite Friend to Project"}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Project: <strong className="font-bold text-blue-400">{projectName}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs sm:text-sm flex items-start gap-2.5 animate-in fade-in duration-150">
            <svg className="w-5 h-5 shrink-0 text-rose-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="leading-snug">{error}</span>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 1: CHOOSER ("Which link do you want to create?")      */}
        {/* ========================================================= */}
        {viewMode === "select" && (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center sm:text-left">
              <h3 className="text-sm font-semibold text-slate-200">
                Which link do you want to create?
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Select an invitation method to collaborate on this project.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 pt-1">
              {/* Option 1: Invite Friend */}
              <button
                type="button"
                onClick={() => setViewMode("friend")}
                className="group relative p-4 rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 hover:border-indigo-500/50 transition-all text-left flex items-start gap-3.5 cursor-pointer shadow-sm hover:shadow-indigo-500/10 active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
                    />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-white group-hover:text-indigo-300 transition-colors">
                      Invite Friend
                    </span>
                    <span className="text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                      Personal Link
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Create a personalized link for a specific teammate with customized access permissions and module visibility.
                  </p>
                </div>
              </button>

              {/* Option 2: Public Link */}
              <button
                type="button"
                onClick={() => setViewMode("public")}
                className="group relative p-4 rounded-2xl border border-slate-800 bg-slate-950/60 hover:bg-slate-800/80 hover:border-emerald-500/50 transition-all text-left flex items-start gap-3.5 cursor-pointer shadow-sm hover:shadow-emerald-500/10 active:scale-[0.99]"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-sm text-white group-hover:text-emerald-300 transition-colors">
                      Public Link
                    </span>
                    <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                      General Link
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    A general link you can share with anybody. No name or email needed — users will create their password and automatically join this project.
                  </p>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: PUBLIC LINK (NO NAME, NO EMAIL NEEDED!)          */}
        {/* ========================================================= */}
        {viewMode === "public" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {generatedInviteUrl && generatedIsPublic ? (
              /* Public Link Generated Display */
              <div className="space-y-5">
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-start gap-3">
                  <svg className="w-5 h-5 shrink-0 text-emerald-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="font-bold text-emerald-200">Public Link Generated Successfully!</p>
                    <p className="text-emerald-300/80 mt-1 text-xs leading-relaxed">
                      This is a general public link. You can send it to anyone via WhatsApp, Slack, or Email. When any user opens this link, they will create their password and automatically be added to this project.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Public Shareable Link
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="invite-url-input"
                      type="text"
                      readOnly
                      value={generatedInviteUrl}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-emerald-300 font-mono focus:outline-none focus:border-emerald-500 selection:bg-emerald-600/30"
                    />
                    <button
                      onClick={() => handleCopyLink()}
                      className={`px-4 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition flex items-center gap-2 cursor-pointer shadow-md ${
                        copied
                          ? "bg-emerald-600 text-white"
                          : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20"
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

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `You're invited to join project ${projectName}! Open this link to get started: ${generatedInviteUrl}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition cursor-pointer"
                  >
                    <span>Share on WhatsApp</span>
                  </a>

                  <button
                    onClick={() => {
                      setGeneratedInviteUrl(null);
                      setCopied(false);
                    }}
                    className="text-xs text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Generate another link
                  </button>
                </div>
              </div>
            ) : (
              /* Public Link Creation Form */
              <form onSubmit={handlePublicSubmit} className="space-y-5">
                <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/20 text-xs text-emerald-300 leading-relaxed">
                  💡 <strong>General Public Link:</strong> No need to enter username or email. Anyone who opens this link can create a password and join <strong className="text-white">{projectName}</strong> directly.
                </div>

                {/* Permission Level Selector */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Granted Permissions for Joiners
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPublicPermissionLevel("full")}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        publicPermissionLevel === "full"
                          ? "bg-emerald-950/30 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <div className="font-bold text-xs text-white">Full Access</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Read, edit, delete</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPublicPermissionLevel("edit_no_delete")}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        publicPermissionLevel === "edit_no_delete"
                          ? "bg-amber-950/30 border-amber-500 text-amber-300 ring-1 ring-amber-500"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <div className="font-bold text-xs text-white">Read &amp; Edit</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">No deletion rights</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPublicPermissionLevel("read")}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        publicPermissionLevel === "read"
                          ? "bg-blue-950/30 border-blue-500 text-blue-300 ring-1 ring-blue-500"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <div className="font-bold text-xs text-white">Read Only</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">View documents &amp; tasks</div>
                    </button>
                  </div>
                </div>

                {/* Allowed View Modules */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Visible Modules for Members
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "builder" as ProjectViewTab, label: "Builder" },
                      { id: "preview" as ProjectViewTab, label: "Live Preview" },
                      { id: "tasks" as ProjectViewTab, label: "Tasks" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => togglePublicViewModule(tab.id)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          publicAllowedViews.includes(tab.id)
                            ? "bg-emerald-600/20 border-emerald-500/50 text-emerald-300"
                            : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        <span>{publicAllowedViews.includes(tab.id) ? "✓" : "+"}</span>
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Link Expiration */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Link Validity
                  </label>
                  <div className="flex items-center gap-2">
                    {[
                      { days: 7, label: "7 Days" },
                      { days: 30, label: "30 Days" },
                      { days: 90, label: "90 Days" },
                    ].map((opt) => (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setPublicExpiresInDays(opt.days)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
                          publicExpiresInDays === opt.days
                            ? "bg-slate-800 border-emerald-500 text-emerald-300"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-600/30 transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generating Public Link...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span>Generate Public Link</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* List of previously generated active public links */}
            {recentInvitations.filter((i) => i.isPublic && i.status === "pending").length > 0 && (
              <div className="border-t border-slate-800 pt-4 space-y-2.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Active Public Links
                </span>
                <div className="space-y-2">
                  {recentInvitations
                    .filter((i) => i.isPublic && i.status === "pending")
                    .map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                          <span className="font-semibold text-white truncate">Public Link</span>
                          <span className="text-[10px] uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.2 rounded font-mono">
                            {inv.permissionLevel}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevokeInvitation(inv.id)}
                          className="text-slate-400 hover:text-red-400 transition text-[11px] cursor-pointer"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 3: INVITE FRIEND (PRESERVES 100% EXISTING LOGIC)     */}
        {/* ========================================================= */}
        {viewMode === "friend" && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {generatedInviteUrl && !generatedIsPublic ? (
              /* Generated Friend Link View */
              <div className="space-y-5">
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

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `Hey ${friendName || "Friend"}! You're invited to collaborate on project "${projectName}". Open your invitation link to get started: ${generatedInviteUrl}`
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition cursor-pointer"
                  >
                    <span>Share on WhatsApp</span>
                  </a>

                  <button
                    onClick={handleResetForAnother}
                    className="text-xs text-slate-400 hover:text-white transition cursor-pointer"
                  >
                    Invite another friend
                  </button>
                </div>
              </div>
            ) : (
              /* Friend Invite Form */
              <form onSubmit={handleFriendSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Friend&apos;s Name <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={friendName}
                    onChange={(e) => setFriendName(e.target.value)}
                    placeholder="e.g. Alex Johnson"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Friend&apos;s Email <span className="text-slate-500 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={friendEmail}
                    onChange={(e) => setFriendEmail(e.target.value)}
                    placeholder="alex@example.com (optional)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Assigned Permission
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setFriendPermissionLevel("read")}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        friendPermissionLevel === "read"
                          ? "bg-blue-950/30 border-blue-500 text-blue-300 ring-1 ring-blue-500"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <div className="font-bold text-xs text-white">Read Only</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">View documents &amp; tasks</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFriendPermissionLevel("edit_no_delete")}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        friendPermissionLevel === "edit_no_delete"
                          ? "bg-amber-950/30 border-amber-500 text-amber-300 ring-1 ring-amber-500"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <div className="font-bold text-xs text-white">Read &amp; Edit</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Cannot delete items</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFriendPermissionLevel("full")}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        friendPermissionLevel === "full"
                          ? "bg-emerald-950/30 border-emerald-500 text-emerald-300 ring-1 ring-emerald-500"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
                      }`}
                    >
                      <div className="font-bold text-xs text-white">Full Access</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">Read, edit, delete</div>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    Visible Modules for Friend
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: "builder" as ProjectViewTab, label: "Builder" },
                      { id: "preview" as ProjectViewTab, label: "Live Preview" },
                      { id: "tasks" as ProjectViewTab, label: "Tasks" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => toggleFriendViewModule(tab.id)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                          friendAllowedViews.includes(tab.id)
                            ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                            : "bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        <span>{friendAllowedViews.includes(tab.id) ? "✓" : "+"}</span>
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg shadow-blue-600/30 transition active:scale-[0.99] cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Generating Invitation Link...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      <span>Generate Friend Invite Link</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Friend Invitations History */}
            {recentInvitations.filter((i) => !i.isPublic).length > 0 && (
              <div className="border-t border-slate-800 pt-4 space-y-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 block">
                  Friend Invitations History
                </span>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {recentInvitations
                    .filter((i) => !i.isPublic)
                    .map((inv) => (
                      <div
                        key={inv.id}
                        className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white truncate">
                            {inv.invitedUserName}
                          </div>
                          {inv.invitedUserEmail && (
                            <div className="text-[11px] text-slate-500 truncate">
                              {inv.invitedUserEmail}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-semibold ${
                              inv.status === "accepted"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : inv.status === "expired"
                                ? "bg-slate-800 text-slate-500"
                                : "bg-blue-500/20 text-blue-400"
                            }`}
                          >
                            {inv.status}
                          </span>
                          {inv.status === "pending" && (
                            <button
                              type="button"
                              onClick={() => handleRevokeInvitation(inv.id)}
                              className="text-slate-400 hover:text-red-400 transition text-[11px] cursor-pointer"
                            >
                              Revoke
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
