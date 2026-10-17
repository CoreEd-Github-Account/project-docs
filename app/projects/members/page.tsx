"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { ProjectMember, ProjectInvitation, ProjectPermissionLevel, ProjectViewTab } from "@/lib/types";
import { InviteFriendModal } from "@/components/InviteFriendModal";
import { LoginForm } from "@/components/LoginForm";

function ProjectMembersContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const projectId = searchParams.get("projectId") || "";

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);

  // Project details
  const [projectName, setProjectName] = useState<string>("");
  const [isOwner, setIsOwner] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<string>("read");
  const [owner, setOwner] = useState<ProjectMember | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [invitations, setInvitations] = useState<ProjectInvitation[]>([]);

  // Track updating state per member
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 1. Auth check
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

  // 2. Fetch project members & invitations
  const fetchMembers = useCallback(async () => {
    if (!projectId) {
      setError("No project ID specified.");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch(`/api/projects/members?projectId=${encodeURIComponent(projectId)}`);

      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load project members.");
      }

      setProjectName(data.project?.name || "Project");
      setIsOwner(Boolean(data.project?.isOwner));
      setCurrentUserRole(data.project?.currentUserRole || "read");
      setOwner(data.owner || null);
      setMembers(data.members || []);
      setInvitations(data.invitations || []);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchMembers();
    }
  }, [isAuthenticated, fetchMembers]);

  // 3. Update Member Permission
  const handleUpdatePermission = async (
    targetUserId: string,
    newLevel: ProjectPermissionLevel
  ) => {
    setUpdatingMemberId(targetUserId);
    try {
      const res = await fetch("/api/projects/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          targetUserId,
          permissionLevel: newLevel,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update permission");

      setMembers((prev) =>
        prev.map((m) =>
          m.userId === targetUserId ? { ...m, permissionLevel: newLevel } : m
        )
      );
      showToast("✓ Member permission updated in database!");
    } catch (err: any) {
      showToast(`⚠️ ${err.message}`);
    } finally {
      setUpdatingMemberId(null);
    }
  };

  // 4. Update Member Allowed Watch Modules
  const handleToggleModule = async (
    targetUserId: string,
    currentViews: ProjectViewTab[],
    moduleToToggle: ProjectViewTab
  ) => {
    const hasModule = currentViews.includes(moduleToToggle);
    if (hasModule && currentViews.length === 1) {
      showToast("⚠️ Member must have access to at least one module.");
      return;
    }

    const nextViews: ProjectViewTab[] = hasModule
      ? currentViews.filter((v) => v !== moduleToToggle)
      : [...currentViews, moduleToToggle];

    setUpdatingMemberId(targetUserId);
    try {
      const res = await fetch("/api/projects/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          targetUserId,
          allowedViews: nextViews,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update modules");

      setMembers((prev) =>
        prev.map((m) =>
          m.userId === targetUserId ? { ...m, allowedViews: nextViews } : m
        )
      );
      showToast("✓ Member allowed watch modules synced with database!");
    } catch (err: any) {
      showToast(`⚠️ ${err.message}`);
    } finally {
      setUpdatingMemberId(null);
    }
  };

  // 5. Remove Member
  const handleRemoveMember = async (targetUserId: string, memberName: string) => {
    if (
      !window.confirm(
        `Are you sure you want to remove "${memberName}" from this project? They will immediately lose access.`
      )
    ) {
      return;
    }

    setUpdatingMemberId(targetUserId);
    try {
      const res = await fetch(
        `/api/projects/members?projectId=${encodeURIComponent(
          projectId
        )}&userId=${encodeURIComponent(targetUserId)}`,
        { method: "DELETE" }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove member");

      setMembers((prev) => prev.filter((m) => m.userId !== targetUserId));
      showToast("✓ Member removed successfully.");
    } catch (err: any) {
      showToast(`⚠️ ${err.message}`);
    } finally {
      setUpdatingMemberId(null);
    }
  };

  // 6. Revoke Pending Invitation
  const handleRevokeInvitation = async (invitationId: string) => {
    try {
      const res = await fetch("/api/invitations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId, status: "revoked" }),
      });
      if (res.ok) {
        setInvitations((prev) =>
          prev.map((inv) =>
            inv.id === invitationId ? { ...inv, status: "revoked" } : inv
          )
        );
        showToast("✓ Invitation revoked.");
      }
    } catch {
      showToast("⚠️ Failed to revoke invitation.");
    }
  };

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
        <LoginForm onLoginSuccess={() => setIsAuthenticated(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-blue-600/30">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-emerald-300 text-xs sm:text-sm shadow-2xl flex items-center gap-2 animate-in fade-in duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        {/* Navigation Breadcrumb & Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800/80 p-4 rounded-2xl shadow-xl backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Link
              href="/projects"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white text-xs sm:text-sm font-semibold border border-slate-800 transition cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Project</span>
            </Link>

            <div className="h-4 w-px bg-slate-800" />

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-wide">
                  Project Members &amp; Permissions
                </h1>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  {projectName || "PQFTL"}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage collaborator roles, allowed modules to watch, and live database sync.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {(isOwner || currentUserRole === "full") && (
              <button
                onClick={() => setIsInviteModalOpen(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs sm:text-sm font-semibold transition cursor-pointer shadow-lg shadow-indigo-600/30"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                </svg>
                <span>Invite New Friend</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80">
            <span className="text-xs text-slate-400 font-medium">Total Members</span>
            <div className="text-xl sm:text-2xl font-bold text-white mt-1">
              {(owner ? 1 : 0) + members.length}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80">
            <span className="text-xs text-slate-400 font-medium">Collaborators</span>
            <div className="text-xl sm:text-2xl font-bold text-blue-400 mt-1">
              {members.length}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80">
            <span className="text-xs text-slate-400 font-medium">Pending Invites</span>
            <div className="text-xl sm:text-2xl font-bold text-amber-400 mt-1">
              {invitations.filter((i) => i.status === "pending").length}
            </div>
          </div>
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800/80">
            <span className="text-xs text-slate-400 font-medium">Database Sync</span>
            <div className="text-xs font-semibold text-emerald-400 mt-2 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Live Synced</span>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="py-24 text-center">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-slate-400 font-medium">Loading project members from database...</p>
          </div>
        ) : error ? (
          <div className="p-6 bg-rose-500/10 border border-rose-500/30 rounded-2xl text-rose-400 text-sm text-center">
            {error}
          </div>
        ) : (
          <div className="space-y-6">
            {/* MEMBERS LIST CARD */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
                <div>
                  <h2 className="text-sm sm:text-base font-bold text-white">Project Members</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Configure individual roles and allowed modules (Template Builder, Live Preview, Tasks &amp; Notepad).
                  </p>
                </div>
              </div>

              <div className="divide-y divide-slate-800/60">
                {/* 1. Project Owner */}
                {owner && (
                  <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-950/40">
                    <div className="flex items-center gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-orange-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                        👑
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{owner.fullName || owner.userName}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-amber-500/15 border border-amber-500/30 text-amber-400">
                            Owner
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>@{owner.userName}</span>
                          {owner.userEmail && <span>• {owner.userEmail}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs">
                      <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
                        Full Access (All Modules)
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Active Collaborator Members */}
                {members.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-xs sm:text-sm">
                    No other members have joined this project yet. Click &quot;Invite New Friend&quot; to collaborate!
                  </div>
                ) : (
                  members.map((member) => {
                    const views = member.allowedViews && member.allowedViews.length > 0
                      ? member.allowedViews
                      : (["builder", "preview", "tasks"] as ProjectViewTab[]);
                    const isUpdating = updatingMemberId === member.userId;

                    return (
                      <div
                        key={member.id}
                        className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-800/30 transition"
                      >
                        {/* Member Identity */}
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-sm">
                            {(member.fullName || member.userName || "U").charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-white">
                                {member.fullName || member.userName}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-blue-500/10 border border-blue-500/20 text-blue-300">
                                Collaborator
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
                              <span>@{member.userName}</span>
                              {member.userEmail && <span>• {member.userEmail}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Controls: Permission & Allowed Modules */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3.5">
                          {/* Permission Level Selector */}
                          <div className="flex items-center gap-2">
                            <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                              Permission:
                            </label>
                            <select
                              disabled={!isOwner || isUpdating}
                              value={member.permissionLevel}
                              onChange={(e) =>
                                handleUpdatePermission(
                                  member.userId,
                                  e.target.value as ProjectPermissionLevel
                                )
                              }
                              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <option value="read">Read Only</option>
                              <option value="edit_no_delete">Read &amp; Edit (No Delete)</option>
                              <option value="full">Full Access</option>
                            </select>
                          </div>

                          {/* Allowed Modules Toggle Pills */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
                              Watch:
                            </span>

                            <button
                              type="button"
                              disabled={!isOwner || isUpdating}
                              onClick={() => handleToggleModule(member.userId, views, "builder")}
                              title="Toggle Template Builder access for this member"
                              className={`px-2 py-1 rounded-md text-[11px] font-medium border transition cursor-pointer ${
                                views.includes("builder")
                                  ? "bg-blue-600/20 border-blue-500/50 text-blue-300 shadow-sm"
                                  : "bg-slate-950 border-slate-800 text-slate-600 line-through opacity-60"
                              }`}
                            >
                              🛠️ Builder
                            </button>

                            <button
                              type="button"
                              disabled={!isOwner || isUpdating}
                              onClick={() => handleToggleModule(member.userId, views, "preview")}
                              title="Toggle Live Preview access for this member"
                              className={`px-2 py-1 rounded-md text-[11px] font-medium border transition cursor-pointer ${
                                views.includes("preview")
                                  ? "bg-purple-600/20 border-purple-500/50 text-purple-300 shadow-sm"
                                  : "bg-slate-950 border-slate-800 text-slate-600 line-through opacity-60"
                              }`}
                            >
                              👁️ Preview
                            </button>

                            <button
                              type="button"
                              disabled={!isOwner || isUpdating}
                              onClick={() => handleToggleModule(member.userId, views, "tasks")}
                              title="Toggle Project Tasks & Notepad access for this member"
                              className={`px-2 py-1 rounded-md text-[11px] font-medium border transition cursor-pointer ${
                                views.includes("tasks")
                                  ? "bg-amber-600/20 border-amber-500/50 text-amber-300 shadow-sm"
                                  : "bg-slate-950 border-slate-800 text-slate-600 line-through opacity-60"
                              }`}
                            >
                              📋 Tasks
                            </button>
                          </div>

                          {/* Remove Member Button */}
                          {isOwner && (
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() =>
                                handleRemoveMember(
                                  member.userId,
                                  member.fullName || member.userName || "Collaborator"
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition cursor-pointer shrink-0"
                              title="Remove collaborator from this project"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* PENDING & RECENT INVITATIONS CARD */}
            {invitations.length > 0 && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                <div className="px-5 py-4 border-b border-slate-800/80 flex items-center justify-between">
                  <div>
                    <h2 className="text-sm sm:text-base font-bold text-white">
                      Invitations ({invitations.length})
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Review links generated for this project and their current acceptance status.
                    </p>
                  </div>
                </div>

                <div className="divide-y divide-slate-800/60">
                  {invitations.map((inv) => (
                    <div
                      key={inv.id}
                      className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-200 text-sm">
                            {inv.invitedUserName || "Friend"}
                          </span>
                          {inv.invitedUserEmail && (
                            <span className="text-slate-400 text-xs">({inv.invitedUserEmail})</span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] uppercase font-semibold ${
                              inv.status === "accepted"
                                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                : inv.status === "expired"
                                ? "bg-slate-800 text-slate-500 border border-slate-700"
                                : inv.status === "revoked"
                                ? "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                            }`}
                          >
                            {inv.status}
                          </span>
                        </div>
                        <div className="text-slate-400 mt-1 flex items-center gap-2 text-[11px]">
                          <span>
                            Permission:{" "}
                            <strong className="text-slate-300">
                              {inv.permissionLevel === "full"
                                ? "Full Access"
                                : inv.permissionLevel === "edit_no_delete"
                                ? "Read & Edit"
                                : "Read Only"}
                            </strong>
                          </span>
                          <span>•</span>
                          <span>
                            Expires: {new Date(inv.expiresAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {inv.status === "pending" && (
                          <button
                            type="button"
                            onClick={() => handleRevokeInvitation(inv.id)}
                            className="px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition border border-slate-800"
                          >
                            Revoke Link
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

      {/* Invite Modal */}
      <InviteFriendModal
        isOpen={isInviteModalOpen}
        onClose={() => {
          setIsInviteModalOpen(false);
          fetchMembers();
        }}
        projectId={projectId}
        projectName={projectName}
      />
    </div>
  );
}

export default function ProjectMembersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ProjectMembersContent />
    </Suspense>
  );
}
