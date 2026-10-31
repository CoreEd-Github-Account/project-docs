"use client";

import React, { useState } from "react";
import type { Project } from "@/lib/types";

interface TemplateEditorProps {
  project: Project;
  newHeading: string;
  setNewHeading: (val: string) => void;
  onUpdateProjectName: (name: string) => void;
  onAddSection: () => void;
  onRemoveSection: (id: number) => void;
  onUpdateSectionContent: (id: number, content: string) => void;
  onUpdateSectionHeading: (id: number, heading: string) => void;
  onApplyMyTemplate: () => void;
  isReadOnly?: boolean;
  canDelete?: boolean;
}

export function TemplateEditor({
  project,
  newHeading,
  setNewHeading,
  onUpdateProjectName,
  onAddSection,
  onRemoveSection,
  onUpdateSectionContent,
  onUpdateSectionHeading,
  onApplyMyTemplate,
  isReadOnly = false,
  canDelete = true,
}: TemplateEditorProps) {
  const [editingHeadingId, setEditingHeadingId] = useState<number | null>(null);
  const [tempHeadingText, setTempHeadingText] = useState("");
  const [copiedSectionId, setCopiedSectionId] = useState<number | null>(null);

  const startEditingHeading = (id: number, currentHeading: string) => {
    if (isReadOnly) return;
    setEditingHeadingId(id);
    setTempHeadingText(currentHeading);
  };

  const saveEditingHeading = (id: number) => {
    if (isReadOnly) return;
    if (tempHeadingText.trim()) {
      onUpdateSectionHeading(id, tempHeadingText.trim());
    }
    setEditingHeadingId(null);
  };

  const cancelEditingHeading = () => {
    setEditingHeadingId(null);
    setTempHeadingText("");
  };

  const handleCopySection = (id: number, content: string) => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopiedSectionId(id);
    setTimeout(() => setCopiedSectionId(null), 1800);
  };

  return (
    <div className="space-y-4">
      {isReadOnly && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#0d1017] border border-white/[0.08] text-slate-300 text-xs">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 shrink-0" />
          <div>
            <strong className="font-semibold text-white">Read-Only View:</strong>{" "}
            You can view and copy sections, but editing is disabled for your role.
          </div>
        </div>
      )}

      {/* Top Project Info & Quick Add Card */}
      <div className="bg-[#0d1017] p-4 sm:p-5 rounded-2xl border border-white/[0.07] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-white/[0.06]">
          <div className="flex items-center gap-2.5">
            <h2 className="text-base font-bold text-white tracking-tight">
              Template &amp; Specs
            </h2>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-white/[0.05] text-slate-400 border border-white/[0.06]">
              {project.sections.length} {project.sections.length === 1 ? "section" : "sections"}
            </span>
          </div>

          {!isReadOnly && (
            <button
              onClick={onApplyMyTemplate}
              title="Add standard sections: PORT, Live URL, Admin Credentials, Build Command"
              className="flex items-center gap-1.5 bg-[#10131c] hover:bg-white/[0.06] border border-white/[0.08] text-slate-300 hover:text-white px-3 py-1.5 rounded-xl text-xs font-medium transition active:scale-[0.98] cursor-pointer shrink-0"
            >
              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
              </svg>
              <span>Load Standard Sections</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* Project Name Field */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
              Project Name
            </label>
            <input
              type="text"
              readOnly={isReadOnly}
              disabled={isReadOnly}
              value={project.name}
              onChange={(e) => onUpdateProjectName(e.target.value)}
              placeholder="Enter project name..."
              className={`w-full bg-[#07090e] border border-white/[0.08] px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition ${
                isReadOnly
                  ? "text-slate-400 cursor-not-allowed"
                  : "text-white placeholder-slate-600 focus:border-white/[0.22] outline-none"
              }`}
            />
          </div>

          {/* Add New Section Heading */}
          {!isReadOnly && (
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Add New Section
              </label>
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
                  placeholder="e.g. Live URL, Database URI, Port..."
                  className="flex-1 bg-[#07090e] border border-white/[0.08] px-3.5 py-2 rounded-xl outline-none focus:border-white/[0.22] text-xs sm:text-sm text-white placeholder-slate-600 transition"
                />
                <button
                  onClick={onAddSection}
                  className="bg-white hover:bg-slate-200 text-slate-950 px-4 py-2 rounded-xl text-xs font-semibold transition whitespace-nowrap active:scale-[0.98] cursor-pointer"
                >
                  + Add
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Section Content List */}
      <div className="space-y-3">
        {project.sections.length === 0 ? (
          <div className="text-center py-12 px-4 text-slate-400 border border-white/[0.07] bg-[#0d1017] rounded-2xl space-y-3">
            <p className="text-sm font-semibold text-slate-200">
              No sections added yet
            </p>
            <p className="text-xs text-slate-500">
              Add a custom section above or load the standard preset sections.
            </p>
            {!isReadOnly && (
              <button
                onClick={onApplyMyTemplate}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-200 text-slate-950 rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                <span>Load Standard Sections</span>
              </button>
            )}
          </div>
        ) : (
          project.sections.map((sec) => (
            <div
              key={sec.id}
              className="bg-[#0d1017] p-4 rounded-2xl border border-white/[0.07] hover:border-white/[0.12] transition space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                {editingHeadingId === sec.id && !isReadOnly ? (
                  <div className="flex items-center gap-1.5 flex-1 max-w-sm">
                    <input
                      type="text"
                      autoFocus
                      value={tempHeadingText}
                      onChange={(e) => setTempHeadingText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          saveEditingHeading(sec.id);
                        } else if (e.key === "Escape") {
                          cancelEditingHeading();
                        }
                      }}
                      className="w-full bg-[#07090e] border border-white/[0.22] px-2.5 py-1 rounded-lg text-xs sm:text-sm text-white font-semibold outline-none"
                      placeholder="Section heading..."
                    />
                    <button
                      type="button"
                      onClick={() => saveEditingHeading(sec.id)}
                      className="px-2.5 py-1 text-xs font-semibold bg-white text-slate-950 rounded-lg hover:bg-slate-200 transition cursor-pointer"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={cancelEditingHeading}
                      className="px-2 py-1 text-xs text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 shrink-0" />
                    <h3
                      onClick={() => {
                        if (!isReadOnly) startEditingHeading(sec.id, sec.heading);
                      }}
                      className={`font-semibold text-white text-sm transition ${
                        !isReadOnly ? "cursor-pointer hover:text-slate-300" : ""
                      }`}
                      title={!isReadOnly ? "Click to rename section" : sec.heading}
                    >
                      {sec.heading}
                    </h3>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => startEditingHeading(sec.id, sec.heading)}
                        title="Rename section"
                        className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-slate-200 px-1.5 py-0.5 rounded transition cursor-pointer text-[11px]"
                      >
                        Rename
                      </button>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1.5">
                  {sec.content && (
                    <button
                      type="button"
                      onClick={() => handleCopySection(sec.id, sec.content)}
                      className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] text-[11px] font-medium text-slate-300 hover:text-white transition cursor-pointer"
                    >
                      {copiedSectionId === sec.id ? "Copied" : "Copy"}
                    </button>
                  )}

                  {!isReadOnly && canDelete && (
                    <button
                      onClick={() => onRemoveSection(sec.id)}
                      title="Remove section"
                      className="px-2 py-1 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 text-xs transition rounded-lg cursor-pointer"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <textarea
                rows={4}
                readOnly={isReadOnly}
                disabled={isReadOnly}
                value={sec.content}
                onChange={(e) => onUpdateSectionContent(sec.id, e.target.value)}
                placeholder={isReadOnly ? "No content provided." : `Enter ${sec.heading} details...`}
                className={`w-full bg-[#07090e] border border-white/[0.07] p-3.5 rounded-xl font-mono text-xs sm:text-sm leading-relaxed text-slate-100 placeholder-slate-600 transition ${
                  isReadOnly
                    ? "cursor-default select-text focus:outline-none opacity-90"
                    : "outline-none focus:border-white/[0.22]"
                }`}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
