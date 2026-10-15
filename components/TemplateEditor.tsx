"use client";

import React from "react";
import type { Project } from "@/lib/types";

interface TemplateEditorProps {
  project: Project;
  newHeading: string;
  setNewHeading: (val: string) => void;
  onUpdateProjectName: (name: string) => void;
  onAddSection: () => void;
  onRemoveSection: (id: number) => void;
  onUpdateSectionContent: (id: number, content: string) => void;
  onApplyMyTemplate: () => void;
}

export function TemplateEditor({
  project,
  newHeading,
  setNewHeading,
  onUpdateProjectName,
  onAddSection,
  onRemoveSection,
  onUpdateSectionContent,
  onApplyMyTemplate,
}: TemplateEditorProps) {
  return (
    <div className="bg-slate-900 p-6 sm:p-8 rounded-xl shadow-md border border-slate-800 space-y-6">
      <div className="border-b border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Template Builder
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure headings and details for this project file.
          </p>
        </div>

        {/* MY TEMPLATE QUICK ACTION BUTTON */}
        <button
          onClick={onApplyMyTemplate}
          title="Auto-add standard headings: PORT, Live URL, Admin Credentials, Build Command"
          className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-semibold shadow-sm transition active:scale-[0.98] cursor-pointer shrink-0"
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
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <span>My Template</span>
        </button>
      </div>

      {/* Project Name Field */}
      <div>
        <label className="block text-sm font-semibold text-slate-300 mb-1.5">
          Project Name
        </label>
        <input
          type="text"
          value={project.name}
          onChange={(e) => onUpdateProjectName(e.target.value)}
          placeholder="Enter project name..."
          className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-lg text-white placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition font-medium"
        />
      </div>

      {/* Add New Section Heading */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-sm font-semibold text-slate-300">
            Add Section Heading
          </label>
          <span className="text-xs text-slate-400">
            or use <strong>My Template</strong> above
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={newHeading}
            onChange={(e) => setNewHeading(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onAddSection();
              }
            }}
            placeholder="e.g. Live URL, Admin Credentials..."
            className="flex-1 bg-slate-950 border border-slate-700 p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm text-white placeholder-slate-500 transition"
          />
          <button
            onClick={onAddSection}
            className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition whitespace-nowrap border border-slate-700 active:scale-[0.98] cursor-pointer"
          >
            Add Heading
          </button>
        </div>
      </div>

      {/* Section Content List */}
      <div className="space-y-5 pt-2">
        {project.sections.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400 border-2 border-dashed border-slate-800 bg-slate-950/40 rounded-xl space-y-3">
            <p className="text-sm">
              No headings in this project yet. Add headings manually or insert the preset headings.
            </p>
            <button
              onClick={onApplyMyTemplate}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-950/60 hover:bg-blue-900/60 text-blue-400 rounded-lg text-sm font-semibold transition border border-blue-500/30 cursor-pointer"
            >
              <span>⚡ Load &quot;My Template&quot; Headings</span>
            </button>
          </div>
        ) : (
          project.sections.map((sec) => (
            <div
              key={sec.id}
              className="border-l-4 border-blue-500 pl-4 bg-slate-950/80 p-4 rounded-r-lg border-y border-r border-slate-800 space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-white text-base">
                  {sec.heading}
                </h3>
                <button
                  onClick={() => onRemoveSection(sec.id)}
                  title="Remove section"
                  className="text-slate-400 hover:text-red-400 p-1 text-xs transition rounded cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <textarea
                rows={5}
                value={sec.content}
                onChange={(e) => onUpdateSectionContent(sec.id, e.target.value)}
                placeholder={`${sec.heading} content goes here...`}
                className="w-full bg-slate-900 border border-slate-700 p-3 rounded-md outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm leading-relaxed text-slate-100 placeholder-slate-500"
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
