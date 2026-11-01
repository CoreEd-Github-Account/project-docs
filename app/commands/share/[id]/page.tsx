"use client";

import React, { useEffect, useState, use, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

interface SharedCommandData {
  id: string;
  title?: string;
  command: string;
  category?: string;
  createdAt?: string;
}

const CATEGORY_COLORS: Record<string, { label: string; badge: string; dot: string }> = {
  github: { label: "Git", badge: "bg-orange-500/10 text-orange-300 border-orange-500/25", dot: "bg-orange-400" },
  npm: { label: "npm", badge: "bg-rose-500/10 text-rose-300 border-rose-500/25", dot: "bg-rose-400" },
  linux: { label: "Linux", badge: "bg-emerald-500/10 text-emerald-300 border-emerald-500/25", dot: "bg-emerald-400" },
  docker: { label: "Docker", badge: "bg-sky-500/10 text-sky-300 border-sky-500/25", dot: "bg-sky-400" },
  database: { label: "SQL", badge: "bg-indigo-500/10 text-indigo-300 border-indigo-500/25", dot: "bg-indigo-400" },
  other: { label: "CLI", badge: "bg-white/[0.05] text-slate-300 border-white/[0.1]", dot: "bg-slate-400" },
};

function getCategoryMeta(cat?: string) {
  if (!cat) return CATEGORY_COLORS.other;
  const key = cat.toLowerCase();
  if (CATEGORY_COLORS[key]) return CATEGORY_COLORS[key];
  return {
    label: cat.toUpperCase(),
    badge: "bg-teal-500/10 text-teal-300 border-teal-500/25",
    dot: "bg-teal-400",
  };
}

function SharedCommandContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const commandId = resolvedParams.id;
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [sharedCommand, setSharedCommand] = useState<SharedCommandData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "already_saved" | "error"
  >("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [copiedCmd, setCopiedCmd] = useState(false);

  // 1. Fetch public command and check authentication
  useEffect(() => {
    let isMounted = true;

    async function init() {
      setIsLoading(true);
      try {
        const cmdRes = await fetch(
          `/api/commands/share?id=${encodeURIComponent(commandId)}`
        );
        const cmdData = await cmdRes.json();

        if (!cmdRes.ok || !cmdData.command) {
          if (isMounted) {
            setErrorMessage(cmdData.error || "Shared command not found or has been removed.");
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setSharedCommand(cmdData.command);
        }

        // Check authentication
        const authRes = await fetch("/api/auth");
        const authData = await authRes.json();
        const authed = Boolean(authData.authenticated);

        if (isMounted) {
          setIsAuthenticated(authed);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to load shared command:", err);
        if (isMounted) {
          setErrorMessage("Failed to load command. Please check your connection and try again.");
          setIsLoading(false);
        }
      }
    }

    if (commandId) {
      init();
    }

    return () => {
      isMounted = false;
    };
  }, [commandId]);

  // 2. Auto-save command if user is authenticated
  const saveCommandToAccount = async () => {
    if (!commandId) return;
    setSaveStatus("saving");

    try {
      const res = await fetch("/api/commands/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commandId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSaveStatus("error");
        setSaveMessage(data.error || "Failed to automatically save command.");
        return;
      }

      if (data.alreadySaved) {
        setSaveStatus("already_saved");
        setSaveMessage("This command is already in your collection!");
      } else {
        setSaveStatus("saved");
        setSaveMessage("✓ Command automatically saved to your collection!");
      }

      // Auto redirect to /commands after 1.5 seconds
      setTimeout(() => {
        router.push("/commands?imported=true");
      }, 1500);
    } catch (err) {
      console.error("Save shared command error:", err);
      setSaveStatus("error");
      setSaveMessage("An error occurred while saving to your account.");
    }
  };

  useEffect(() => {
    if (isAuthenticated === true && sharedCommand && saveStatus === "idle") {
      saveCommandToAccount();
    }
  }, [isAuthenticated, sharedCommand, saveStatus]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
  };

  const handleCopy = () => {
    if (!sharedCommand?.command) return;
    navigator.clipboard.writeText(sharedCommand.command);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const catMeta = getCategoryMeta(sharedCommand?.category);

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans flex flex-col items-center justify-center p-4 sm:p-6 relative">
      {/* Subtle Terminal Glow */}
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />

      {/* Main Container */}
      <div className="w-full max-w-xl mx-auto z-10 space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <Link
            href="/commands"
            className="flex items-center gap-2 text-sm font-bold text-white hover:text-emerald-400 transition"
          >
            <span className="font-mono text-emerald-400">{">_"}</span>
            <span>Commands</span>
          </Link>

          <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/[0.05] text-slate-400 border border-white/[0.08]">
            Shared Command Link
          </span>
        </div>

        {/* LOADING STATE */}
        {isLoading && (
          <div className="bg-[#0d1017] border border-white/[0.08] rounded-2xl p-10 text-center space-y-3 shadow-xl">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-300 font-medium">Checking shared command...</p>
          </div>
        )}

        {/* ERROR STATE */}
        {!isLoading && errorMessage && (
          <div className="bg-[#0d1017] border border-rose-500/30 rounded-2xl p-8 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-xl">
              ✕
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">Command Not Found</h2>
              <p className="text-xs text-slate-400">{errorMessage}</p>
            </div>
            <Link
              href="/commands"
              className="inline-block px-4 py-2 bg-white/[0.07] hover:bg-white/[0.12] text-white text-xs font-semibold rounded-xl transition"
            >
              Return to Commands
            </Link>
          </div>
        )}

        {/* COMMAND PREVIEW & STATUS */}
        {!isLoading && sharedCommand && (
          <div className="space-y-6">
            {/* Status Feedback Banner */}
            {isAuthenticated === true && (
              <div
                className={`p-4 rounded-2xl border transition text-center space-y-2 ${
                  saveStatus === "saved"
                    ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                    : saveStatus === "already_saved"
                    ? "bg-amber-950/30 border-amber-500/30 text-amber-300"
                    : saveStatus === "saving"
                    ? "bg-blue-950/30 border-blue-500/30 text-blue-300"
                    : saveStatus === "error"
                    ? "bg-rose-950/30 border-rose-500/30 text-rose-300"
                    : "bg-[#0d1017] border-white/[0.08] text-slate-300"
                }`}
              >
                {saveStatus === "saving" && (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-medium">Automatically saving to your commands...</span>
                  </div>
                )}

                {(saveStatus === "saved" || saveStatus === "already_saved") && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">{saveMessage}</p>
                    <p className="text-[11px] text-slate-400">
                      Redirecting to your commands collection in a moment...
                    </p>
                    <div>
                      <Link
                        href="/commands?imported=true"
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white text-slate-950 text-xs font-bold rounded-xl hover:bg-slate-200 transition shadow-sm mt-1"
                      >
                        <span>Open My Commands</span>
                        <span>→</span>
                      </Link>
                    </div>
                  </div>
                )}

                {saveStatus === "error" && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-rose-300">{saveMessage}</p>
                    <button
                      type="button"
                      onClick={saveCommandToAccount}
                      className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                    >
                      Retry Save
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Shared Command Card Preview */}
            <div className="bg-[#0d1017] border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-mono font-medium border shrink-0 ${catMeta.badge}`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${catMeta.dot}`} />
                    {catMeta.label}
                  </span>

                  {sharedCommand.title && (
                    <span className="text-xs sm:text-sm font-medium text-white truncate">
                      {sharedCommand.title}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    copiedCmd
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08]"
                  }`}
                  title="Copy command to clipboard"
                >
                  {copiedCmd ? "✓ Copied" : "Copy"}
                </button>
              </div>

              {/* Terminal Code View */}
              <div className="bg-[#07090e] border border-white/[0.06] rounded-xl p-3.5 flex items-start gap-3 overflow-x-auto">
                <span className="text-emerald-400 font-mono text-xs select-none shrink-0">$</span>
                <pre className="text-xs text-slate-200 font-mono whitespace-pre-wrap break-words leading-relaxed select-text flex-1">
                  {sharedCommand.command}
                </pre>
              </div>
            </div>

            {/* UNAUTHENTICATED: Show "Please login with your account" notice & LoginForm */}
            {isAuthenticated === false && (
              <div className="space-y-4">
                <div className="bg-amber-950/30 border border-amber-500/30 rounded-2xl p-4 text-center space-y-1">
                  <div className="flex items-center justify-center gap-2 text-amber-400 font-semibold text-sm">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                    <span>Please login with your account</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    After logging in or creating an account, this shared command will automatically be saved to your command page.
                  </p>
                </div>

                <div className="bg-[#0d1017] border border-white/[0.08] rounded-2xl p-1 sm:p-2">
                  <LoginForm onLoginSuccess={handleLoginSuccess} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SharedCommandPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center text-slate-400 p-4">
          <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium text-slate-300">Loading shared command...</p>
        </div>
      }
    >
      <SharedCommandContent params={props.params} />
    </Suspense>
  );
}

