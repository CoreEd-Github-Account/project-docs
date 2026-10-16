"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";

interface SharedLinkData {
  id: string;
  projectId: string;
  projectName: string;
  content: string;
  expiresAt: string;
  createdAt: string;
}

function SharedProjectContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const shareId = resolvedParams.id;

  const [isLoading, setIsLoading] = useState(true);
  const [isExpired, setIsExpired] = useState(false);
  const [data, setData] = useState<SharedLinkData | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function fetchShareData() {
      try {
        setIsLoading(true);
        const res = await fetch(`/api/share/${shareId}`);
        const result = await res.json();

        if (!isMounted) return;

        if (!res.ok || result.expired || !result.link) {
          setIsExpired(true);
          setData(null);
        } else {
          setIsExpired(false);
          setData(result.link);
        }
      } catch (err) {
        console.error("Failed to load shared link:", err);
        if (isMounted) {
          setIsExpired(true);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    if (shareId) {
      fetchShareData();
    }

    return () => {
      isMounted = false;
    };
  }, [shareId]);

  // Live Countdown Timer
  useEffect(() => {
    if (!data?.expiresAt) return;

    const targetTime = new Date(data.expiresAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diff = targetTime - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
        setIsExpired(true);
        return;
      }

      const totalSeconds = Math.floor(diff / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      setTimeLeft(
        `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [data?.expiresAt]);

  const handleCopy = async () => {
    if (!data?.content) return;
    try {
      await navigator.clipboard.writeText(data.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      const pre = document.getElementById("shared-content-view");
      if (pre) {
        const range = document.createRange();
        range.selectNodeContents(pre);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    }
  };

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 p-4">
        <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-sm font-medium text-slate-300">Loading shared project preview...</p>
        <span className="text-xs text-slate-500 mt-1">Verifying expiration timer</span>
      </div>
    );
  }

  // 2. Expired State
  if (isExpired || !data) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
        <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6 relative overflow-hidden">
          {/* Top Amber Ambient Glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-amber-500/60 rounded-full blur-sm"></div>

          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.75}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Link Expired
            </h1>
            <p className="text-sm text-amber-300/90 font-medium leading-relaxed bg-amber-950/40 border border-amber-500/30 rounded-lg p-3">
              your link has expired, request again to data owner
            </p>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            Shared documentation links automatically expire 10 minutes after generation for security. Please ask the project owner to generate a fresh link.
          </p>

          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition border border-slate-700 cursor-pointer"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 3. Active View-Only Preview (Figma Style)
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-900 selection:text-white">
      {/* Top Figma-Style View-Only Header */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-20 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Left: Branding & Project Title */}
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white text-xs shadow-md shadow-indigo-600/30 shrink-0">
              T
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-white truncate leading-tight">
                  {data.projectName}
                </h1>
                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                  <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  <span>View only</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                Figma-style read-only preview • Editing disabled
              </p>
            </div>
          </div>

          {/* Right: Expiration Countdown & Copy Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Live Expiration Countdown */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-950/40 border border-amber-500/40 text-amber-300 text-xs font-semibold shadow-inner">
              <svg className="w-3.5 h-3.5 text-amber-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Expires in {timeLeft}</span>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopy}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3.5 py-1.5 rounded-lg text-xs transition flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 cursor-pointer active:scale-95"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Copy Text</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 flex flex-col space-y-4">
        {/* Notice Banner */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 -ml-4"></span>
            <span className="font-medium text-slate-200">
              Read-Only Access Granted
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">
              Generated at {new Date(data.createdAt).toLocaleTimeString()}
            </span>
          </div>
          <span className="text-slate-400 italic">
            You cannot make modifications to this project.
          </span>
        </div>

        {/* Read-Only Content Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 sm:p-7 shadow-lg flex-1 flex flex-col min-h-[550px]">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800 text-xs text-slate-400 font-mono">
            <span>PREVIEW CONTENT</span>
            <span>{data.content.length} characters</span>
          </div>

          <pre
            id="shared-content-view"
            className="flex-1 p-5 bg-slate-950 rounded-lg overflow-auto text-sm font-mono whitespace-pre-wrap leading-relaxed border border-slate-800/80 text-slate-200 select-text min-h-[450px]"
          >
            {data.content}
          </pre>
        </div>
      </main>
    </div>
  );
}

export default function SharedProjectPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400 p-4">
          <div className="w-10 h-10 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-sm font-medium text-slate-300">Loading shared project preview...</p>
          <span className="text-xs text-slate-500 mt-1">Verifying expiration timer</span>
        </div>
      }
    >
      <SharedProjectContent params={props.params} />
    </React.Suspense>
  );
}
