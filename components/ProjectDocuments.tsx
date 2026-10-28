"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type { Project, ProjectDocument, DocumentType, ProjectRole } from "@/lib/types";

interface ProjectDocumentsProps {
  project: Project;
  userPermission?: ProjectRole;
}

// Simple safe markdown renderer
function renderSimpleMarkdown(md: string): React.ReactNode {
  if (!md) return <span className="text-slate-500 italic">No content</span>;

  const lines = md.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBuffer: string[] = [];
  let codeLang = "";

  lines.forEach((line, idx) => {
    // Code blocks
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={`code-${idx}`}
            className="my-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono overflow-x-auto selection:bg-blue-600/40"
          >
            <code>{codeBuffer.join("\n")}</code>
          </pre>
        );
        codeBuffer = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeLang = line.trim().replace(/^```/, "");
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

    // Headings
    if (line.startsWith("# ")) {
      elements.push(
        <h1 key={idx} className="text-xl sm:text-2xl font-black text-white mt-4 mb-2 pb-1 border-b border-slate-800">
          {line.replace(/^#\s+/, "")}
        </h1>
      );
      return;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2 key={idx} className="text-lg sm:text-xl font-bold text-slate-100 mt-3 mb-1.5 pb-1 border-b border-slate-800/60">
          {line.replace(/^##\s+/, "")}
        </h2>
      );
      return;
    }
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={idx} className="text-base font-semibold text-blue-400 mt-2.5 mb-1">
          {line.replace(/^###\s+/, "")}
        </h3>
      );
      return;
    }
    if (line.startsWith("#### ")) {
      elements.push(
        <h4 key={idx} className="text-sm font-semibold text-slate-300 mt-2 mb-1">
          {line.replace(/^####\s+/, "")}
        </h4>
      );
      return;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={idx}
          className="my-2 pl-3.5 py-1 border-l-4 border-blue-500 bg-blue-500/10 text-slate-300 text-xs sm:text-sm rounded-r-lg italic"
        >
          {line.replace(/^>\s+/, "")}
        </blockquote>
      );
      return;
    }

    // Lists
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const itemText = line.trim().replace(/^[-*]\s+/, "");
      elements.push(
        <li key={idx} className="ml-4 list-disc text-slate-300 text-xs sm:text-sm my-0.5 leading-relaxed">
          {formatInlineMarkdown(itemText)}
        </li>
      );
      return;
    }
    if (/^\d+\.\s+/.test(line.trim())) {
      const itemText = line.trim().replace(/^\d+\.\s+/, "");
      elements.push(
        <li key={idx} className="ml-4 list-decimal text-slate-300 text-xs sm:text-sm my-0.5 leading-relaxed">
          {formatInlineMarkdown(itemText)}
        </li>
      );
      return;
    }

    // Horizontal Rule
    if (line.trim() === "---" || line.trim() === "***") {
      elements.push(<hr key={idx} className="my-4 border-slate-800" />);
      return;
    }

    // Empty line
    if (!line.trim()) {
      elements.push(<div key={idx} className="h-2" />);
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={idx} className="text-slate-300 text-xs sm:text-sm leading-relaxed my-1">
        {formatInlineMarkdown(line)}
      </p>
    );
  });

  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <pre
        key="code-remaining"
        className="my-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs font-mono overflow-x-auto"
      >
        <code>{codeBuffer.join("\n")}</code>
      </pre>
    );
  }

  return <div className="space-y-0.5">{elements}</div>;
}

// Inline formatting (bold, code, italic, links)
function formatInlineMarkdown(text: string): React.ReactNode {
  // Regex tokenization for bold, inline code, and links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
    // Bold **text**
    const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/);
    if (boldMatch) {
      parts.push(
        <strong key={keyIndex++} className="font-bold text-white">
          {boldMatch[2]}
        </strong>
      );
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }

    // Inline code `code`
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      parts.push(
        <code
          key={keyIndex++}
          className="px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 font-mono text-[11px] sm:text-xs border border-slate-700/60"
        >
          {codeMatch[1]}
        </code>
      );
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }

    // Links [label](url)
    const linkMatch = remaining.match(/^\[(.*?)\]\((.*?)\)/);
    if (linkMatch) {
      parts.push(
        <a
          key={keyIndex++}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 underline hover:text-blue-300"
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch[0].length);
      continue;
    }

    // Plain text slice until next special token
    const nextSpecial = remaining.search(/(\*\*|__|`|\[)/);
    if (nextSpecial === -1) {
      parts.push(remaining);
      break;
    } else if (nextSpecial > 0) {
      parts.push(remaining.slice(0, nextSpecial));
      remaining = remaining.slice(nextSpecial);
    } else {
      parts.push(remaining[0]);
      remaining = remaining.slice(1);
    }
  }

  return parts;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function ProjectDocuments({ project, userPermission }: ProjectDocumentsProps) {
  const isOwner = userPermission === "owner" || project.isOwner;
  const isReadOnly = !isOwner && userPermission === "read";
  const canDelete = isOwner || userPermission === "full";

  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<"synced" | "syncing" | "error">("synced");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | DocumentType>("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // View Document modal
  const [activeDocument, setActiveDocument] = useState<ProjectDocument | null>(null);
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);

  // Delete confirmation modal
  const [docToDelete, setDocToDelete] = useState<ProjectDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Lightbox for image
  const [lightboxImage, setLightboxImage] = useState<ProjectDocument | null>(null);

  // 1. Fetch documents from Supabase PG API
  const fetchDocuments = useCallback(
    async (isSilent = false) => {
      if (!project?.id) return;
      if (!isSilent) setIsLoading(true);
      setIsSyncing(true);

      try {
        const res = await fetch(`/api/projects/documents?projectId=${encodeURIComponent(project.id)}`);
        if (!res.ok) throw new Error("Failed to load documents");
        const data = await res.json();
        if (data.success && Array.isArray(data.documents)) {
          setDocuments(data.documents);
          setSyncStatus("synced");
        } else {
          setSyncStatus("error");
        }
      } catch (err) {
        console.error("Error fetching documents:", err);
        setSyncStatus("error");
      } finally {
        setIsLoading(false);
        setIsSyncing(false);
      }
    },
    [project?.id]
  );

  // Automatically refresh documents when page opens or project changes
  useEffect(() => {
    fetchDocuments(false);
  }, [fetchDocuments]);

  // 2. Handle File Upload (multiple files supported)
  const handleUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0 || isReadOnly) return;
    setIsUploading(true);
    setUploadError("");

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("projectId", project.id);

        const res = await fetch("/api/projects/documents", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || `Failed to upload ${file.name}`);
        }
      }
      // Refresh list
      await fetchDocuments(true);
    } catch (err: any) {
      console.error("Upload error:", err);
      setUploadError(err?.message || "Failed to upload document");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // 3. Open Document View
  const openDocumentViewer = (doc: ProjectDocument) => {
    if (doc.fileType === "image") {
      setLightboxImage(doc);
      return;
    }
    setActiveDocument(doc);
  };

  // 7. Delete Document
  const handleDeleteDocument = async () => {
    if (!docToDelete || isDeleting || isReadOnly) return;
    setIsDeleting(true);

    try {
      const res = await fetch(
        `/api/projects/documents?id=${encodeURIComponent(docToDelete.id)}&projectId=${encodeURIComponent(
          project.id
        )}`,
        { method: "DELETE" }
      );

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete document");
      }

      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      if (activeDocument?.id === docToDelete.id) {
        setActiveDocument(null);
      }
      setDocToDelete(null);
    } catch (err: any) {
      alert(err?.message || "Failed to delete document");
    } finally {
      setIsDeleting(false);
    }
  };

  // 8. Copy Document Content
  const handleCopyContent = (doc: ProjectDocument) => {
    const textToCopy = doc.content || doc.fileUrl || "";
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedDocId(doc.id);
    setTimeout(() => setCopiedDocId(null), 2000);
  };

  // 9. Download Document
  const handleDownload = (doc: ProjectDocument) => {
    if (doc.fileUrl) {
      const a = document.createElement("a");
      a.href = doc.fileUrl;
      a.download = doc.name;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }

    if (doc.content !== undefined) {
      const blob = new Blob([doc.content], {
        type: doc.mimeType || "text/plain;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Filter & Search
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchesSearch =
        searchQuery === "" ||
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.description && doc.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.fileExtension && doc.fileExtension.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = typeFilter === "all" || doc.fileType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [documents, searchQuery, typeFilter]);

  // Stats
  const stats = useMemo(() => {
    const totalCount = documents.length;
    const totalBytes = documents.reduce((acc, d) => acc + (d.fileSize || 0), 0);
    const mdCount = documents.filter((d) => d.fileType === "markdown").length;
    const textCount = documents.filter((d) => d.fileType === "text").length;
    const imgCount = documents.filter((d) => d.fileType === "image").length;
    const fileCount = documents.filter((d) => d.fileType === "file").length;
    return { totalCount, totalBytes, mdCount, textCount, imgCount, fileCount };
  }, [documents]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* HEADER SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 text-lg">
                📁
              </div>
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    Project Documents
                  </h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {documents.length}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  Manage files, markdown specs, and images dedicated to{" "}
                  <span className="text-slate-200 font-semibold">{project.name}</span>
                </p>
              </div>
            </div>
          </div>

          {/* ACTIONS & LIVE SYNC STATUS */}
          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchDocuments(false)}
              disabled={isSyncing || isLoading}
              title="Refresh documents from Supabase PG database"
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white border border-slate-700 text-xs sm:text-sm font-semibold transition shadow-sm cursor-pointer disabled:opacity-60"
            >
              <svg
                className={`w-3.5 h-3.5 text-emerald-400 transition-transform ${
                  isSyncing || isLoading ? "animate-spin text-blue-400" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span>{isSyncing || isLoading ? "Refreshing..." : "Refresh"}</span>
            </button>

            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.txt,.md,.markdown,.json,.csv,.js,.ts,.tsx,.css,.html,.pdf,.doc,.docx"
              onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
              className="hidden"
            />

            {/* Upload Button */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-95 text-white text-xs sm:text-sm font-semibold transition shadow-md shadow-blue-600/30 cursor-pointer disabled:opacity-60"
              >
                {isUploading ? (
                  <>
                    <span className="animate-spin text-white">⟳</span>
                    <span>Uploading...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                      />
                    </svg>
                    <span>Upload File</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* DRAG & DROP DROPZONE BAR */}
        {!isReadOnly && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              setIsDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files) {
                handleUploadFiles(e.dataTransfer.files);
              }
            }}
            className={`mt-4 border-2 border-dashed rounded-xl p-3 sm:p-4 text-center transition-all ${
              isDragging
                ? "border-blue-500 bg-blue-500/10 scale-[1.01]"
                : "border-slate-800 hover:border-slate-700 bg-slate-950/40"
            }`}
          >
            <p className="text-xs text-slate-400 flex items-center justify-center gap-2 flex-wrap">
              <span className="text-blue-400">📥 Drag & drop</span> images, markdown specs, or text notes here, or{" "}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-400 hover:underline font-semibold"
              >
                browse files
              </button>
            </p>
          </div>
        )}

        {/* UPLOAD ERROR NOTICE */}
        {uploadError && (
          <div className="mt-3 p-3 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
            <span>⚠ {uploadError}</span>
            <button onClick={() => setUploadError("")} className="text-rose-400 hover:text-white">
              ✕
            </button>
          </div>
        )}

        {/* METRICS & QUICK FILTER BAR */}
        <div className="mt-5 pt-4 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-slate-400">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => setTypeFilter("all")}
              className={`px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                typeFilter === "all"
                  ? "bg-blue-600 text-white font-bold shadow-sm"
                  : "bg-slate-800/80 hover:bg-slate-800 text-slate-300"
              }`}
            >
              All ({stats.totalCount})
            </button>
            <button
              onClick={() => setTypeFilter("markdown")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                typeFilter === "markdown"
                  ? "bg-indigo-600 text-white font-bold shadow-sm"
                  : "bg-slate-800/80 hover:bg-slate-800 text-slate-300"
              }`}
            >
              <span>📝 Markdown</span>
              <span className="text-[10px] opacity-80">({stats.mdCount})</span>
            </button>
            <button
              onClick={() => setTypeFilter("text")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                typeFilter === "text"
                  ? "bg-emerald-600 text-white font-bold shadow-sm"
                  : "bg-slate-800/80 hover:bg-slate-800 text-slate-300"
              }`}
            >
              <span>📄 Text</span>
              <span className="text-[10px] opacity-80">({stats.textCount})</span>
            </button>
            <button
              onClick={() => setTypeFilter("image")}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                typeFilter === "image"
                  ? "bg-purple-600 text-white font-bold shadow-sm"
                  : "bg-slate-800/80 hover:bg-slate-800 text-slate-300"
              }`}
            >
              <span>🖼️ Images</span>
              <span className="text-[10px] opacity-80">({stats.imgCount})</span>
            </button>
            {stats.fileCount > 0 && (
              <button
                onClick={() => setTypeFilter("file")}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg font-medium transition cursor-pointer ${
                  typeFilter === "file"
                    ? "bg-amber-600 text-white font-bold shadow-sm"
                    : "bg-slate-800/80 hover:bg-slate-800 text-slate-300"
                }`}
              >
                <span>📦 Files</span>
                <span className="text-[10px] opacity-80">({stats.fileCount})</span>
              </button>
            )}
          </div>

          {/* Search & View Mode Switcher */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-56">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 text-xs focus:outline-none focus:border-blue-500"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500">🔍</span>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
              <button
                onClick={() => setViewMode("table")}
                title="Table View"
                className={`p-1.5 rounded-lg transition ${
                  viewMode === "table" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M3 14h18M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1z"
                  />
                </svg>
              </button>
              <button
                onClick={() => setViewMode("grid")}
                title="Grid Cards View"
                className={`p-1.5 rounded-lg transition ${
                  viewMode === "grid" ? "bg-blue-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENT LISTING: TABLE VIEW OR GRID VIEW */}
      {isLoading ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-3">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-semibold">Loading documents from Supabase...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-2xl mx-auto">
            📄
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">No documents found</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {searchQuery || typeFilter !== "all"
                ? "No documents match your current filter or search criteria. Try clearing filters."
                : "Keep track of project requirement specs, markdown notes, code snippets, and design images here."}
            </p>
          </div>
          {!isReadOnly && (
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition cursor-pointer"
              >
                Upload File
              </button>
            </div>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* TABLE VIEW */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-4 sm:px-6">Document Name</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Size</th>
                  <th className="py-3.5 px-4">Added By</th>
                  <th className="py-3.5 px-4">Updated</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-xs sm:text-sm">
                {filteredDocuments.map((doc) => {
                  const isImage = doc.fileType === "image";
                  const isMd = doc.fileType === "markdown";
                  const isTxt = doc.fileType === "text";

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-slate-800/40 transition group cursor-pointer"
                      onClick={() => openDocumentViewer(doc)}
                    >
                      {/* Name & Icon */}
                      <td className="py-3.5 px-4 sm:px-6">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                              isMd
                                ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30"
                                : isTxt
                                ? "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                                : isImage
                                ? "bg-purple-600/20 text-purple-400 border-purple-500/30 overflow-hidden"
                                : "bg-amber-600/20 text-amber-400 border-amber-500/30"
                            }`}
                          >
                            {isImage && doc.fileUrl ? (
                              <img
                                src={doc.fileUrl}
                                alt={doc.name}
                                className="w-full h-full object-cover"
                              />
                            ) : isMd ? (
                              <span className="font-bold text-xs">MD</span>
                            ) : isTxt ? (
                              <span className="font-bold text-xs">TXT</span>
                            ) : isImage ? (
                              <span>🖼️</span>
                            ) : (
                              <span>📁</span>
                            )}
                          </div>
                          <div className="min-w-0 max-w-xs sm:max-w-md">
                            <p className="font-semibold text-white group-hover:text-blue-400 transition truncate">
                              {doc.name}
                            </p>
                            {doc.description && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                {doc.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                            isMd
                              ? "bg-indigo-500/10 text-indigo-300 border-indigo-500/30"
                              : isTxt
                              ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                              : isImage
                              ? "bg-purple-500/10 text-purple-300 border-purple-500/30"
                              : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                          }`}
                        >
                          {doc.fileType}
                        </span>
                      </td>

                      {/* File Size */}
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-xs">
                        {formatBytes(doc.fileSize)}
                      </td>

                      {/* Uploader */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300">
                            {(doc.uploaderFullName || doc.uploaderName || "U").charAt(0).toUpperCase()}
                          </div>
                          <span className="text-xs text-slate-300 truncate max-w-[120px]">
                            {doc.uploaderFullName || doc.uploaderName || "Member"}
                          </span>
                        </div>
                      </td>

                      {/* Updated Date */}
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      {/* Action Buttons */}
                      <td
                        className="py-3.5 px-4 sm:px-6 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {/* View */}
                          <button
                            type="button"
                            onClick={() => openDocumentViewer(doc)}
                            title="View Document"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                          >
                            👁️
                          </button>

                          {/* Copy */}
                          {(doc.content || doc.fileUrl) && (
                            <button
                              type="button"
                              onClick={() => handleCopyContent(doc)}
                              title={copiedDocId === doc.id ? "Copied!" : "Copy Content / Link"}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-800 transition cursor-pointer"
                            >
                              {copiedDocId === doc.id ? "✓" : "📋"}
                            </button>
                          )}

                          {/* Download */}
                          <button
                            type="button"
                            onClick={() => handleDownload(doc)}
                            title="Download Document"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 transition cursor-pointer"
                          >
                            ⬇️
                          </button>

                          {/* Delete */}
                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDocToDelete(doc)}
                              title="Delete Document"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition cursor-pointer"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* GRID CARDS VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredDocuments.map((doc) => {
            const isImage = doc.fileType === "image";
            const isMd = doc.fileType === "markdown";

            return (
              <div
                key={doc.id}
                onClick={() => openDocumentViewer(doc)}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg hover:border-slate-700 transition flex flex-col justify-between group cursor-pointer relative overflow-hidden"
              >
                <div>
                  {/* Thumbnail / Header */}
                  {isImage && doc.fileUrl ? (
                    <div className="w-full h-36 rounded-xl bg-slate-950 overflow-hidden mb-3 border border-slate-800">
                      <img
                        src={doc.fileUrl}
                        alt={doc.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm border ${
                          isMd
                            ? "bg-indigo-600/20 text-indigo-400 border-indigo-500/30"
                            : "bg-emerald-600/20 text-emerald-400 border-emerald-500/30"
                        }`}
                      >
                        {isMd ? "MD" : "TXT"}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                        {doc.fileType}
                      </span>
                    </div>
                  )}

                  <h3 className="font-bold text-white group-hover:text-blue-400 transition truncate text-sm">
                    {doc.name}
                  </h3>
                  {doc.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">{doc.description}</p>
                  )}

                  {/* Snippet preview for markdown/text */}
                  {!isImage && doc.content && (
                    <div className="mt-2.5 p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 text-[11px] text-slate-400 font-mono line-clamp-3">
                      {doc.content.slice(0, 140)}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div
                  className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="font-mono">{formatBytes(doc.fileSize)}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleCopyContent(doc)}
                      title="Copy"
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                    >
                      📋
                    </button>
                    <button
                      onClick={() => handleDownload(doc)}
                      title="Download"
                      className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                    >
                      ⬇️
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setDocToDelete(doc)}
                        title="Delete"
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: DOCUMENT VIEWER */}
      {activeDocument && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-950/70">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xl">
                  {activeDocument.fileType === "markdown"
                    ? "📝"
                    : activeDocument.fileType === "text"
                    ? "📄"
                    : "📁"}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-white text-base sm:text-lg truncate">
                      {activeDocument.name}
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                      {activeDocument.fileType}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {formatBytes(activeDocument.fileSize)} • Updated{" "}
                    {new Date(activeDocument.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Actions & Close */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(activeDocument)}
                  title="Download File"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                >
                  ⬇️
                </button>
                <button
                  onClick={() => setActiveDocument(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div className="bg-slate-950 rounded-xl border border-slate-800/80 p-4 sm:p-6 min-h-[300px]">
                {activeDocument.fileType === "markdown" ? (
                  renderSimpleMarkdown(activeDocument.content || "")
                ) : activeDocument.fileType === "text" ? (
                  <pre className="text-slate-200 font-mono text-xs sm:text-sm whitespace-pre-wrap leading-relaxed selection:bg-blue-600/40">
                    {activeDocument.content || "No content"}
                  </pre>
                ) : (
                  <div className="text-center py-8 text-slate-400">
                    <p>Binary or non-text document.</p>
                    {activeDocument.fileUrl && (
                      <a
                        href={activeDocument.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                      >
                        Open in New Tab
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleCopyContent(activeDocument)}
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5"
                >
                  <span>📋</span>
                  <span>{copiedDocId === activeDocument.id ? "Copied!" : "Copy Content"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveDocument(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: LIGHTBOX FOR IMAGES */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="p-3 sm:p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2">
                <span className="text-base">🖼️</span>
                <span className="font-bold text-white text-sm truncate">{lightboxImage.name}</span>
                <span className="text-xs text-slate-400">({formatBytes(lightboxImage.fileSize)})</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(lightboxImage)}
                  className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                >
                  Download
                </button>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-4 flex items-center justify-center overflow-auto max-h-[75vh]">
              {lightboxImage.fileUrl && (
                <img
                  src={lightboxImage.fileUrl}
                  alt={lightboxImage.name}
                  className="max-h-[70vh] w-auto object-contain rounded-lg shadow-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: DELETE CONFIRMATION */}
      {docToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-xl mx-auto">
              🗑️
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Delete Document?</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to permanently delete{" "}
                <span className="text-white font-semibold">&quot;{docToDelete.name}&quot;</span>? This action
                cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteDocument}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
