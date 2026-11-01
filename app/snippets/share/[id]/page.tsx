"use client";

import React, { useEffect, useState, use, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

interface SharedSnippetData {
  id: string;
  title: string;
  description?: string;
  content: string;
  category?: string;
  createdAt?: string;
}

function SharedSnippetContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const snippetId = resolvedParams.id;
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [sharedSnippet, setSharedSnippet] = useState<SharedSnippetData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "already_saved" | "error"
  >("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  // 1. Fetch public snippet and verify authentication
  useEffect(() => {
    let isMounted = true;

    async function init() {
      setIsLoading(true);
      try {
        const snippetRes = await fetch(
          `/api/snippets/share?id=${encodeURIComponent(snippetId)}`
        );
        const snippetData = await snippetRes.json();

        if (!snippetRes.ok || !snippetData.snippet) {
          if (isMounted) {
            setErrorMessage(snippetData.error || "Shared snippet not found or has been removed.");
            setIsLoading(false);
          }
          return;
        }

        if (isMounted) {
          setSharedSnippet(snippetData.snippet);
        }

        const authRes = await fetch("/api/auth");
        const authData = await authRes.json();
        const authed = Boolean(authData.authenticated);

        if (isMounted) {
          setIsAuthenticated(authed);
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Failed to load shared snippet:", err);
        if (isMounted) {
          setErrorMessage("Failed to load snippet. Please check your connection and try again.");
          setIsLoading(false);
        }
      }
    }

    if (snippetId) {
      init();
    }

    return () => {
      isMounted = false;
    };
  }, [snippetId]);

  // 2. Save snippet into user account
  const saveSnippetToAccount = async () => {
    if (!snippetId) return;
    setSaveStatus("saving");

    try {
      const res = await fetch("/api/snippets/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ snippetId }),
      });

      const data = await res.json();

      if (res.ok) {
        if (data.alreadyExists) {
          setSaveStatus("already_saved");
          setSaveMessage("This snippet is already in your workspace library.");
        } else {
          setSaveStatus("saved");
          setSaveMessage("Snippet successfully added to your workspace!");
          setTimeout(() => {
            router.push("/snippets?imported=1");
          }, 1200);
        }
      } else {
        setSaveStatus("error");
        setSaveMessage(data.error || "Failed to save snippet.");
      }
    } catch (err) {
      console.error("Error saving snippet:", err);
      setSaveStatus("error");
      setSaveMessage("Network error while saving snippet.");
    }
  };

  const handleCopy = () => {
    if (!sharedSnippet?.content) return;
    navigator.clipboard.writeText(sharedSnippet.content);
    setCopiedSnippet(true);
    setTimeout(() => setCopiedSnippet(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium">Loading shared snippet...</p>
      </div>
    );
  }

  if (errorMessage || !sharedSnippet) {
    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#0d1017] border border-white/[0.08] rounded-2xl p-6 text-center space-y-4 shadow-2xl">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-xl">
            📋
          </div>
          <h2 className="text-lg font-bold text-white">Snippet Unavailable</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            {errorMessage || "The link might be broken or expired."}
          </p>
          <Link
            href="/snippets"
            className="inline-block px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-xs font-semibold rounded-xl transition"
          >
            Go to Snippets
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/[0.08] bg-[#090b10]/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            href="/snippets"
            className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
          >
            <span>← Back to Workspace</span>
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-rose-400/90 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-md">
              Public Shared Snippet
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-10 space-y-6">
        {/* Banner notification if saved */}
        {saveMessage && (
          <div
            className={`px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between shadow-lg ${
              saveStatus === "saved"
                ? "bg-emerald-950/60 border border-emerald-500/40 text-emerald-300"
                : saveStatus === "already_saved"
                ? "bg-blue-950/60 border border-blue-500/40 text-blue-300"
                : "bg-rose-950/60 border border-rose-500/40 text-rose-300"
            }`}
          >
            <span>{saveMessage}</span>
            {saveStatus === "saved" && (
              <span className="text-[11px] underline ml-2">Redirecting...</span>
            )}
          </div>
        )}

        {/* Snippet Card */}
        <div className="bg-[#0d1017] border border-white/[0.09] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📋</span>
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  {sharedSnippet.title}
                </h1>
              </div>
              {sharedSnippet.description && (
                <p className="text-xs sm:text-sm text-slate-400">
                  {sharedSnippet.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                onClick={handleCopy}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  copiedSnippet
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                    : "bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/[0.08]"
                }`}
              >
                {copiedSnippet ? "✓ Copied" : "Copy Text"}
              </button>

              {isAuthenticated && (
                <button
                  onClick={saveSnippetToAccount}
                  disabled={saveStatus === "saving" || saveStatus === "saved"}
                  className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white transition cursor-pointer shadow-md shadow-rose-500/20"
                >
                  {saveStatus === "saving"
                    ? "Saving..."
                    : saveStatus === "saved"
                    ? "Saved ✓"
                    : "+ Save to Workspace"}
                </button>
              )}
            </div>
          </div>

          {/* Snippet Content Area */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>SNIPPET CONTENT</span>
              <span>{sharedSnippet.content.length} characters</span>
            </div>
            <div className="p-4 rounded-xl bg-[#07090e] border border-white/[0.07] font-mono text-xs text-slate-200 whitespace-pre-wrap select-text leading-relaxed">
              {sharedSnippet.content}
            </div>
          </div>

          {/* Details footer */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-white/[0.05]">
            <span>Category: {sharedSnippet.category || "General"}</span>
            <span>
              {sharedSnippet.createdAt
                ? new Date(sharedSnippet.createdAt).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Public"}
            </span>
          </div>
        </div>

        {/* If user is not authenticated, show quick login to clone */}
        {!isAuthenticated && (
          <div className="bg-[#0d1017]/70 border border-white/[0.07] rounded-2xl p-6 text-center space-y-4">
            <h3 className="text-sm font-semibold text-white">
              Want to save this snippet directly into your workspace?
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Sign in to automatically import this snippet into your personal collection.
            </p>
            <div className="max-w-sm mx-auto">
              <LoginForm
                onLoginSuccess={() => {
                  setIsAuthenticated(true);
                  saveSnippetToAccount();
                }}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function SharedSnippetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center text-slate-400">
          <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-medium">Loading snippet...</p>
        </div>
      }
    >
      <SharedSnippetContent params={params} />
    </Suspense>
  );
}
