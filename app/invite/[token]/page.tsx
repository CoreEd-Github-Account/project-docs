"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface InvitationData {
  id: string;
  invitedUserName: string;
  invitedUserEmail: string;
  permissionLevel: "read" | "edit_no_delete" | "full";
  projectName: string;
  inviterName: string;
  expiresAt: string;
}

interface ExistingUserData {
  username: string;
  email?: string;
  fullName?: string;
}

function InviteAcceptContent() {
  const params = useParams();
  const router = useRouter();
  const token = typeof params?.token === "string" ? params.token : "";

  const [isLoading, setIsLoading] = useState(true);
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);
  const [hasAccount, setHasAccount] = useState(false);
  const [existingUser, setExistingUser] = useState<ExistingUserData | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setErrorStatus("invalid");
      setIsLoading(false);
      return;
    }

    async function validateToken() {
      try {
        const res = await fetch(`/api/invitations/${encodeURIComponent(token)}`);
        const data = await res.json();

        if (!res.ok || !data.valid) {
          setErrorStatus(data.error || "invalid");
        } else {
          setInvitation(data.invitation);
          const initialName = data.invitation.invitedUserName || data.existingUser?.fullName || data.existingUser?.username || "";
          setName(initialName);
          if (data.invitation.invitedUserEmail) {
            setCustomEmail(data.invitation.invitedUserEmail);
          }
          if (data.hasAccount) {
            setHasAccount(true);
            setExistingUser(data.existingUser || null);
          }
        }
      } catch (err) {
        console.error("Token validation error:", err);
        setErrorStatus("server_error");
      } finally {
        setIsLoading(false);
      }
    }

    validateToken();
  }, [token]);

  // Dynamically check if custom email has an existing account (for invites where email was optional)
  useEffect(() => {
    if (!token || !customEmail.trim() || invitation?.invitedUserEmail) return;

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/invitations/${encodeURIComponent(token)}?email=${encodeURIComponent(customEmail.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (data.valid) {
            setHasAccount(Boolean(data.hasAccount));
            setExistingUser(data.existingUser || null);
            if (data.existingUser && !name.trim()) {
              setName(data.existingUser.fullName || data.existingUser.username || "");
            }
          }
        }
      } catch {
        // ignore
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [customEmail, token, invitation?.invitedUserEmail]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Only validate password if the user does NOT have an account yet
    if (!hasAccount) {
      if (!password || password.length < 4) {
        setFormError("Password must be at least 4 characters long.");
        return;
      }

      if (password !== confirmPassword) {
        setFormError("Passwords do not match.");
        return;
      }
    }

    if (!invitation) return;

    setIsSubmitting(true);

    try {
      const res = await fetch("/api/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: hasAccount ? undefined : password,
          email: invitation.invitedUserEmail || customEmail.trim() || undefined,
          username: name.trim() || invitation.invitedUserName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invitation.");
      }

      // Success! User is authenticated via session cookie, redirect to projects page
      router.push("/projects");
    } catch (err: any) {
      setFormError(err.message || "An error occurred. Please try again.");
      setIsSubmitting(false);
    }
  };

  const getPermissionLabel = (perm?: string) => {
    switch (perm) {
      case "full":
        return "Full Access";
      case "edit_no_delete":
        return "Read & Edit (No Delete)";
      default:
        return "Read Only";
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden font-sans">
      {/* Background glow effects */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/20 mb-3">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Project Invitation</h1>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Accept your project invitation and get started
          </p>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-2xl backdrop-blur-md">
            <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm font-medium text-slate-300">Validating invitation link...</p>
          </div>
        )}

        {/* Error States */}
        {!isLoading && errorStatus && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-8 shadow-2xl backdrop-blur-md text-center space-y-5 animate-in fade-in duration-200">
            <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mx-auto">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">
                {errorStatus === "expired"
                  ? "Invitation Expired"
                  : errorStatus === "already_accepted"
                  ? "Invitation Already Used"
                  : errorStatus === "revoked"
                  ? "Invitation Revoked"
                  : "Invalid Invitation Link"}
              </h2>
              <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                {errorStatus === "expired"
                  ? "This invitation link has expired. Please ask the project owner to generate a new invitation link for you."
                  : errorStatus === "already_accepted"
                  ? "This invitation link has already been accepted and cannot be reused. If you already set up an account, please log in."
                  : errorStatus === "revoked"
                  ? "This invitation has been revoked by the project owner."
                  : "We couldn't find an active invitation matching this link. The token may be invalid or incorrectly formatted."}
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <Link
                href="/login"
                className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition"
              >
                Go to Sign In
              </Link>
              <Link
                href="/"
                className="w-full py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition"
              >
                Back to Home
              </Link>
            </div>
          </div>
        )}

        {/* Valid Invitation: Acceptance Form */}
        {!isLoading && invitation && (
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md space-y-6 animate-in fade-in duration-200">
            {/* Invitation Details Banner */}
            <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Invited to project:</span>
                <span className="font-bold text-white text-sm">{invitation.projectName}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Invited by:</span>
                <span className="text-slate-300 font-medium">{invitation.inviterName}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/80">
                <span className="text-slate-400">Assigned Permission:</span>
                <span
                  className={`px-2 py-0.5 rounded font-semibold text-[11px] uppercase ${
                    invitation.permissionLevel === "full"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : invitation.permissionLevel === "edit_no_delete"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                  }`}
                >
                  {getPermissionLabel(invitation.permissionLevel)}
                </span>
              </div>
            </div>

            {/* Notification if User Already Has an Account */}
            {hasAccount ? (
              <div className="p-4 rounded-xl bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border border-blue-500/30 text-xs sm:text-sm text-slate-300 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-white">
                  <span className="text-base">👋</span>
                  <span>Welcome back, {existingUser?.fullName || existingUser?.username || "Friend"}!</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  An existing account was found for{" "}
                  <strong className="text-blue-400 font-medium">
                    {existingUser?.email || invitation.invitedUserEmail || existingUser?.username}
                  </strong>
                  . You do not need to set a password again. Click below to accept the invitation and join the project.
                </p>
              </div>
            ) : (
              <div className="border-b border-slate-800/80 pb-2">
                <h2 className="text-lg font-bold text-white">Set Up Your Password</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  No existing account found for this email. Choose a password to create your account and access{" "}
                  <strong className="text-slate-200">{invitation.projectName}</strong>.
                </p>
              </div>
            )}

            {formError && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs flex items-start gap-2">
                <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                  Your Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>

              {/* Email */}
              {invitation.invitedUserEmail ? (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Invited Email
                  </label>
                  <input
                    type="email"
                    disabled
                    value={invitation.invitedUserEmail}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-400 cursor-not-allowed selection:bg-none"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    {hasAccount ? "Linked to your existing registered account." : "Account will be registered with this invited email address."}
                  </span>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                    Your Email <span className="text-slate-500 font-normal lowercase">(optional)</span>
                  </label>
                  <input
                    type="email"
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    placeholder="friend@example.com (optional)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  />
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    {hasAccount ? "Existing account recognized for this email!" : "Optional email address for your login and notifications."}
                  </span>
                </div>
              )}

              {/* Password Fields ONLY shown for users who do NOT have an existing account */}
              {!hasAccount && (
                <>
                  {/* Create Password */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Create Password <span className="text-rose-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={4}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="At least 4 characters"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 pr-10 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                      Confirm Password <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      minLength={4}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                  </div>
                </>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 rounded-xl font-semibold text-sm bg-blue-600 hover:bg-blue-500 active:scale-98 text-white transition flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{hasAccount ? "Joining Project..." : "Setting up account..."}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{hasAccount ? "Accept Invitation & Join Project" : "Set Up Password & Join Project"}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <InviteAcceptContent />
    </Suspense>
  );
}

