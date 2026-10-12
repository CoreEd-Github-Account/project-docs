"use client";

import React from "react";

interface LivePreviewProps {
  projectName: string;
  generatedText: string;
  onCopy: () => void;
  onDownload: () => void;
  copied: boolean;
}

export function LivePreview({
  projectName,
  generatedText,
  onCopy,
  onDownload,
  copied,
}: LivePreviewProps) {
  return (
    <div className="bg-gray-900 text-gray-100 p-6 sm:p-8 rounded-xl shadow-lg flex flex-col min-h-[650px] border border-gray-800 space-y-4">
      <div className="flex flex-wrap gap-3 justify-between items-center pb-4 border-b border-gray-800">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <span>Live Preview</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-normal border border-slate-700">
              {projectName}
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Rendered template preview ready for copying or downloading.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={onCopy}
            className="bg-gray-800 hover:bg-gray-700 border border-gray-700 px-4 py-2 rounded-lg text-sm transition font-medium flex items-center gap-1.5 cursor-pointer"
          >
            {copied ? (
              <>
                <svg
                  className="w-4 h-4 text-green-400"
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
                <span className="text-green-400">Copied!</span>
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4 text-gray-400"
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
            className="bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm transition font-medium flex items-center gap-1.5 shadow-sm active:scale-[0.98] cursor-pointer"
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

      <pre className="flex-1 p-5 bg-gray-950 rounded-lg overflow-auto text-sm font-mono whitespace-pre-wrap leading-relaxed border border-gray-800/80 selection:bg-blue-900 selection:text-white min-h-[480px]">
        {generatedText}
      </pre>
    </div>
  );
}
