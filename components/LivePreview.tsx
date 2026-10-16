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
    <div className="bg-slate-900 text-slate-100 p-6 sm:p-8 rounded-xl shadow-md flex flex-col min-h-[650px] border border-slate-800 space-y-4">
      <div className="flex flex-wrap gap-3 justify-between items-center pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <span>Live Preview</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal border border-slate-700">
              {projectName}
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Rendered template preview ready for sharing, copying, or downloading.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* SHARE BUTTON */}
          <button
            onClick={onShare}
            title="Generate a 10-minute expiring view-only link"
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg text-sm transition font-medium flex items-center gap-1.5 shadow-sm shadow-indigo-600/30 cursor-pointer active:scale-[0.98]"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            <span>Share</span>
          </button>

          <button
            onClick={onCopy}
            className="bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 rounded-lg text-sm transition font-medium flex items-center gap-1.5 cursor-pointer text-slate-200"
          >
            {copied ? (
              <>
                <svg
                  className="w-4 h-4 text-emerald-400"
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
                <span className="text-emerald-400 font-bold">Copied!</span>
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                <span>Copy</span>
              </>
            )}
          </button>
          <button
            onClick={onDownload}
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm transition font-medium flex items-center gap-1.5 shadow-sm shadow-blue-600/30 active:scale-[0.98] cursor-pointer text-white"
          >
            <svg
              className="w-4 h-4"
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

      <pre className="flex-1 p-5 bg-slate-950 rounded-lg overflow-auto text-sm font-mono whitespace-pre-wrap leading-relaxed border border-slate-800 selection:bg-blue-900 selection:text-white min-h-[480px] text-slate-200">
        {generatedText}
      </pre>
    </div>
  );
}
