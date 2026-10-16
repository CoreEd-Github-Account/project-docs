"use client";

import React, { useState } from "react";

interface LoginFormProps {
  onLoginSuccess: () => void;
}

type AuthMode = "login" | "register" | "reset";

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [mode, setMode] = useState<AuthMode>("login");

  // Form Fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");

  // Feedback State
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetFormState = (newMode: AuthMode) => {
    setMode(newMode);
    setError("");
    setSuccessMsg("");
    setPassword("");
    setConfirmPassword("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    // 1. VALIDATION: LOGIN
    if (mode === "login") {
      if (!username.trim() || !password) {
        setError("Please enter your username and password");
        return;
      }

      try {
        setIsSubmitting(true);
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "login",
            username: username.trim(),
            password,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Invalid username or password");
          return;
        }

        onLoginSuccess();
      } catch (err) {
        console.error("Login request error:", err);
        setError("An unexpected error occurred. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 2. VALIDATION: REGISTER
    if (mode === "register") {
      if (!username.trim() || !password) {
        setError("Username and password are required");
        return;
      }
      if (username.trim().length < 3) {
        setError("Username must be at least 3 characters");
        return;
      }
      if (password.length < 4) {
        setError("Password must be at least 4 characters");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      try {
        setIsSubmitting(true);
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "register",
            username: username.trim(),
            email: email.trim() || undefined,
            password,
            recoveryKey: recoveryKey.trim() || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to create account");
          return;
        }

        onLoginSuccess();
      } catch (err) {
        console.error("Register request error:", err);
        setError("An unexpected error occurred. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 3. VALIDATION: RESET PASSWORD
    if (mode === "reset") {
      if (!username.trim() || !password) {
        setError("Please enter your username/email and new password");
        return;
      }
      if (password.length < 4) {
        setError("New password must be at least 4 characters");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        return;
      }

      try {
        setIsSubmitting(true);
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "reset",
            username: username.trim(),
            newPassword: password,
            recoveryKey: recoveryKey.trim() || undefined,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to reset password");
          return;
        }

        setSuccessMsg(data.message || "Password updated! You can now sign in.");
        setPassword("");
        setConfirmPassword("");
        setRecoveryKey("");
      } catch (err) {
        console.error("Reset password error:", err);
        setError("An unexpected error occurred. Please try again.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-7 sm:p-8 shadow-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center font-bold text-white text-xl mx-auto shadow-lg shadow-blue-500/20">
            T
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Template Studio
          </h1>
          <p className="text-xs text-slate-400">
            {mode === "login" && "Sign in to access your isolated workspace"}
            {mode === "register" && "Create your private account to store documents"}
            {mode === "reset" && "Reset your account password"}
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => resetFormState("login")}
            className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
              mode === "login"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => resetFormState("register")}
            className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
              mode === "register"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Create Account
          </button>
          <button
            type="button"
            onClick={() => resetFormState("reset")}
            className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
              mode === "reset"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            Reset
          </button>
        </div>

        {/* Success Notification */}
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-3.5 py-2.5 rounded-lg flex items-center gap-2">
            <svg
              className="w-4 h-4 shrink-0"
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
            <span>{successMsg}</span>
          </div>
        )}

        {/* Error Notification */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2.5 rounded-lg flex items-center gap-2">
            <svg
              className="w-4 h-4 shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              {mode === "reset" ? "Username or Email" : "Username"}
            </label>
            <input
              type="text"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={mode === "reset" ? "Enter your username or email" : "Enter username"}
              className="w-full bg-slate-800/90 border border-slate-700/80 px-3.5 py-2.5 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {mode === "register" && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Email
                </label>
                <span className="text-[11px] text-slate-500">Optional</span>
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full bg-slate-800/90 border border-slate-700/80 px-3.5 py-2.5 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
              {mode === "reset" ? "New Password" : "Password"}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === "reset" ? "Enter new password (min 4 chars)" : "Enter password"}
              className="w-full bg-slate-800/90 border border-slate-700/80 px-3.5 py-2.5 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
          </div>

          {(mode === "register" || mode === "reset") && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 uppercase tracking-wider">
                Confirm {mode === "reset" ? "New " : ""}Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full bg-slate-800/90 border border-slate-700/80 px-3.5 py-2.5 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          )}

          {(mode === "register" || mode === "reset") && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Security Recovery Key
                </label>
                <span className="text-[11px] text-slate-500">
                  {mode === "register" ? "Optional PIN / Phrase" : "If configured"}
                </span>
              </div>
              <input
                type="text"
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value)}
                placeholder="e.g. secret-pin-1234 or favorite word"
                className="w-full bg-slate-800/90 border border-slate-700/80 px-3.5 py-2.5 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 px-4 rounded-lg text-sm transition shadow-md shadow-blue-600/20 active:scale-[0.98] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 mt-4"
          >
            {isSubmitting ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>
                  {mode === "login" && "Authenticating..."}
                  {mode === "register" && "Creating Account..."}
                  {mode === "reset" && "Updating Password..."}
                </span>
              </>
            ) : (
              <span>
                {mode === "login" && "Sign In"}
                {mode === "register" && "Create Account"}
                {mode === "reset" && "Update Password"}
              </span>
            )}
          </button>
        </form>

        {/* Footer Links */}
        <div className="text-center text-xs text-slate-400 pt-1 space-y-1">
          {mode === "login" && (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => resetFormState("register")}
                className="text-blue-400 hover:underline cursor-pointer"
              >
                Create Account
              </button>
              <span>&bull;</span>
              <button
                type="button"
                onClick={() => resetFormState("reset")}
                className="text-slate-400 hover:text-slate-200 hover:underline cursor-pointer"
              >
                Forgot Password?
              </button>
            </div>
          )}
          {mode !== "login" && (
            <button
              type="button"
              onClick={() => resetFormState("login")}
              className="text-blue-400 hover:underline cursor-pointer"
            >
              &larr; Back to Sign In
            </button>
          )}
        </div>

        {/* Security badge */}
        <div className="pt-2 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1.5 border-t border-slate-800/80">
          <svg
            className="w-3.5 h-3.5 text-slate-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span>Multi-User Isolated Database &bull; Supabase PG</span>
        </div>
      </div>
    </div>
  );
}
