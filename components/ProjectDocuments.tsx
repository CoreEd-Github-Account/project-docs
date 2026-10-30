"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import type {
  Project,
  ProjectDocument,
  ProjectDocumentFolder,
  DocumentType,
  ProjectRole,
} from "@/lib/types";

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

  lines.forEach((line, idx) => {
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
      }
      return;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      return;
    }

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

    if (line.trim() === "---" || line.trim() === "***") {
      elements.push(<hr key={idx} className="my-4 border-slate-800" />);
      return;
    }

    if (!line.trim()) {
      elements.push(<div key={idx} className="h-2" />);
      return;
    }

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

function formatInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let keyIndex = 0;

  while (remaining.length > 0) {
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
  const [folders, setFolders] = useState<ProjectDocumentFolder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | DocumentType>("all");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");

  // Create Folder state
  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<ProjectDocumentFolder | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);

  // Write / Edit .txt File modal state
  const [showWriteTxtModal, setShowWriteTxtModal] = useState(false);
  const [editingTxtDoc, setEditingTxtDoc] = useState<ProjectDocument | null>(null);
  const [txtFileName, setTxtFileName] = useState("");
  const [txtContent, setTxtContent] = useState("");
  const [txtFolderId, setTxtFolderId] = useState<string>("");
  const [isSavingTxt, setIsSavingTxt] = useState(false);
  const [txtError, setTxtError] = useState("");

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

  // 1. Fetch documents and folders from PostgreSQL API
  const fetchDocuments = useCallback(
    async (isSilent = false) => {
      if (!project?.id) return;
      if (!isSilent) setIsLoading(true);
      setIsSyncing(true);

      try {
        const res = await fetch(`/api/projects/documents?projectId=${encodeURIComponent(project.id)}`);
        if (!res.ok) throw new Error("Failed to load documents");
        const data = await res.json();
        if (data.success) {
          if (Array.isArray(data.documents)) setDocuments(data.documents);
          if (Array.isArray(data.folders)) setFolders(data.folders);
        }
      } catch (err) {
        console.error("Error fetching documents:", err);
      } finally {
        setIsLoading(false);
        setIsSyncing(false);
      }
    },
    [project?.id]
  );

  useEffect(() => {
    setActiveFolderId(null);
    fetchDocuments(false);
  }, [fetchDocuments]);

  // Helper to get folder name by ID
  const folderMap = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [folders]);

  const activeFolder = useMemo(
    () => (activeFolderId ? folders.find((f) => f.id === activeFolderId) || null : null),
    [folders, activeFolderId]
  );

  // 2. Create New Folder
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newFolderName.trim();
    if (!clean || isCreatingFolder || isReadOnly) return;

    setIsCreatingFolder(true);
    setUploadError("");
    try {
      const res = await fetch("/api/projects/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_folder",
          projectId: project.id,
          name: clean,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to create folder");
      }
      if (data.folder) {
        setFolders((prev) => [...prev, data.folder]);
        setActiveFolderId(data.folder.id);
      }
      setNewFolderName("");
      setShowNewFolderInput(false);
    } catch (err: any) {
      setUploadError(err?.message || "Failed to create folder");
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // 3. Delete Folder
  const handleDeleteFolder = async () => {
    if (!folderToDelete || isDeletingFolder || !canDelete) return;
    setIsDeletingFolder(true);
    try {
      const res = await fetch(
        `/api/projects/documents?folderId=${encodeURIComponent(
          folderToDelete.id
        )}&projectId=${encodeURIComponent(project.id)}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to delete folder");
      }

      setFolders((prev) => prev.filter((f) => f.id !== folderToDelete.id));
      setDocuments((prev) =>
        prev.map((d) => (d.folderId === folderToDelete.id ? { ...d, folderId: null } : d))
      );
      if (activeFolderId === folderToDelete.id) {
        setActiveFolderId(null);
      }
      setFolderToDelete(null);
    } catch (err: any) {
      alert(err?.message || "Failed to delete folder");
    } finally {
      setIsDeletingFolder(false);
    }
  };

  // 4. Open Write / Edit .txt Modal
  const openCreateTxtModal = () => {
    setEditingTxtDoc(null);
    setTxtFileName("");
    setTxtContent("");
    setTxtFolderId(activeFolderId || "");
    setTxtError("");
    setShowWriteTxtModal(true);
  };

  const openEditTxtModal = (doc: ProjectDocument) => {
    setEditingTxtDoc(doc);
    setTxtFileName(doc.name);
    setTxtContent(doc.content || "");
    setTxtFolderId(doc.folderId || "");
    setTxtError("");
    setActiveDocument(null);
    setShowWriteTxtModal(true);
  };

  // 5. Save .txt File (Create or Update in DB)
  const handleSaveTxtFile = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = txtFileName.trim();
    if (!cleanName) {
      setTxtError("Please enter a file name.");
      return;
    }
    if (isSavingTxt || isReadOnly) return;

    setIsSavingTxt(true);
    setTxtError("");

    try {
      const finalName = cleanName.toLowerCase().endsWith(".txt") ? cleanName : `${cleanName}.txt`;

      if (editingTxtDoc) {
        // Update existing document in DB
        const res = await fetch("/api/projects/documents", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingTxtDoc.id,
            projectId: project.id,
            name: finalName,
            content: txtContent,
            folderId: txtFolderId || null,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to update .txt file");
        }
        if (data.document) {
          setDocuments((prev) =>
            prev.map((d) => (d.id === data.document.id ? data.document : d))
          );
        }
      } else {
        // Create new .txt document in DB
        const res = await fetch("/api/projects/documents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create_txt",
            projectId: project.id,
            name: finalName,
            content: txtContent,
            folderId: txtFolderId || null,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to save .txt file");
        }
        if (data.document) {
          setDocuments((prev) => [data.document, ...prev]);
        }
      }

      setShowWriteTxtModal(false);
      setEditingTxtDoc(null);
    } catch (err: any) {
      setTxtError(err?.message || "Failed to save .txt file");
    } finally {
      setIsSavingTxt(false);
    }
  };

  // 6. Move Document to Another Folder
  const handleMoveDocumentFolder = async (docId: string, targetFolderId: string | null) => {
    if (isReadOnly) return;
    try {
      const res = await fetch("/api/projects/documents", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: docId,
          projectId: project.id,
          folderId: targetFolderId || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success && data.document) {
        setDocuments((prev) => prev.map((d) => (d.id === docId ? data.document : d)));
        if (activeDocument?.id === docId) {
          setActiveDocument(data.document);
        }
      }
    } catch (err) {
      console.error("Failed to move document folder:", err);
    }
  };

  // 7. Handle File Upload (places into activeFolderId automatically)
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
        if (activeFolderId) {
          formData.append("folderId", activeFolderId);
        }

        const res = await fetch("/api/projects/documents", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || `Failed to upload ${file.name}`);
        }
      }
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

  // 8. Open Document View
  const openDocumentViewer = (doc: ProjectDocument) => {
    if (doc.fileType === "image") {
      setLightboxImage(doc);
      return;
    }
    setActiveDocument(doc);
  };

  // 9. Delete Document
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

  // 10. Copy Document Content
  const handleCopyContent = (doc: ProjectDocument) => {
    const textToCopy = doc.content || doc.fileUrl || "";
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedDocId(doc.id);
    setTimeout(() => setCopiedDocId(null), 2000);
  };

  // 11. Download Document
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

  // Documents scoped to current folder selection (if a folder is clicked, show ONLY files of that folder)
  const folderScopedDocuments = useMemo(() => {
    if (!activeFolderId) return documents;
    return documents.filter((doc) => doc.folderId === activeFolderId);
  }, [documents, activeFolderId]);

  // Filter & Search within current folder scope
  const filteredDocuments = useMemo(() => {
    return folderScopedDocuments.filter((doc) => {
      const matchesSearch =
        searchQuery === "" ||
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.content && doc.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.description && doc.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.fileExtension && doc.fileExtension.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = typeFilter === "all" || doc.fileType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [folderScopedDocuments, searchQuery, typeFilter]);

  // Folder document counts
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    folders.forEach((f) => {
      counts[f.id] = 0;
    });
    documents.forEach((d) => {
      if (d.folderId && counts[d.folderId] !== undefined) {
        counts[d.folderId] += 1;
      }
    });
    return counts;
  }, [folders, documents]);

  // Stats for current view
  const stats = useMemo(() => {
    const totalCount = folderScopedDocuments.length;
    const totalBytes = folderScopedDocuments.reduce((acc, d) => acc + (d.fileSize || 0), 0);
    const mdCount = folderScopedDocuments.filter((d) => d.fileType === "markdown").length;
    const textCount = folderScopedDocuments.filter((d) => d.fileType === "text").length;
    const imgCount = folderScopedDocuments.filter((d) => d.fileType === "image").length;
    const fileCount = folderScopedDocuments.filter((d) => d.fileType === "file").length;
    return { totalCount, totalBytes, mdCount, textCount, imgCount, fileCount };
  }, [folderScopedDocuments]);

  return (
    <div className="space-y-6 pb-12 animate-fade-in">
      {/* HEADER SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl relative overflow-hidden backdrop-blur-md">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 text-lg">
                {activeFolder ? "📂" : "📁"}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                    {activeFolder ? activeFolder.name : "Project Documents"}
                  </h2>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    {folderScopedDocuments.length}
                  </span>
                  {activeFolder && (
                    <button
                      type="button"
                      onClick={() => setActiveFolderId(null)}
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition cursor-pointer"
                    >
                      ← All Documents
                    </button>
                  )}
                </div>
                <p className="text-xs text-slate-400">
                  {activeFolder ? (
                    <>
                      Showing files inside folder{" "}
                      <span className="text-amber-300 font-semibold">{activeFolder.name}</span>
                    </>
                  ) : (
                    <>
                      Organize folders, write <code className="text-emerald-400">.txt</code> notes, and manage files for{" "}
                      <span className="text-slate-200 font-semibold">{project.name}</span>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Refresh Button */}
            <button
              type="button"
              onClick={() => fetchDocuments(false)}
              disabled={isSyncing || isLoading}
              title="Refresh documents and folders from database"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 hover:text-white border border-slate-700 text-xs sm:text-sm font-semibold transition shadow-sm cursor-pointer disabled:opacity-60"
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

            {/* New Folder Button */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={() => setShowNewFolderInput((prev) => !prev)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 active:scale-95 text-amber-300 border border-amber-500/30 text-xs sm:text-sm font-semibold transition cursor-pointer"
              >
                <span>📁</span>
                <span>+ New Folder</span>
              </button>
            )}

            {/* Write .txt File Button */}
            {!isReadOnly && (
              <button
                type="button"
                onClick={openCreateTxtModal}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 active:scale-95 text-emerald-300 border border-emerald-500/30 text-xs sm:text-sm font-semibold transition cursor-pointer"
              >
                <span>📝</span>
                <span>Write .txt File</span>
              </button>
            )}

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

        {/* CREATE NEW FOLDER INLINE BAR */}
        {showNewFolderInput && !isReadOnly && (
          <form
            onSubmit={handleCreateFolder}
            className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 animate-fade-in"
          >
            <div className="flex items-center gap-2 flex-1">
              <span className="text-lg">📁</span>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Enter folder name (e.g. Credentials, API Docs, Notes)..."
                autoFocus
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs sm:text-sm focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowNewFolderInput(false);
                  setNewFolderName("");
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isCreatingFolder || !newFolderName.trim()}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition disabled:opacity-50 cursor-pointer"
              >
                {isCreatingFolder ? "Creating..." : "Create Folder"}
              </button>
            </div>
          </form>
        )}

        {/* FOLDERS BAR / ORGANIZER */}
        {folders.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Folders ({folders.length}) — Click a folder to view its files
              </span>
              {activeFolderId && (
                <button
                  type="button"
                  onClick={() => setActiveFolderId(null)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold cursor-pointer"
                >
                  Show All Files ({documents.length})
                </button>
              )}
            </div>
            <div className="flex items-center gap-2.5 flex-wrap">
              {/* All Files pill */}
              <button
                type="button"
                onClick={() => setActiveFolderId(null)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer ${
                  activeFolderId === null
                    ? "bg-blue-600/20 border-blue-500 text-white shadow-sm"
                    : "bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white"
                }`}
              >
                <span>🗂️</span>
                <span>All Files</span>
                <span className="px-1.5 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300">
                  {documents.length}
                </span>
              </button>

              {/* Individual Folder Cards */}
              {folders.map((folder) => {
                const isSelected = activeFolderId === folder.id;
                const count = folderCounts[folder.id] || 0;
                return (
                  <div
                    key={folder.id}
                    onClick={() => setActiveFolderId(isSelected ? null : folder.id)}
                    className={`group flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition cursor-pointer select-none ${
                      isSelected
                        ? "bg-amber-500/20 border-amber-400 text-amber-200 shadow-md shadow-amber-500/10"
                        : "bg-slate-950/70 border-slate-800 text-slate-200 hover:border-amber-500/40 hover:bg-slate-900"
                    }`}
                  >
                    <span className="text-base">{isSelected ? "📂" : "📁"}</span>
                    <span className="truncate max-w-[160px]">{folder.name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                        isSelected
                          ? "bg-amber-400/20 text-amber-200"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {count}
                    </span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFolderToDelete(folder);
                        }}
                        title="Delete Folder"
                        className="opacity-60 group-hover:opacity-100 hover:text-rose-400 ml-0.5 transition cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
              <span className="text-blue-400">📥 Drag & drop</span> files here
              {activeFolder ? (
                <>
                  to upload into <span className="text-amber-300 font-semibold">📂 {activeFolder.name}</span>
                </>
              ) : null}
              ,{" "}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                browse files
              </button>
              , or{" "}
              <button
                type="button"
                onClick={openCreateTxtModal}
                className="text-emerald-400 hover:underline font-semibold cursor-pointer"
              >
                write a .txt file
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
              <span>📄 Text (.txt)</span>
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
                placeholder={activeFolder ? `Search in ${activeFolder.name}...` : "Search documents..."}
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
          <p className="text-sm font-semibold">Loading documents from database...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-2xl mx-auto">
            {activeFolder ? "📂" : "📄"}
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white">
              {activeFolder ? `No files in "${activeFolder.name}" yet` : "No documents found"}
            </h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {searchQuery || typeFilter !== "all"
                ? "No documents match your current filter or search criteria. Try clearing filters."
                : activeFolder
                ? `Upload a file or write a .txt note directly inside "${activeFolder.name}".`
                : "Create folders to organize your work, write .txt notes, or upload project files here."}
            </p>
          </div>
          {!isReadOnly && (
            <div className="flex items-center justify-center gap-3 pt-2 flex-wrap">
              <button
                onClick={openCreateTxtModal}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-600/25 transition cursor-pointer"
              >
                📝 Write .txt File
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition cursor-pointer"
              >
                ⬆️ Upload File
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
                  <th className="py-3.5 px-4">Folder</th>
                  <th className="py-3.5 px-4">Type</th>
                  <th className="py-3.5 px-4">Size</th>
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

                      {/* Folder Selector / Badge */}
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        {!isReadOnly && folders.length > 0 ? (
                          <select
                            value={doc.folderId || ""}
                            onChange={(e) => handleMoveDocumentFolder(doc.id, e.target.value || null)}
                            className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 focus:outline-none focus:border-amber-500 cursor-pointer"
                          >
                            <option value="">🗂️ No Folder</option>
                            {folders.map((f) => (
                              <option key={f.id} value={f.id}>
                                📁 {f.name}
                              </option>
                            ))}
                          </select>
                        ) : doc.folderId && folderMap.get(doc.folderId) ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs">
                            📁 {folderMap.get(doc.folderId)}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
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

                          {/* Edit .txt / text file */}
                          {!isReadOnly && (doc.fileType === "text" || doc.fileType === "markdown") && (
                            <button
                              type="button"
                              onClick={() => openEditTxtModal(doc)}
                              title="Edit Text File"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition cursor-pointer"
                            >
                              ✏️
                            </button>
                          )}

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
                      <div className="flex items-center gap-1.5">
                        {doc.folderId && folderMap.get(doc.folderId) && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            📁 {folderMap.get(doc.folderId)}
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                          {doc.fileType}
                        </span>
                      </div>
                    </div>
                  )}

                  <h3 className="font-bold text-white group-hover:text-blue-400 transition truncate text-sm">
                    {doc.name}
                  </h3>
                  {doc.description && (
                    <p className="text-xs text-slate-400 line-clamp-2 mt-1">{doc.description}</p>
                  )}

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
                    {!isReadOnly && (doc.fileType === "text" || doc.fileType === "markdown") && (
                      <button
                        onClick={() => openEditTxtModal(doc)}
                        title="Edit .txt"
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-amber-300"
                      >
                        ✏️
                      </button>
                    )}
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

      {/* MODAL: WRITE / EDIT .TXT FILE */}
      {showWriteTxtModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📝</span>
                <div>
                  <h3 className="font-bold text-white text-base sm:text-lg">
                    {editingTxtDoc ? `Edit ${editingTxtDoc.name}` : "Write .txt File"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Type or copy-paste text below and keep it saved in your folder & database
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWriteTxtModal(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTxtFile} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {txtError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-xs">
                  ⚠ {txtError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    File Name (.txt)
                  </label>
                  <input
                    type="text"
                    value={txtFileName}
                    onChange={(e) => setTxtFileName(e.target.value)}
                    placeholder="e.g. server-notes.txt"
                    required
                    autoFocus
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                    Folder
                  </label>
                  <select
                    value={txtFolderId}
                    onChange={(e) => setTxtFolderId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <option value="">🗂️ No Folder (Root)</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        📁 {folder.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                    Text Content (Copy-Paste or Write)
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {txtContent.length} chars
                  </span>
                </div>
                <textarea
                  value={txtContent}
                  onChange={(e) => setTxtContent(e.target.value)}
                  rows={14}
                  placeholder="Paste or write your text content here..."
                  className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono text-xs sm:text-sm leading-relaxed focus:outline-none focus:border-emerald-500 resize-y"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowWriteTxtModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs sm:text-sm font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTxt}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs sm:text-sm font-bold shadow-lg shadow-emerald-600/25 transition disabled:opacity-50 cursor-pointer"
                >
                  {isSavingTxt ? "Saving..." : editingTxtDoc ? "Update .txt File" : "Save .txt File"}
                </button>
              </div>
            </form>
          </div>
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
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-white text-base sm:text-lg truncate">
                      {activeDocument.name}
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 shrink-0">
                      {activeDocument.fileType}
                    </span>
                    {activeDocument.folderId && folderMap.get(activeDocument.folderId) && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                        📁 {folderMap.get(activeDocument.folderId)}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {formatBytes(activeDocument.fileSize)} • Updated{" "}
                    {new Date(activeDocument.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Actions & Close */}
              <div className="flex items-center gap-2">
                {!isReadOnly &&
                  (activeDocument.fileType === "text" || activeDocument.fileType === "markdown") && (
                    <button
                      onClick={() => openEditTxtModal(activeDocument)}
                      title="Edit Text Content"
                      className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-semibold transition cursor-pointer"
                    >
                      ✏️ Edit
                    </button>
                  )}
                <button
                  onClick={() => handleDownload(activeDocument)}
                  title="Download File"
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                >
                  ⬇️
                </button>
                <button
                  onClick={() => setActiveDocument(null)}
                  className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
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
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <span>📋</span>
                  <span>{copiedDocId === activeDocument.id ? "Copied!" : "Copy Content"}</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveDocument(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LIGHTBOX FOR IMAGES */}
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

      {/* MODAL: DELETE DOCUMENT CONFIRMATION */}
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

      {/* MODAL: DELETE FOLDER CONFIRMATION */}
      {folderToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center text-xl mx-auto">
              📁
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-white">Delete Folder?</h3>
              <p className="text-xs text-slate-400">
                Delete folder <span className="text-white font-semibold">&quot;{folderToDelete.name}&quot;</span>? Any files inside will be kept and moved back to All Files.
              </p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFolderToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingFolder}
                onClick={handleDeleteFolder}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 active:scale-95 text-white text-xs font-bold shadow-md shadow-rose-600/30 transition disabled:opacity-50 cursor-pointer"
              >
                {isDeletingFolder ? "Deleting..." : "Delete Folder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
