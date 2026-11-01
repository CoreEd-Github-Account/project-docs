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
            className="my-3 p-3.5 rounded-xl bg-[#07090e] border border-white/[0.08] text-slate-200 text-xs font-mono overflow-x-auto"
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
        <h1
          key={idx}
          className="text-lg sm:text-xl font-bold text-white mt-4 mb-2 pb-1 border-b border-white/[0.08]"
        >
          {line.replace(/^#\s+/, "")}
        </h1>
      );
      return;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h2
          key={idx}
          className="text-base sm:text-lg font-semibold text-slate-100 mt-3 mb-1.5"
        >
          {line.replace(/^##\s+/, "")}
        </h2>
      );
      return;
    }
    if (line.startsWith("### ")) {
      elements.push(
        <h3
          key={idx}
          className="text-sm font-semibold text-slate-200 mt-2.5 mb-1"
        >
          {line.replace(/^###\s+/, "")}
        </h3>
      );
      return;
    }

    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={idx}
          className="my-2 pl-3.5 py-1 border-l-2 border-white/30 bg-white/[0.03] text-slate-300 text-xs sm:text-sm rounded-r-lg italic"
        >
          {line.replace(/^>\s+/, "")}
        </blockquote>
      );
      return;
    }

    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      const itemText = line.trim().replace(/^[-*]\s+/, "");
      elements.push(
        <li
          key={idx}
          className="ml-4 list-disc text-slate-300 text-xs sm:text-sm my-0.5 leading-relaxed"
        >
          {formatInlineMarkdown(itemText)}
        </li>
      );
      return;
    }

    if (/^\d+\.\s+/.test(line.trim())) {
      const itemText = line.trim().replace(/^\d+\.\s+/, "");
      elements.push(
        <li
          key={idx}
          className="ml-4 list-decimal text-slate-300 text-xs sm:text-sm my-0.5 leading-relaxed"
        >
          {formatInlineMarkdown(itemText)}
        </li>
      );
      return;
    }

    if (line.trim() === "---" || line.trim() === "***") {
      elements.push(<hr key={idx} className="my-4 border-white/[0.08]" />);
      return;
    }

    if (!line.trim()) {
      elements.push(<div key={idx} className="h-2" />);
      return;
    }

    elements.push(
      <p
        key={idx}
        className="text-slate-300 text-xs sm:text-sm leading-relaxed my-1"
      >
        {formatInlineMarkdown(line)}
      </p>
    );
  });

  if (inCodeBlock && codeBuffer.length > 0) {
    elements.push(
      <pre
        key="code-remaining"
        className="my-3 p-3.5 rounded-xl bg-[#07090e] border border-white/[0.08] text-slate-200 text-xs font-mono overflow-x-auto"
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
        <strong key={keyIndex++} className="font-semibold text-white">
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
          className="px-1.5 py-0.5 rounded bg-white/[0.07] text-slate-200 font-mono text-[11px] border border-white/[0.08]"
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
          className="text-white underline hover:text-slate-300"
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

export function ProjectDocuments({
  project,
  userPermission,
}: ProjectDocumentsProps) {
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

  const [showNewFolderInput, setShowNewFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [folderToDelete, setFolderToDelete] =
    useState<ProjectDocumentFolder | null>(null);
  const [isDeletingFolder, setIsDeletingFolder] = useState(false);

  const [showWriteTxtModal, setShowWriteTxtModal] = useState(false);
  const [editingTxtDoc, setEditingTxtDoc] = useState<ProjectDocument | null>(
    null
  );
  const [txtFileName, setTxtFileName] = useState("");
  const [txtContent, setTxtContent] = useState("");
  const [txtFolderId, setTxtFolderId] = useState<string>("");
  const [isSavingTxt, setIsSavingTxt] = useState(false);
  const [txtError, setTxtError] = useState("");

  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [activeDocument, setActiveDocument] =
    useState<ProjectDocument | null>(null);
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);

  const [docToDelete, setDocToDelete] = useState<ProjectDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [lightboxImage, setLightboxImage] =
    useState<ProjectDocument | null>(null);

  const fetchDocuments = useCallback(
    async (isSilent = false) => {
      if (!project?.id) return;
      if (!isSilent) setIsLoading(true);
      setIsSyncing(true);

      try {
        const res = await fetch(
          `/api/projects/documents?projectId=${encodeURIComponent(project.id)}`
        );
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

  const folderMap = useMemo(() => {
    const map = new Map<string, string>();
    folders.forEach((f) => map.set(f.id, f.name));
    return map;
  }, [folders]);

  const activeFolder = useMemo(
    () =>
      activeFolderId
        ? folders.find((f) => f.id === activeFolderId) || null
        : null,
    [folders, activeFolderId]
  );

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
        prev.map((d) =>
          d.folderId === folderToDelete.id ? { ...d, folderId: null } : d
        )
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
      const finalName = cleanName.toLowerCase().endsWith(".txt")
        ? cleanName
        : `${cleanName}.txt`;

      if (editingTxtDoc) {
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

  const handleMoveDocumentFolder = async (
    docId: string,
    targetFolderId: string | null
  ) => {
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
        setDocuments((prev) =>
          prev.map((d) => (d.id === docId ? data.document : d))
        );
        if (activeDocument?.id === docId) {
          setActiveDocument(data.document);
        }
      }
    } catch (err) {
      console.error("Failed to move document folder:", err);
    }
  };

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

  const openDocumentViewer = (doc: ProjectDocument) => {
    if (doc.fileType === "image") {
      setLightboxImage(doc);
      return;
    }
    setActiveDocument(doc);
  };

  const handleDeleteDocument = async () => {
    if (!docToDelete || isDeleting || isReadOnly) return;
    setIsDeleting(true);

    try {
      const res = await fetch(
        `/api/projects/documents?id=${encodeURIComponent(
          docToDelete.id
        )}&projectId=${encodeURIComponent(project.id)}`,
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

  const handleCopyContent = (doc: ProjectDocument) => {
    const textToCopy = doc.content || doc.fileUrl || "";
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    setCopiedDocId(doc.id);
    setTimeout(() => setCopiedDocId(null), 1800);
  };

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

  const folderScopedDocuments = useMemo(() => {
    if (!activeFolderId) return documents;
    return documents.filter((doc) => doc.folderId === activeFolderId);
  }, [documents, activeFolderId]);

  const filteredDocuments = useMemo(() => {
    return folderScopedDocuments.filter((doc) => {
      const matchesSearch =
        searchQuery === "" ||
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (doc.content &&
          doc.content.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.description &&
          doc.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (doc.fileExtension &&
          doc.fileExtension.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesType = typeFilter === "all" || doc.fileType === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [folderScopedDocuments, searchQuery, typeFilter]);

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

  const stats = useMemo(() => {
    const totalCount = folderScopedDocuments.length;
    const mdCount = folderScopedDocuments.filter(
      (d) => d.fileType === "markdown"
    ).length;
    const textCount = folderScopedDocuments.filter(
      (d) => d.fileType === "text"
    ).length;
    const imgCount = folderScopedDocuments.filter(
      (d) => d.fileType === "image"
    ).length;
    const fileCount = folderScopedDocuments.filter(
      (d) => d.fileType === "file"
    ).length;
    return { totalCount, mdCount, textCount, imgCount, fileCount };
  }, [folderScopedDocuments]);

  return (
    <div
      onDragOver={(e) => {
        if (isReadOnly) return;
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(e) => {
        if (isReadOnly) return;
        e.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(e) => {
        if (isReadOnly) return;
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) {
          handleUploadFiles(e.dataTransfer.files);
        }
      }}
      className={`space-y-4 pb-12 transition-all ${
        isDragging ? "ring-2 ring-white/25 rounded-2xl p-2" : ""
      }`}
    >
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*,.txt,.md,.markdown,.json,.csv,.js,.ts,.tsx,.css,.html,.pdf,.doc,.docx"
        onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
        className="hidden"
      />

      {/* TOP BAR: Title + Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 flex-wrap">
          {activeFolder && (
            <button
              type="button"
              onClick={() => setActiveFolderId(null)}
              className="px-2.5 py-1 rounded-lg bg-[#10131c] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.08] text-xs font-medium transition cursor-pointer"
            >
              ← All
            </button>
          )}
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            {activeFolder ? activeFolder.name : "Documents"}
          </h2>
          <span className="text-xs font-mono text-slate-400 bg-[#10131c] border border-white/[0.07] px-2 py-0.5 rounded-lg">
            {folderScopedDocuments.length}
          </span>
        </div>

        {/* Clean Monochrome Action Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => fetchDocuments(false)}
            disabled={isSyncing || isLoading}
            title="Refresh"
            className="w-8 h-8 rounded-xl bg-[#10131c] hover:bg-white/[0.07] text-slate-400 hover:text-white border border-white/[0.08] flex items-center justify-center transition cursor-pointer disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${
                isSyncing || isLoading ? "animate-spin" : ""
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
          </button>

          {!isReadOnly && (
            <>
              <button
                type="button"
                onClick={() => setShowNewFolderInput((prev) => !prev)}
                className="px-3 py-1.5 rounded-xl bg-amber-500/[0.08] hover:bg-amber-500/[0.15] text-amber-200 hover:text-amber-100 border border-amber-500/25 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
              >
                <svg
                  className="w-3.5 h-3.5 text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                <span>+ Folder</span>
              </button>

              <button
                type="button"
                onClick={openCreateTxtModal}
                className="px-3 py-1.5 rounded-xl bg-[#10131c] hover:bg-white/[0.07] text-slate-200 hover:text-white border border-white/[0.08] text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
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
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <span>Write .txt</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-200 text-slate-950 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                <span>{isUploading ? "Uploading..." : "Upload"}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* INLINE CREATE FOLDER BAR */}
      {showNewFolderInput && !isReadOnly && (
        <form
          onSubmit={handleCreateFolder}
          className="p-2.5 rounded-xl bg-amber-500/[0.05] border border-amber-500/25 flex items-center gap-2 mb-3"
        >
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            placeholder="New folder name..."
            autoFocus
            className="flex-1 px-3 py-1.5 rounded-lg bg-[#07090e] border border-amber-500/30 text-white text-xs focus:outline-none focus:border-amber-400"
          />
          <button
            type="button"
            onClick={() => {
              setShowNewFolderInput(false);
              setNewFolderName("");
            }}
            className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isCreatingFolder || !newFolderName.trim()}
            className="px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
          >
            {isCreatingFolder ? "..." : "Create"}
          </button>
        </form>
      )}

      {/* FOLDERS ROW / AREA (Highlighted & Subtle Yellow Color) */}
      {folders.length > 0 && (
        <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-500/[0.04] border border-amber-500/15 shadow-[0_4px_20px_rgba(0,0,0,0.18)] mb-6 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <svg
                  className="w-3.5 h-3.5 text-amber-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
                Folders
              </span>
              <span className="px-1.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[10px] font-mono font-medium text-amber-300">
                {folders.length}
              </span>
            </div>
            {activeFolder && (
              <span className="text-[11px] text-amber-300/80 font-mono">
                Active:{" "}
                <span className="text-amber-200 font-semibold">
                  {activeFolder.name}
                </span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveFolderId(null)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer ${
                activeFolderId === null
                  ? "bg-amber-500/20 border-amber-500/40 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                  : "bg-[#0d1017] border-white/[0.08] text-slate-400 hover:text-slate-200 hover:border-white/[0.15]"
              }`}
            >
              <span>All Files</span>
              <span className="font-mono text-[10px] opacity-75">
                {documents.length}
              </span>
            </button>

            {folders.map((folder) => {
              const isSelected = activeFolderId === folder.id;
              const count = folderCounts[folder.id] || 0;
              return (
                <div
                  key={folder.id}
                  onClick={() =>
                    setActiveFolderId(isSelected ? null : folder.id)
                  }
                  className={`group flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition cursor-pointer select-none ${
                    isSelected
                      ? "bg-amber-500/25 border-amber-500/50 text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.22)]"
                      : "bg-amber-500/[0.07] border-amber-500/20 text-amber-200/90 hover:bg-amber-500/[0.14] hover:border-amber-500/35 hover:text-amber-100"
                  }`}
                >
                  <svg
                    className={`w-3.5 h-3.5 shrink-0 transition-colors ${
                      isSelected
                        ? "text-amber-300"
                        : "text-amber-400/80 group-hover:text-amber-300"
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                    />
                  </svg>
                  <span className="truncate max-w-[140px]">{folder.name}</span>
                  <span
                    className={`font-mono text-[10px] ${
                      isSelected
                        ? "text-amber-300 font-semibold"
                        : "text-amber-400/70"
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
                      title="Delete folder"
                      className="opacity-0 group-hover:opacity-100 text-amber-400/60 hover:text-rose-400 transition cursor-pointer"
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

      {/* FILTER PILLS + SEARCH + VIEW MODE */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-[#0d1017] p-1 rounded-xl border border-white/[0.07] w-fit">
          {(
            [
              { id: "all", label: "All", count: stats.totalCount },
              { id: "markdown", label: "Markdown", count: stats.mdCount },
              { id: "text", label: "Text", count: stats.textCount },
              { id: "image", label: "Images", count: stats.imgCount },
              ...(stats.fileCount > 0
                ? [{ id: "file", label: "Files", count: stats.fileCount }]
                : []),
            ] as Array<{ id: "all" | DocumentType; label: string; count: number }>
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setTypeFilter(tab.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                typeFilter === tab.id
                  ? "bg-white/[0.1] text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <span>{tab.label}</span>
              <span className="font-mono text-[10px] opacity-65">
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-60">
            <svg
              className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-[#0d1017] border border-white/[0.07] focus:border-white/[0.2] text-white placeholder-slate-500 text-xs focus:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center bg-[#0d1017] border border-white/[0.07] rounded-xl p-0.5">
            <button
              onClick={() => setViewMode("table")}
              title="List view"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "table"
                  ? "bg-white/[0.1] text-white"
                  : "text-slate-500 hover:text-slate-200"
              }`}
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
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
            <button
              onClick={() => setViewMode("grid")}
              title="Grid view"
              className={`p-1.5 rounded-lg transition cursor-pointer ${
                viewMode === "grid"
                  ? "bg-white/[0.1] text-white"
                  : "text-slate-500 hover:text-slate-200"
              }`}
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
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {uploadError && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs flex items-center justify-between">
          <span>{uploadError}</span>
          <button
            onClick={() => setUploadError("")}
            className="text-rose-300 hover:text-white cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* CONTENT LISTING */}
      {isLoading ? (
        <div className="bg-[#0d1017] border border-white/[0.07] rounded-2xl p-12 text-center text-slate-400 space-y-2.5">
          <div className="w-6 h-6 border-2 border-white/40 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs">Loading documents...</p>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-[#0d1017] border border-white/[0.07] rounded-2xl p-12 text-center space-y-4">
          <div className="w-11 h-11 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-slate-400 flex items-center justify-center mx-auto">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.6}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-white">
              {activeFolder
                ? `No files in "${activeFolder.name}"`
                : "No documents"}
            </h3>
            <p className="text-xs text-slate-500">
              Drop files anywhere here, write a .txt note, or upload a file.
            </p>
          </div>
          {!isReadOnly && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                onClick={openCreateTxtModal}
                className="px-3.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] text-slate-200 border border-white/[0.08] text-xs font-medium transition cursor-pointer"
              >
                Write .txt
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-200 text-slate-950 text-xs font-semibold transition cursor-pointer"
              >
                Upload File
              </button>
            </div>
          )}
        </div>
      ) : viewMode === "table" ? (
        /* CLEAN MONOCHROME LEDGER VIEW */
        <div className="bg-[#0d1017] border border-white/[0.07] rounded-2xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.06] text-[11px] font-medium text-slate-500">
                  <th className="py-3 px-4 sm:px-5">Name</th>
                  <th className="py-3 px-4">Folder</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Updated</th>
                  <th className="py-3 px-4 sm:px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05] text-xs">
                {filteredDocuments.map((doc) => {
                  const isImage = doc.fileType === "image";
                  const isMd = doc.fileType === "markdown";
                  const isTxt = doc.fileType === "text";

                  return (
                    <tr
                      key={doc.id}
                      className="hover:bg-white/[0.02] transition group cursor-pointer"
                      onClick={() => openDocumentViewer(doc)}
                    >
                      <td className="py-3 px-4 sm:px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center shrink-0 text-[10px] font-mono font-bold text-slate-300 overflow-hidden">
                            {isImage && doc.fileUrl ? (
                              <img
                                src={doc.fileUrl}
                                alt={doc.name}
                                className="w-full h-full object-cover"
                              />
                            ) : isMd ? (
                              "MD"
                            ) : isTxt ? (
                              "TXT"
                            ) : isImage ? (
                              "IMG"
                            ) : (
                              "FILE"
                            )}
                          </div>
                          <span className="font-medium text-slate-100 group-hover:text-white truncate max-w-xs sm:max-w-md">
                            {doc.name}
                          </span>
                        </div>
                      </td>

                      <td
                        className="py-3 px-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {!isReadOnly && folders.length > 0 ? (
                          <select
                            value={doc.folderId || ""}
                            onChange={(e) =>
                              handleMoveDocumentFolder(
                                doc.id,
                                e.target.value || null
                              )
                            }
                            className="px-2 py-1 rounded-lg bg-[#07090e] border border-white/[0.08] text-xs text-slate-300 focus:outline-none cursor-pointer"
                          >
                            <option value="">No folder</option>
                            {folders.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.name}
                              </option>
                            ))}
                          </select>
                        ) : doc.folderId && folderMap.get(doc.folderId) ? (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/[0.08] text-amber-300 border border-amber-500/20 text-[11px] inline-flex items-center gap-1">
                            <svg
                              className="w-3 h-3 text-amber-400 shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={1.8}
                                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                              />
                            </svg>
                            {folderMap.get(doc.folderId)}
                          </span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-white/[0.04] text-slate-400 border border-white/[0.07] text-[10px] font-mono uppercase">
                          {doc.fileType}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {formatBytes(doc.fileSize)}
                      </td>

                      <td className="py-3 px-4 text-slate-400">
                        {new Date(doc.updatedAt).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>

                      <td
                        className="py-3 px-4 sm:px-5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-end gap-1">
                          {!isReadOnly &&
                            (doc.fileType === "text" ||
                              doc.fileType === "markdown") && (
                              <button
                                type="button"
                                onClick={() => openEditTxtModal(doc)}
                                title="Edit"
                                className="px-2 py-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
                              >
                                Edit
                              </button>
                            )}

                          {(doc.content || doc.fileUrl) && (
                            <button
                              type="button"
                              onClick={() => handleCopyContent(doc)}
                              className="px-2 py-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
                            >
                              {copiedDocId === doc.id ? "✓" : "Copy"}
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleDownload(doc)}
                            title="Download"
                            className="px-2 py-1 rounded-md text-slate-400 hover:text-white hover:bg-white/[0.06] transition cursor-pointer"
                          >
                            ↓
                          </button>

                          {canDelete && (
                            <button
                              type="button"
                              onClick={() => setDocToDelete(doc)}
                              title="Delete"
                              className="px-2 py-1 rounded-md text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition cursor-pointer"
                            >
                              ✕
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
        /* CLEAN MONOCHROME GRID VIEW */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredDocuments.map((doc) => {
            const isImage = doc.fileType === "image";
            const isMd = doc.fileType === "markdown";

            return (
              <div
                key={doc.id}
                onClick={() => openDocumentViewer(doc)}
                className="bg-[#0d1017] border border-white/[0.07] hover:border-white/[0.16] rounded-2xl p-4 transition flex flex-col justify-between group cursor-pointer"
              >
                <div>
                  {isImage && doc.fileUrl ? (
                    <div className="w-full h-32 rounded-xl bg-[#07090e] overflow-hidden mb-3 border border-white/[0.06]">
                      <img
                        src={doc.fileUrl}
                        alt={doc.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="px-2 py-0.5 rounded-md bg-white/[0.05] border border-white/[0.08] font-mono text-[10px] font-bold text-slate-300">
                        {isMd ? "MD" : "TXT"}
                      </span>
                      {doc.folderId && folderMap.get(doc.folderId) && (
                        <span className="text-[10px] text-amber-300 bg-amber-500/[0.08] px-2 py-0.5 rounded-md border border-amber-500/20 inline-flex items-center gap-1">
                          <svg
                            className="w-2.5 h-2.5 text-amber-400 shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.8}
                              d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                            />
                          </svg>
                          {folderMap.get(doc.folderId)}
                        </span>
                      )}
                    </div>
                  )}

                  <h3 className="font-semibold text-white text-sm truncate">
                    {doc.name}
                  </h3>

                  {!isImage && doc.content && (
                    <div className="mt-2 p-2.5 rounded-xl bg-[#07090e] border border-white/[0.05] text-[11px] text-slate-400 font-mono line-clamp-3">
                      {doc.content.slice(0, 140)}
                    </div>
                  )}
                </div>

                <div
                  className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-slate-400"
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="font-mono">{formatBytes(doc.fileSize)}</span>
                  <div className="flex items-center gap-1.5">
                    {!isReadOnly &&
                      (doc.fileType === "text" ||
                        doc.fileType === "markdown") && (
                        <button
                          onClick={() => openEditTxtModal(doc)}
                          className="hover:text-white cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                    <button
                      onClick={() => handleCopyContent(doc)}
                      className="hover:text-white cursor-pointer"
                    >
                      {copiedDocId === doc.id ? "✓" : "Copy"}
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setDocToDelete(doc)}
                        className="hover:text-rose-400 cursor-pointer ml-1"
                      >
                        ✕
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowWriteTxtModal(false)}
        >
          <div
            className="bg-[#10131c] border border-white/[0.09] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">
                {editingTxtDoc ? `Edit ${editingTxtDoc.name}` : "Write .txt File"}
              </h3>
              <button
                type="button"
                onClick={() => setShowWriteTxtModal(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={handleSaveTxtFile}
              className="flex-1 overflow-y-auto p-5 space-y-4"
            >
              {txtError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs">
                  {txtError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    File Name (.txt)
                  </label>
                  <input
                    type="text"
                    value={txtFileName}
                    onChange={(e) => setTxtFileName(e.target.value)}
                    placeholder="notes.txt"
                    required
                    autoFocus
                    className="w-full px-3 py-2 rounded-xl bg-[#07090e] border border-white/[0.09] text-white text-xs focus:outline-none focus:border-white/30"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Folder
                  </label>
                  <select
                    value={txtFolderId}
                    onChange={(e) => setTxtFolderId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-[#07090e] border border-white/[0.09] text-white text-xs focus:outline-none cursor-pointer"
                  >
                    <option value="">No Folder</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-300">
                    Content
                  </label>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {txtContent.length} chars
                  </span>
                </div>
                <textarea
                  value={txtContent}
                  onChange={(e) => setTxtContent(e.target.value)}
                  rows={12}
                  placeholder="Write or paste text..."
                  className="w-full p-3 rounded-xl bg-[#07090e] border border-white/[0.09] text-slate-100 font-mono text-xs leading-relaxed focus:outline-none focus:border-white/30 resize-y"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setShowWriteTxtModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-slate-400 hover:text-white text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTxt}
                  className="px-4 py-1.5 rounded-lg bg-white hover:bg-slate-200 text-slate-950 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
                >
                  {isSavingTxt ? "Saving..." : "Save .txt"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DOCUMENT VIEWER */}
      {activeDocument && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setActiveDocument(null)}
        >
          <div
            className="bg-[#10131c] border border-white/[0.09] rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-white/[0.07] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-white text-sm truncate">
                  {activeDocument.name}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {formatBytes(activeDocument.fileSize)} •{" "}
                  {new Date(activeDocument.updatedAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!isReadOnly &&
                  (activeDocument.fileType === "text" ||
                    activeDocument.fileType === "markdown") && (
                    <button
                      onClick={() => openEditTxtModal(activeDocument)}
                      className="px-3 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-xs font-medium transition cursor-pointer"
                    >
                      Edit
                    </button>
                  )}
                <button
                  onClick={() => handleCopyContent(activeDocument)}
                  className="px-3 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-xs font-medium transition cursor-pointer"
                >
                  {copiedDocId === activeDocument.id ? "✓ Copied" : "Copy"}
                </button>
                <button
                  onClick={() => handleDownload(activeDocument)}
                  className="px-3 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 text-xs font-medium transition cursor-pointer"
                >
                  Download
                </button>
                <button
                  onClick={() => setActiveDocument(null)}
                  className="text-slate-400 hover:text-white text-xs pl-2 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              <div className="bg-[#07090e] rounded-xl border border-white/[0.06] p-4 min-h-[260px]">
                {activeDocument.fileType === "markdown" ? (
                  renderSimpleMarkdown(activeDocument.content || "")
                ) : activeDocument.fileType === "text" ? (
                  <pre className="text-slate-200 font-mono text-xs whitespace-pre-wrap leading-relaxed">
                    {activeDocument.content || "No content"}
                  </pre>
                ) : (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    <p>Binary file</p>
                    {activeDocument.fileUrl && (
                      <a
                        href={activeDocument.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block px-3.5 py-1.5 rounded-lg bg-white text-slate-950 font-semibold"
                      >
                        Open File
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LIGHTBOX FOR IMAGES */}
      {lightboxImage && (
        <div
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-[#10131c] border border-white/[0.09] rounded-2xl max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
          >
            <div className="px-4 py-3 border-b border-white/[0.07] flex items-center justify-between">
              <span className="font-semibold text-white text-xs truncate">
                {lightboxImage.name}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleDownload(lightboxImage)}
                  className="px-2.5 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-white text-xs font-medium cursor-pointer"
                >
                  Download
                </button>
                <button
                  onClick={() => setLightboxImage(null)}
                  className="text-slate-400 hover:text-white text-xs cursor-pointer"
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
                  className="max-h-[70vh] w-auto object-contain rounded-lg"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE DOCUMENT CONFIRMATION */}
      {docToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setDocToDelete(null)}
        >
          <div
            className="bg-[#10131c] border border-white/[0.09] rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Delete file?</h3>
              <p className="text-xs text-slate-400">
                Permanently delete &quot;{docToDelete.name}&quot;?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setDocToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteDocument}
                className="px-3.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: DELETE FOLDER CONFIRMATION */}
      {folderToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setFolderToDelete(null)}
        >
          <div
            className="bg-[#10131c] border border-white/[0.09] rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Delete folder?</h3>
              <p className="text-xs text-slate-400">
                Delete &quot;{folderToDelete.name}&quot;? Files inside will stay in All Files.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setFolderToDelete(null)}
                className="px-3.5 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-slate-300 text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDeletingFolder}
                onClick={handleDeleteFolder}
                className="px-3.5 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-400 text-white text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                {isDeletingFolder ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
