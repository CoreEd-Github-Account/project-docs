"use client";

import React, { useState, useEffect } from "react";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectName: string;
  content: string;
}

export function ShareModal({
  isOpen,
  onClose,
  projectId,
  projectName,
  content,
}: ShareModalProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setShareUrl("");
      setExpiresAt(null);
      setCopied(false);
      setError("");
      return;
    }

    let isMounted = true;
    async function generateLink() {
      try {
        setIsGenerating(true);
        setError("");
        const res = await fetch("/api/share", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, projectName, content }),
        });

        if (!res.ok) {
          throw new Error("Failed to generate link");
        }

        const data = await res.json();
        if (isMounted) {
          const origin = window.location.origin;
          setShareUrl(`${origin}/share/${data.shareId}`);
          setExpiresAt(data.expiresAt);
        }
      } catch (err) {
        console.error("Error generating share link:", err);
        if (isMounted) {
          setError("Failed to create share link. Please try again.");
        }
      } finally {
        if (isMounted) {
          setIsGenerating(false);
        }
      }
    }

    generateLink();

    return () => {
      isMounted = false;
    };
  }, [isOpen, projectId, projectName, content]);

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      const input = document.getElementById("share-url-input") as HTMLInputElement;
      if (input) {
        input.select();
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl shadow-black/80 relative space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Share Live Preview</h3>
              <p className="text-xs text-slate-400">
                Generate an expiring view-only link for &quot;{projectName}&quot;
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 10-Minute Expiry Badge */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-950/30 border border-amber-500/30 text-amber-300 text-xs font-medium">
          <svg className="w-4 h-4 shrink-0 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>
            <strong>10-Minute Expiring Link:</strong> Viewers can only view this data. After 10 minutes, the link expires automatically.
          </span>
        </div>

        {/* URL Box */}
        {isGenerating ? (
          <div className="py-8 flex flex-col items-center justify-center text-slate-400 gap-2">
            <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-medium">Generating secure share link...</p>
          </div>
        ) : error ? (
          <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-xs text-red-300">
            {error}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                id="share-url-input"
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-xs font-mono text-slate-200 select-all focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleCopy}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium px-4 py-2.5 rounded-lg text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-blue-600/30 shrink-0"
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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

            <div className="text-[11px] text-slate-400 flex items-center justify-between px-1">
              <span>View-only mode (Figma style)</span>
              {expiresAt && (
                <span className="text-amber-400/90 font-medium">
                  Expires at {new Date(expiresAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
