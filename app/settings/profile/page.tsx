"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import type { UserProfile } from "@/lib/types";

const AVATAR_PRESETS = [
  { id: "avatar-1", emoji: "👤", label: "Classic" },
  { id: "avatar-2", emoji: "⚡", label: "Lightning" },
  { id: "avatar-3", emoji: "🚀", label: "Rocket" },
  { id: "avatar-4", emoji: "💻", label: "Dev" },
  { id: "avatar-5", emoji: "🦊", label: "Fox" },
  { id: "avatar-6", emoji: "🎨", label: "Designer" },
  { id: "avatar-7", emoji: "🛡️", label: "Shield" },
  { id: "avatar-8", emoji: "🌟", label: "Star" },
];

export default function ProfileSettingsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Profile data from database
  const [profile, setProfile] = useState<UserProfile | null>(null);

  // Form edit state
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("👤");
  const [recoveryKey, setRecoveryKey] = useState("");

  // Change password fields
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Check auth status
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();
      setIsAuthenticated(Boolean(data.authenticated));
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  // Fetch user profile from database table
  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/profile");
      if (res.ok) {
        const data = await res.json();
        if (data.profile) {
          setProfile(data.profile);
          setUsername(data.profile.username || "");
          setFullName(data.profile.fullName || "");
          setEmail(data.profile.email || "");
          setBio(data.profile.bio || "");
          setAvatarUrl(data.profile.avatarUrl || "👤");
          setRecoveryKey(data.profile.recoveryKey || "");
        }
      }
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated, fetchProfile]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch {
    } finally {
      setIsAuthenticated(false);
      window.location.href = "/";
    }
  };

  const handleResetForm = () => {
    if (!profile) return;
    setUsername(profile.username || "");
    setFullName(profile.fullName || "");
    setEmail(profile.email || "");
    setBio(profile.bio || "");
    setAvatarUrl(profile.avatarUrl || "👤");
    setRecoveryKey(profile.recoveryKey || "");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setNotice(null);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice(null);

    if (!username.trim()) {
      setNotice({ type: "error", text: "Username cannot be empty." });
      return;
    }

    if (newPassword.trim()) {
      if (newPassword.length < 4) {
        setNotice({ type: "error", text: "New password must be at least 4 characters long." });
        return;
      }
      if (newPassword !== confirmPassword) {
        setNotice({ type: "error", text: "New password and confirmation do not match." });
        return;
      }
      if (!currentPassword) {
        setNotice({ type: "error", text: "Please enter your current password to change it." });
        return;
      }
    }

    try {
      setIsSaving(true);
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          fullName: fullName.trim(),
          email: email.trim(),
          bio: bio.trim(),
          avatarUrl: avatarUrl.trim(),
          recoveryKey: recoveryKey.trim(),
          currentPassword: currentPassword || undefined,
          newPassword: newPassword.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setNotice({ type: "error", text: data.error || "Failed to update profile." });
      } else {
        setNotice({
          type: "success",
          text: data.message || "Profile successfully updated & synced with database!",
        });
        if (data.profile) {
          setProfile(data.profile);
        }
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordSection(false);
      }
    } catch (err) {
      console.error("Save profile error:", err);
      setNotice({ type: "error", text: "Network error occurred while saving." });
    } finally {
      setIsSaving(false);
      setTimeout(() => {
        setNotice((prev) => (prev?.type === "success" ? null : prev));
      }, 4000);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Verifying access...</p>
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-blue-600/30 hover:scale-105 transition"
              title="Return to Settings"
            >
              T
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white leading-tight">
                  Profile Settings
                </h1>
                <span className="text-[11px] font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-400">Manage your identity, personal info, and security credentials</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/70 hover:bg-slate-800 transition flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Settings</span>
            </Link>

            <button
              onClick={handleLogout}
              className="text-xs text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/60 px-3 py-1.5 rounded-lg border border-red-500/30 transition cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 space-y-8">
        {/* Banner Section */}
        <div className="pb-6 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
              <span>Account & Profile</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950 text-blue-400 border border-blue-500/30 font-medium">
                Protected Page
              </span>
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Data is loaded dynamically from the PostgreSQL <code>users</code> table and updates persist immediately.
            </p>
          </div>

          {profile && (
            <div className="text-right flex items-center sm:flex-col sm:items-end gap-2 text-xs text-slate-400">
              <span className="px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300 font-mono text-[11px]">
                ID: {profile.id.substring(0, 8)}...
              </span>
              <span className="text-[11px] text-slate-500">
                Joined: {new Date(profile.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          )}
        </div>

        {/* Feedback Alert Toast */}
        {notice && (
          <div
            className={`p-3.5 rounded-xl border text-xs sm:text-sm flex items-center gap-2.5 transition-all animate-in fade-in ${
              notice.type === "success"
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-300"
                : "bg-rose-950/60 border-rose-500/40 text-rose-300"
            }`}
          >
            <span>{notice.type === "success" ? "✓" : "⚠"}</span>
            <span className="font-medium">{notice.text}</span>
          </div>
        )}

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <div className="w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm">Fetching user profile from database...</p>
          </div>
        ) : (
          <form onSubmit={handleSaveProfile} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT COLUMN: AVATAR CARD & ACCOUNT SUMMARY */}
            <div className="space-y-6">
              {/* Profile Card Preview */}
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-br from-blue-600/20 via-indigo-600/10 to-transparent"></div>

                <div className="relative pt-3 flex flex-col items-center">
                  <div className="w-24 h-24 rounded-2xl bg-slate-950 border-2 border-blue-500/40 flex items-center justify-center text-4xl shadow-xl shadow-blue-500/10">
                    {avatarUrl.length <= 4 ? avatarUrl : "👤"}
                  </div>

                  <h3 className="text-lg font-bold text-white mt-3">
                    {fullName || username || "Workspace User"}
                  </h3>
                  <p className="text-xs text-blue-400 font-mono">@{username || "username"}</p>

                  {bio && (
                    <p className="text-xs text-slate-300 mt-2 px-2 italic line-clamp-2">
                      &quot;{bio}&quot;
                    </p>
                  )}
                </div>

                {/* Avatar Preset Quick-Selector */}
                <div className="pt-4 border-t border-slate-800 text-left space-y-2">
                  <label className="text-xs font-semibold text-slate-400 block">
                    Choose Avatar Icon
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {AVATAR_PRESETS.map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        onClick={() => setAvatarUrl(p.emoji)}
                        className={`p-2 rounded-xl border text-xl flex items-center justify-center transition cursor-pointer ${
                          avatarUrl === p.emoji
                            ? "bg-blue-600/20 border-blue-500 text-white shadow-sm"
                            : "bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-900"
                        }`}
                        title={p.label}
                      >
                        {p.emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Database Connectivity Status */}
                <div className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 text-[11px] text-slate-400 text-left space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">Database Engine</span>
                    <span className="text-emerald-400 font-medium">Supabase PG</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">Table</span>
                    <span className="text-blue-300 font-mono">public.users</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-300">Session Status</span>
                    <span className="text-emerald-400">Authenticated ✓</span>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: MAIN EDIT FORM */}
            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-7 shadow-xl space-y-6">
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                    <span>Personal Information</span>
                    <span className="text-[10px] bg-blue-950/70 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-semibold">
                      Live Sync
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Update your account details. Any changes will immediately reflect across your workspace.
                  </p>
                </div>

                <div className="space-y-4">
                  {/* Full Name & Username in 2 columns */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span>Display Name / Full Name</span>
                        <span className="text-[10px] text-slate-500">Optional</span>
                      </label>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Alex Morgan"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                        <span>Username <span className="text-rose-400">*</span></span>
                        <span className="text-[10px] text-slate-500">Unique identifier</span>
                      </label>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="e.g. alexmorgan"
                        required
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono transition"
                      />
                    </div>
                  </div>

                  {/* Email Address */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Email Address</span>
                      <span className="text-[10px] text-slate-500">Optional</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. alex@example.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  {/* Bio / Role */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Bio & Role</span>
                      <span className="text-[10px] text-slate-500">Optional</span>
                    </label>
                    <textarea
                      rows={2}
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      placeholder="e.g. Full-stack developer & template studio creator"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition resize-y"
                    />
                  </div>

                  {/* Security Recovery Key */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                      <span>Security Recovery Key</span>
                      <span className="text-[10px] text-slate-500">For password recovery</span>
                    </label>
                    <input
                      type="text"
                      value={recoveryKey}
                      onChange={(e) => setRecoveryKey(e.target.value)}
                      placeholder="Secret recovery phrase or key"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 font-mono transition"
                    />
                    <p className="text-[11px] text-slate-500">
                      Used to reset your account password if you forget it. Store this safely.
                    </p>
                  </div>

                  {/* Collapsible Password Change Section */}
                  <div className="pt-3 border-t border-slate-800/80 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-200">
                          Account Security & Password
                        </h4>
                        <p className="text-[11px] text-slate-500">
                          Update your login password
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setShowPasswordSection(!showPasswordSection)}
                        className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer transition"
                      >
                        {showPasswordSection ? "Hide Password Fields" : "Change Password"}
                      </button>
                    </div>

                    {showPasswordSection && (
                      <div className="space-y-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800 animate-in fade-in">
                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-slate-300 block">
                            Current Password
                          </label>
                          <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
                          />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-300 block">
                              New Password
                            </label>
                            <input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Minimum 4 characters"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-slate-300 block">
                              Confirm New Password
                            </label>
                            <input
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Confirm new password"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl border border-slate-700/60 transition cursor-pointer"
                  >
                    Reset Form
                  </button>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2.5 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl transition shadow-lg shadow-blue-600/30 cursor-pointer flex items-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Syncing with Database...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Save & Sync Profile</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
