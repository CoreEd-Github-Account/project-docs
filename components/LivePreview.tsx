"use client";

import React from "react";

interface LivePreviewProps {
  projectName: string;
  generatedText: string;
  onCopy: () => void;
  onDownload: () => void;
  onShare: () => void;
  copied: boolean;
}

export function LivePreview({
  projectName,
  generatedText,
  onCopy,
  onDownload,
  onShare,
  copied,
}: LivePreviewProps) {
  return (
    <div className="bg-[#0d1017] text-slate-100 p-4 sm:p-5 rounded-2xl flex flex-col min-h-[620px] border border-white/[0.07] space-y-4">
      <div className="flex flex-wrap gap-3 justify-between items-center pb-3.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-bold text-white tracking-tight">
            Preview
          </h2>
          <span className="text-[11px] px-2 py-0.5 rounded-md bg-white/[0.05] text-slate-400 font-medium border border-white/[0.06]">
            {projectName}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onShare}
            title="Generate a 10-minute expiring view-only link"
            className="bg-[#10131c] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs transition font-medium flex items-center gap-1.5 cursor-pointer active:scale-[0.98]"
          >
            <svg
              className="w-3.5 h-3.5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.8}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            <span>Share</span>
          </button>

          <button
            onClick={onCopy}
            className="bg-[#10131c] hover:bg-white/[0.06] border border-white/[0.08] px-3 py-1.5 rounded-xl text-xs transition font-medium flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white"
          >
            {copied ? (
              <span className="text-white font-semibold">Copied</span>
            ) : (
              <>
                <svg
                  className="w-3.5 h-3.5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>

          <button
            onClick={onDownload}
            className="bg-white hover:bg-slate-200 text-slate-950 px-3.5 py-1.5 rounded-xl text-xs transition font-semibold flex items-center gap-1.5 active:scale-[0.98] cursor-pointer"
          >
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span>Download .txt</span>
          </button>
        </div>
      </div>

      <pre className="flex-1 p-4 sm:p-5 bg-[#07090e] rounded-xl overflow-auto text-xs sm:text-sm font-mono whitespace-pre-wrap leading-relaxed border border-white/[0.07] selection:bg-white/20 selection:text-white min-h-[480px] text-slate-200">
        {generatedText}
      </pre>
    </div>
  );
}
