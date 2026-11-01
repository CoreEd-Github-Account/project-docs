"use client";

import React, { useEffect, useState, use, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

interface SharedPromptData {
  id: string;
  heading: string;
  description?: string;
  prompt: string;
  createdAt?: string;
}

function SharedPromptContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const promptId = resolvedParams.id;
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [sharedPrompt, setSharedPrompt] = useState<SharedPromptData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "already_saved" | "error"
  >("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // 1. Fetch public prompt and verify authentication
  useEffect(() => {
    let isMounted = true;

    async function init() {
      setIsLoading(true);
      try {
        // Fetch prompt details publicly
        const promptRes = await fetch(
          `/api/prompts/share?id=${encodeURIComponent(promptId)}`
        );
        const promptData = await promptRes.json();

        if (!promptRes.ok || !promptData.prompt) {
          if (isMounted) {
            setErrorMessage(promptData.error || "Shared prompt not found or has been removed.");
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setSharedPrompt(promptData.prompt);
        }

        // Check user authentication
        const authRes = await fetch("/api/auth");
        const authData = await authRes.json();
        const authed = Boolean(authData.authenticated);

        if (isMounted) {
          setIsAuthenticated(authed);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to load shared prompt:", err);
        if (isMounted) {
          setErrorMessage("Failed to load prompt. Please check your connection and try again.");
          setIsLoading(false);
        }
      }
    }

    if (promptId) {
      init();
    }

    return () => {
      isMounted = false;
    };
  }, [promptId]);

  // 2. Auto-save prompt if user is authenticated
  const savePromptToAccount = async () => {
    if (!promptId) return;
    setSaveStatus("saving");

    try {
      const res = await fetch("/api/prompts/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptId }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSaveStatus("error");
        setSaveMessage(data.error || "Failed to automatically save prompt.");
        return;
      }

      if (data.alreadySaved) {
        setSaveStatus("already_saved");
        setSaveMessage("This prompt is already in your collection!");
      } else {
        setSaveStatus("saved");
        setSaveMessage("✓ Prompt automatically saved to your collection!");
      }

      // Auto redirect to /prompts after 1.5 seconds
      setTimeout(() => {
        router.push("/prompts?imported=true");
      }, 1500);
    } catch (err) {
      console.error("Save shared prompt error:", err);
      setSaveStatus("error");
      setSaveMessage("An error occurred while saving to your account.");
    }
  };

  useEffect(() => {
    if (isAuthenticated === true && sharedPrompt && saveStatus === "idle") {
      savePromptToAccount();
    }
  }, [isAuthenticated, sharedPrompt, saveStatus]);

  const handleLoginSuccess = () => {
    setIsAuthenticated(true);
    // After login, savePromptToAccount will trigger via the useEffect
  };

  const handleCopy = () => {
    if (!sharedPrompt?.prompt) return;
    navigator.clipboard.writeText(sharedPrompt.prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans flex flex-col items-center justify-center p-4 sm:p-6 relative">
      {/* Background Accent */}
      <div className="fixed inset-0 pointer-events-none opacity-40 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-orange-500/10 via-transparent to-transparent" />

      {/* Main Container */}
      <div className="w-full max-w-xl mx-auto z-10 space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <Link
            href="/prompts"
            className="flex items-center gap-2 text-sm font-bold text-white hover:text-orange-400 transition"
          >
            <span className="text-lg">💡</span>
            <span>Prompts</span>
          </Link>

          <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/[0.05] text-slate-400 border border-white/[0.08]">
            Shared Prompt Link
          </span>
        </div>

        {/* LOADING STATE */}
        {isLoading && (
          <div className="bg-[#0d1017] border border-white/[0.08] rounded-2xl p-10 text-center space-y-3 shadow-xl">
            <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-300 font-medium">Checking shared prompt...</p>
          </div>
        )}

        {/* ERROR STATE */}
        {!isLoading && errorMessage && (
          <div className="bg-[#0d1017] border border-rose-500/30 rounded-2xl p-8 text-center space-y-4 shadow-xl">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-xl">
              ✕
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">Prompt Not Found</h2>
              <p className="text-xs text-slate-400">{errorMessage}</p>
            </div>
            <Link
              href="/prompts"
              className="inline-block px-4 py-2 bg-white/[0.07] hover:bg-white/[0.12] text-white text-xs font-semibold rounded-xl transition"
            >
              Return to Prompts
            </Link>
          </div>
        )}

        {/* PROMPT PREVIEW & STATUS */}
        {!isLoading && sharedPrompt && (
          <div className="space-y-6">
            {/* Status Feedback Banner (if authenticated & saving/saved) */}
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
                    <span className="text-xs font-medium">Automatically saving to your prompts...</span>
                  </div>
                )}

                {(saveStatus === "saved" || saveStatus === "already_saved") && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">{saveMessage}</p>
                    <p className="text-[11px] text-slate-400">
                      Redirecting to your prompts collection in a moment...
                    </p>
                    <div>
                      <Link
                        href="/prompts?imported=true"
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-white text-slate-950 text-xs font-bold rounded-xl hover:bg-slate-200 transition shadow-sm mt-1"
                      >
                        <span>Open My Prompts</span>
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
                      onClick={savePromptToAccount}
                      className="px-3.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                    >
                      Retry Save
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Shared Prompt Card Preview */}
            <div className="bg-[#0d1017] border border-white/[0.08] rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[10px] uppercase tracking-wider text-orange-400 font-bold block mb-1">
                    Shared Prompt
                  </span>
                  <h2 className="text-base font-bold text-white truncate">
                    {sharedPrompt.heading}
                  </h2>
                  {sharedPrompt.description && (
                    <p className="text-xs text-slate-400 mt-0.5">
                      {sharedPrompt.description}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCopy}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer shrink-0 ${
                    copiedPrompt
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : "bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08]"
                  }`}
                  title="Copy prompt text to clipboard"
                >
                  {copiedPrompt ? "✓ Copied" : "Copy Prompt"}
                </button>
              </div>

              {/* Prompt Text Box */}
              <pre className="bg-[#07090e] border border-white/[0.06] rounded-xl p-3.5 text-xs text-slate-200 font-mono whitespace-pre-wrap break-words max-h-56 overflow-y-auto leading-relaxed select-text">
                {sharedPrompt.prompt}
              </pre>
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
                    After logging in or creating an account, this shared prompt will automatically be saved to your prompt page.
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

export default function SharedPromptPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center text-slate-400 p-4">
          <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
          <p className="text-sm font-medium text-slate-300">Loading shared prompt...</p>
        </div>
      }
    >
      <SharedPromptContent params={props.params} />
    </Suspense>
  );
}
