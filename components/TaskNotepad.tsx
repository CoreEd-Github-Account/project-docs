"use client";

import React, { useState, useEffect, useRef } from "react";
import type { Project, TaskItem, TaskStage, TaskComment, TaskSubComment, ProjectRole, TaskMessage, TaskAttachment } from "@/lib/types";

interface TaskNotepadProps {
  project: Project;
  onUpdateTasks: (tasks: string) => void;
  onUpdateProjectFolders?: (folders: string[]) => void;
  onManualSave?: () => void;
  saveStatus: "saved" | "unsaved" | "saving" | "error";
  userPermission?: ProjectRole;
}

// Stage configuration with icons, labels, and Tailwind color tokens
const STAGE_CONFIG: Record<
  TaskStage,
  {
    label: string;
    badgeClass: string;
    dotClass: string;
    borderClass: string;
    bgHoverClass: string;
    iconSvg: (className: string) => React.ReactNode;
  }
> = {
  inprogress: {
    label: "In Progress",
    badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]",
    borderClass: "border-amber-500/40",
    bgHoverClass: "hover:bg-amber-500/10",
    iconSvg: (cls) => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  completed: {
    label: "Completed",
    badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    dotClass: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]",
    borderClass: "border-emerald-500/40",
    bgHoverClass: "hover:bg-emerald-500/10",
    iconSvg: (cls) => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 13l4 4L19 7"
        />
      </svg>
    ),
  },
  stopped: {
    label: "Stopped",
    badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30",
    dotClass: "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
    borderClass: "border-rose-500/40",
    bgHoverClass: "hover:bg-rose-500/10",
    iconSvg: (cls) => (
      <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
};

// Helper: format human-friendly full date and time string: e.g. "Oct 17, 2026, 3:36 PM"
export function formatFullDateTime(timestamp: number): string {
  if (!timestamp) return "";
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

// Helper: format file size in B, KB, or MB
export function formatFileSize(bytes?: number): string {
  if (!bytes || isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Helper: parse comments from JSON array or legacy string with date/time preservation
export function parseComments(rawComments?: string | null, fallbackTimestamp?: number): TaskComment[] {
  if (!rawComments || !rawComments.trim()) return [];
  const trimmed = rawComments.trim();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((c) => c && typeof c === "object" && (c.text || c.content))
          .map((c, i) => {
            const createdAt = Number(c.createdAt || c.created_at) || fallbackTimestamp || Date.now();
            const dateTime = String(c.dateTime || c.date_time || c.date || "").trim() || formatFullDateTime(createdAt);
            const completed = Boolean(c.completed || c.isCompleted || c.done);

            // Parse sub-comments / replies
            const rawSubs = Array.isArray(c.subComments)
              ? c.subComments
              : Array.isArray(c.sub_comments)
              ? c.sub_comments
              : Array.isArray(c.replies)
              ? c.replies
              : [];

            const subComments: TaskSubComment[] = rawSubs
              .filter((s: unknown) => s && typeof s === "object" && ((s as Record<string, unknown>).text || (s as Record<string, unknown>).content))
              .map((s: unknown, subIdx: number) => {
                const subObj = s as Record<string, unknown>;
                const subCreatedAt = Number(subObj.createdAt || subObj.created_at) || createdAt || Date.now();
                const subDateTime = String(subObj.dateTime || subObj.date_time || subObj.date || "").trim() || formatFullDateTime(subCreatedAt);
                const subCompleted = Boolean(subObj.completed || subObj.isCompleted || subObj.done);
                return {
                  id: String(subObj.id || `sub-${i}-${subIdx}-${subCreatedAt}`),
                  text: String(subObj.text || subObj.content || "").trim(),
                  createdAt: subCreatedAt,
                  dateTime: subDateTime,
                  completed: subCompleted,
                };
              });

            return {
              id: String(c.id || `c-${i}-${createdAt}`),
              text: String(c.text || c.content || "").trim(),
              createdAt,
              dateTime,
              completed,
              subComments,
            };
          });
      }
    } catch {
      // Fall through to plain text parsing
    }
  }

  // Handle legacy single-string comment
  const ts = fallbackTimestamp || Date.now();
  return [
    {
      id: "comment-initial",
      text: trimmed,
      createdAt: ts,
      dateTime: formatFullDateTime(ts),
      completed: false,
      subComments: [],
    },
  ];
}

// Helper: format comment date badge with both exact date/time and relative time
export function formatCommentBadge(timestamp: number, storedDateTime?: string): { full: string; relative: string } {
  const d = timestamp ? new Date(timestamp) : new Date(storedDateTime || "");
  const valid = !isNaN(d.getTime());
  const full = valid ? formatFullDateTime(d.getTime()) : (storedDateTime || "Just now");

  let relative = "";
  if (valid) {
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) relative = "Just now";
    else if (diffMins < 60) relative = `${diffMins}m ago`;
    else if (diffMins < 1440) relative = `${Math.floor(diffMins / 60)}h ago`;
    else relative = `${Math.floor(diffMins / 1440)}d ago`;
  }

  return { full, relative };
}

// Robust parser handling JSON or legacy markdown / plain text
function parseTasksFromText(rawText: string, projectId?: string): TaskItem[] {
  if (!rawText || !rawText.trim()) return [];

  const trimmed = rawText.trim();

  // 1. Try parsing JSON array
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item && typeof item === "object")
          .map((item, idx) => {
            let stage: TaskStage = "inprogress";
            if (
              item.stage === "completed" ||
              item.stage === "inprogress" ||
              item.stage === "stopped"
            ) {
              stage = item.stage;
            } else if (item.completed === true) {
              stage = "completed";
            } else if (item.stopped === true) {
              stage = "stopped";
            }

            const headingText = String(item.heading || item.title || "").trim() || "Untitled Task";

            return {
              id: item.id || `task-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
              projectId: item.projectId || projectId,
              title: headingText,
              heading: headingText,
              description: String(item.description || "").trim(),
              comments: String(item.comments || "").trim(),
              stage,
              startDate: String(item.startDate || item.start_date || "").trim(),
              endDate: String(item.endDate || item.end_date || "").trim(),
              createdAt: Number(item.createdAt) || Date.now(),
              folder: String(item.folder || "").trim(),
            };
          });
      }
    } catch {
      // Fall through to markdown parsing
    }
  }

  // 2. Intelligent Markdown Parser
  const lines = rawText.split("\n");
  const items: TaskItem[] = [];
  let currentStage: TaskStage = "inprogress";
  let currentTask: TaskItem | null = null;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmedLine = rawLine.trim();
    if (!trimmedLine) continue;

    // A. Ignore section stage headings like "## In Progress", "## Completed", "## Stopped"
    if (/^#+\s*in\s*progress/i.test(trimmedLine)) {
      currentStage = "inprogress";
      continue;
    }
    if (/^#+\s*completed/i.test(trimmedLine)) {
      currentStage = "completed";
      continue;
    }
    if (/^#+\s*stopped/i.test(trimmedLine)) {
      currentStage = "stopped";
      continue;
    }

    // B. Check for Timeline / Dates under current task: e.g. "> Timeline: Start: 2026-10-17 | End: 2026-10-25"
    const timelineMatch = trimmedLine.match(/^>?\s*(?:timeline|dates?):\s*(.*)$/i);
    if (timelineMatch && currentTask) {
      const line = timelineMatch[1];
      const startMatch = line.match(/start(?:ing)?(?:\s*date)?:\s*([^\s|,]+)/i);
      const endMatch = line.match(/end(?:\s*date)?:\s*([^\s|,]+)/i);
      if (startMatch) currentTask.startDate = startMatch[1];
      if (endMatch) currentTask.endDate = endMatch[1];
      continue;
    }

    // Check for Folder metadata: e.g. "> Folder: Backend"
    const folderMatch = trimmedLine.match(/^>?\s*folders?:\s*(.*)$/i);
    if (folderMatch && currentTask) {
      currentTask.folder = folderMatch[1].trim();
      continue;
    }

    // C. Check for Description under current task: e.g. "> Description: ..." or "Description: ..."
    const descMatch = trimmedLine.match(/^>?\s*description:\s*(.*)$/i);
    if (descMatch && currentTask) {
      const descVal = descMatch[1].trim();
      currentTask.description = currentTask.description
        ? `${currentTask.description}\n${descVal}`
        : descVal;
      continue;
    }

    // D. Check for Comments under current task: e.g. "> Comment: ..." or "> Comment [Oct 17, 2026, 3:36 PM]: ..."
    const commentsMatch = trimmedLine.match(/^>?\s*comments?(?:\s*&\s*notes)?(?:\s*\[([^\]]+)\]|\s*\(([^)]+)\))?:\s*(.*)$/i);
    if (commentsMatch && currentTask) {
      const capturedDate = (commentsMatch[1] || commentsMatch[2] || "").trim();
      const commVal = (commentsMatch[3] || "").trim();
      if (commVal) {
        const parsedTimestamp = capturedDate ? Date.parse(capturedDate) : NaN;
        const now = isNaN(parsedTimestamp) ? (currentTask.createdAt || Date.now()) : parsedTimestamp;
        const dateTime = capturedDate || formatFullDateTime(now);
        const existing = parseComments(currentTask.comments, currentTask.createdAt);
        existing.push({
          id: `c-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          text: commVal,
          createdAt: now,
          dateTime,
        });
        currentTask.comments = JSON.stringify(existing);
      }
      continue;
    }

    // E. Indented lines or quote lines belong to the current task's description
    if ((rawLine.startsWith("  ") || rawLine.startsWith("\t") || trimmedLine.startsWith(">")) && currentTask) {
      const cleaned = trimmedLine.replace(/^>\s*/, "").trim();
      if (cleaned) {
        currentTask.description = currentTask.description
          ? `${currentTask.description}\n${cleaned}`
          : cleaned;
      }
      continue;
    }

    // F. Task Item starting with checkbox or bullet
    let taskStage = currentStage;
    let heading = trimmedLine;
    let isTask = false;

    if (/^[-*]\s*\[x\]/i.test(trimmedLine)) {
      taskStage = "completed";
      heading = trimmedLine.replace(/^[-*]\s*\[x\]\s*/i, "").trim();
      isTask = true;
    } else if (/^[-*]\s*\[-\]/i.test(trimmedLine) || /\[stopped\]/i.test(trimmedLine)) {
      taskStage = "stopped";
      heading = trimmedLine.replace(/^[-*]\s*\[-\]\s*/i, "").replace(/\[stopped\]/gi, "").trim();
      isTask = true;
    } else if (/^[-*]\s*\[\s*\]/i.test(trimmedLine)) {
      taskStage = currentStage;
      heading = trimmedLine.replace(/^[-*]\s*\[\s*\]\s*/i, "").trim();
      isTask = true;
    } else if (/^[-*]\s+/.test(trimmedLine)) {
      heading = trimmedLine.replace(/^[-*]\s+/, "").trim();
      isTask = true;
    } else if (!trimmedLine.startsWith("#")) {
      // Regular non-header line treated as task heading
      isTask = true;
    }

    if (isTask && heading) {
      currentTask = {
        id: `task-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        projectId,
        title: heading,
        heading: heading,
        description: "",
        comments: "",
        stage: taskStage,
        createdAt: Date.now() - (lines.length - i) * 60000,
      };
      items.push(currentTask);
    }
  }

  return items;
}

// Convert tasks array to clean human-readable markdown for notepad or copying
function tasksToMarkdown(items: TaskItem[]): string {
  if (items.length === 0) return "";
  const inProgress = items.filter((t) => t.stage === "inprogress");
  const completed = items.filter((t) => t.stage === "completed");
  const stopped = items.filter((t) => t.stage === "stopped");

  const formatTask = (t: TaskItem, prefix: string) => {
    let s = `${prefix} ${t.heading || t.title}\n`;
    if (t.startDate || t.endDate) {
      const dates = [
        t.startDate ? `Start: ${t.startDate}` : "",
        t.endDate ? `End: ${t.endDate}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
      s += `  > Timeline: ${dates}\n`;
    }
    if (t.folder) s += `  > Folder: ${t.folder}\n`;
    if (t.description) s += `  > Description: ${t.description}\n`;
    const commentsList = parseComments(t.comments, t.createdAt);
    if (commentsList.length > 0) {
      commentsList.forEach((c) => {
        const timeBadge = c.dateTime || (c.createdAt ? formatFullDateTime(c.createdAt) : "");
        const check = c.completed ? "[x]" : "[ ]";
        if (timeBadge) {
          s += `  > - ${check} Comment [${timeBadge}]: ${c.text}\n`;
        } else {
          s += `  > - ${check} Comment: ${c.text}\n`;
        }
        if (c.subComments && c.subComments.length > 0) {
          c.subComments.forEach((sc) => {
            const scTimeBadge = sc.dateTime || (sc.createdAt ? formatFullDateTime(sc.createdAt) : "");
            const scCheck = sc.completed ? "[x]" : "[ ]";
            if (scTimeBadge) {
              s += `  >   - ${scCheck} Sub-comment [${scTimeBadge}]: ${sc.text}\n`;
            } else {
              s += `  >   - ${scCheck} Sub-comment: ${sc.text}\n`;
            }
          });
        }
      });
    }
    return s;
  };

  let out = "";
  if (inProgress.length > 0) {
    out += "## In Progress\n";
    inProgress.forEach((t) => {
      out += formatTask(t, "- [ ]");
    });
    out += "\n";
  }
  if (completed.length > 0) {
    out += "## Completed\n";
    completed.forEach((t) => {
      out += formatTask(t, "- [x]");
    });
    out += "\n";
  }
  if (stopped.length > 0) {
    out += "## Stopped\n";
    stopped.forEach((t) => {
      out += formatTask(t, "- [-] [stopped]");
    });
  }
  return out.trim();
}

export function TaskNotepad({
  project,
  onUpdateTasks,
  onUpdateProjectFolders,
  onManualSave,
  saveStatus,
  userPermission,
}: TaskNotepadProps) {
  // Permission derivation: owner, full, edit_no_delete, or read
  const role: ProjectRole =
    userPermission || project.currentUserPermission || (project.isOwner === false ? "read" : "owner");
  const isReadOnly = role === "read";
  const canDelete = role === "owner" || role === "full";
  const canEdit = !isReadOnly;

  // Folder states
  const [folders, setFolders] = useState<string[]>(() => project.taskFolders || []);
  const [activeFolder, setActiveFolder] = useState<string>("all");
  const [isAddFolderModalOpen, setIsAddFolderModalOpen] = useState(false);
  const [newFolderInput, setNewFolderInput] = useState("");
  const [folderToRename, setFolderToRename] = useState<string | null>(null);
  const [renameFolderInput, setRenameFolderInput] = useState("");

  useEffect(() => {
    if (project.taskFolders) {
      setFolders(project.taskFolders);
    }
  }, [project.taskFolders]);

  // Main tasks state
  const [tasks, setTasks] = useState<TaskItem[]>(() =>
    parseTasksFromText(project.tasks ?? "", project.id)
  );

  // Database loading & sync state
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbNotice, setDbNotice] = useState<string | null>(null);

  // Modal Form state: (heading, description, status, comments, start date & end date, folder)
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [formHeading, setFormHeading] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStatus, setFormStatus] = useState<TaskStage>("inprogress");
  const [formFolder, setFormFolder] = useState<string>("");
  const [isCreatingInlineFolder, setIsCreatingInlineFolder] = useState(false);
  const [inlineFolderInput, setInlineFolderInput] = useState("");
  const [formCommentsList, setFormCommentsList] = useState<TaskComment[]>([]);
  const [formNewComment, setFormNewComment] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Form Attachments state (for Add / Edit Task Modal)
  const [formAttachments, setFormAttachments] = useState<TaskAttachment[]>([]);
  const [isUploadingFormAttachment, setIsUploadingFormAttachment] = useState(false);
  const [formAttachmentError, setFormAttachmentError] = useState<string | null>(null);
  const [isFormDraggingOver, setIsFormDraggingOver] = useState(false);
  const formAttachmentFileInputRef = useRef<HTMLInputElement | null>(null);

  // Quick Inline Comment draft state for task cards: map of taskId -> draft comment text
  const [inlineComments, setInlineComments] = useState<Record<string, string>>({});
  const [savingCommentTaskId, setSavingCommentTaskId] = useState<string | null>(null);

  // Sub-comment states: map of commentId -> draft sub-comment text
  const [inlineSubComments, setInlineSubComments] = useState<Record<string, string>>({});
  const [replyingCommentId, setReplyingCommentId] = useState<string | null>(null);
  const [savingSubCommentCommentId, setSavingSubCommentCommentId] = useState<string | null>(null);

  // Right-side detail slide-over modal state
  const [activeDetailTaskId, setActiveDetailTaskId] = useState<string | null>(null);
  const [drawerNewComment, setDrawerNewComment] = useState("");
  const [isAddingDrawerComment, setIsAddingDrawerComment] = useState(false);
  const [isDrawerCommentFormOpen, setIsDrawerCommentFormOpen] = useState(false);

  // Task Workspace Draggable Resizer Split State
  const [drawerSplitRatio, setDrawerSplitRatio] = useState<number>(50);
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);

  // Initialize split ratio from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("task_workspace_split_ratio");
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 22 && val <= 78) {
          setDrawerSplitRatio(val);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const handleSplitterMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitter(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!splitContainerRef.current) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const newRatio = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(Math.max(newRatio, 22), 78);
      setDrawerSplitRatio(clamped);
      try {
        localStorage.setItem("task_workspace_split_ratio", String(Math.round(clamped)));
      } catch {
        // ignore
      }
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleSplitterTouchStart = () => {
    setIsDraggingSplitter(true);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (!splitContainerRef.current || !moveEvent.touches[0]) return;
      const rect = splitContainerRef.current.getBoundingClientRect();
      if (rect.width <= 0) return;
      const touchX = moveEvent.touches[0].clientX;
      const newRatio = ((touchX - rect.left) / rect.width) * 100;
      const clamped = Math.min(Math.max(newRatio, 22), 78);
      setDrawerSplitRatio(clamped);
    };

    const handleTouchEnd = () => {
      setIsDraggingSplitter(false);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };

    window.addEventListener("touchmove", handleTouchMove);
    window.addEventListener("touchend", handleTouchEnd);
  };

  // Image lightbox preview state
  const [lightboxAttachment, setLightboxAttachment] = useState<TaskAttachment | null>(null);

  // Project Chats (task-specific live sync) state
  const [taskMessages, setTaskMessages] = useState<TaskMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSendingChat, setIsSendingChat] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [chatCurrentUserId, setChatCurrentUserId] = useState<string | null>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // View state: 'list' (default) | 'grouped' | 'notepad'
  const [viewMode, setViewMode] = useState<"list" | "grouped" | "notepad">("list");
  // Active stage filter in list view: 'all' | TaskStage
  const [filterStage, setFilterStage] = useState<"all" | TaskStage>("all");
  // Search query
  const [searchQuery, setSearchQuery] = useState("");

  // Raw notepad text (for notepad mode)
  const [rawText, setRawText] = useState(() => project.tasks ?? "");

  // UI state
  const [copied, setCopied] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const headingInputRef = useRef<HTMLInputElement | null>(null);

  // Sync tasks from database table
  const fetchDbTasks = async () => {
    try {
      setIsDbLoading(true);
      const res = await fetch(`/api/tasks?projectId=${encodeURIComponent(project.id)}`);
      if (res.ok) {
        const dbTasks: TaskItem[] = await res.json();
        if (Array.isArray(dbTasks) && dbTasks.length > 0) {
          setTasks(dbTasks);
          setRawText(tasksToMarkdown(dbTasks));
        } else {
          // Fallback to legacy project.tasks string
          const parsed = parseTasksFromText(project.tasks ?? "", project.id);
          setTasks(parsed);
          setRawText(tasksToMarkdown(parsed));
        }
      }
    } catch (err) {
      console.error("Failed to load tasks from DB:", err);
    } finally {
      setIsDbLoading(false);
    }
  };

  useEffect(() => {
    fetchDbTasks();
  }, [project.id]);

  // Focus heading input when modal opens
  useEffect(() => {
    if (isFormOpen && headingInputRef.current) {
      setTimeout(() => {
        headingInputRef.current?.focus();
      }, 50);
    }
  }, [isFormOpen]);

  // Close right drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeDetailTaskId) {
        setActiveDetailTaskId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeDetailTaskId]);

  // Reset drawer comment form state when opening/closing task drawer
  useEffect(() => {
    setIsDrawerCommentFormOpen(false);
    setDrawerNewComment("");
  }, [activeDetailTaskId]);

  // Fetch task-specific chat messages
  const fetchTaskMessages = async (taskId: string, silent = false) => {
    if (!silent) setIsLoadingChat(true);
    try {
      const res = await fetch(
        `/api/tasks/chat?taskId=${encodeURIComponent(taskId)}&projectId=${encodeURIComponent(project.id)}`
      );
      if (res.ok) {
        const data = await res.json();
        setTaskMessages(data.messages || []);
        if (data.currentUser?.id) {
          setChatCurrentUserId(data.currentUser.id);
        }
      }
    } catch (err) {
      console.error("Failed to fetch task messages:", err);
    } finally {
      if (!silent) setIsLoadingChat(false);
    }
  };

  // Live polling for task messages when drawer is open
  useEffect(() => {
    if (!activeDetailTaskId) {
      setTaskMessages([]);
      return;
    }

    // Fetch immediately
    fetchTaskMessages(activeDetailTaskId, false);

    // Live sync polling every 2.5 seconds
    const interval = setInterval(() => {
      fetchTaskMessages(activeDetailTaskId, true);
    }, 2500);

    return () => clearInterval(interval);
  }, [activeDetailTaskId, project.id]);

  // Auto-scroll chat to bottom when messages update
  useEffect(() => {
    if (chatMessagesEndRef.current) {
      chatMessagesEndRef.current.scrollTop = chatMessagesEndRef.current.scrollHeight;
    }
  }, [taskMessages]);

  // Send message in task-specific chat
  const handleSendChatMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text || isSendingChat || !activeDetailTaskId) return;

    setIsSendingChat(true);
    try {
      const res = await fetch("/api/tasks/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: activeDetailTaskId,
          projectId: project.id,
          message: text,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setTaskMessages((prev) => [...prev, data.message]);
        }
        setChatInput("");
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || "Failed to send chat message.");
      }
    } catch (err) {
      console.error("Error sending chat message:", err);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Commit task list updates to local state & legacy project.tasks
  const commitTasks = (updated: TaskItem[]) => {
    setTasks(updated);
    const jsonStr = JSON.stringify(updated);
    onUpdateTasks(jsonStr);
    setRawText(tasksToMarkdown(updated));
  };

  // Add a new comment to a specific task directly from the card
  const handleAddCommentToTask = async (taskId: string, commentText: string) => {
    const text = commentText.trim();
    if (!text) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const now = Date.now();
    const dateTime = formatFullDateTime(now);
    const existingComments = parseComments(task.comments, task.createdAt);
    const newCommentItem: TaskComment = {
      id: `c-${now}-${Math.random().toString(36).substring(2, 6)}`,
      text,
      createdAt: now,
      dateTime,
      completed: false,
    };
    const updatedComments = [...existingComments, newCommentItem];
    const commentsJson = JSON.stringify(updatedComments);

    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, comments: commentsJson } : t
    );
    commitTasks(updatedTasks);
    setInlineComments((prev) => ({ ...prev, [taskId]: "" }));

    try {
      setSavingCommentTaskId(taskId);
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          projectId: project.id,
          heading: task.heading || task.title,
          title: task.heading || task.title,
          description: task.description || "",
          stage: task.stage,
          comments: commentsJson,
          startDate: task.startDate || "",
          endDate: task.endDate || "",
          createdAt: task.createdAt,
        }),
      });
      if (res.ok) {
        setDbNotice("Comment added & synced");
        setTimeout(() => setDbNotice(null), 2500);
      }
    } catch (err) {
      console.error("Failed to add comment:", err);
    } finally {
      setSavingCommentTaskId(null);
    }
  };

  // Toggle comment completion status with Live Sync to Database
  const handleToggleCommentCheck = async (taskId: string, commentId: string) => {
    if (isReadOnly) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const existingComments = parseComments(task.comments, task.createdAt);
    let targetCompleted = false;
    const updatedComments = existingComments.map((c) => {
      if (c.id === commentId) {
        targetCompleted = !c.completed;
        return { ...c, completed: targetCompleted };
      }
      return c;
    });

    const commentsJson = JSON.stringify(updatedComments);
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, comments: commentsJson } : t
    );
    commitTasks(updatedTasks);

    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          projectId: project.id,
          heading: task.heading || task.title,
          title: task.heading || task.title,
          description: task.description || "",
          stage: task.stage,
          comments: commentsJson,
          startDate: task.startDate || "",
          endDate: task.endDate || "",
          createdAt: task.createdAt,
        }),
      });
      if (res.ok) {
        setDbNotice(targetCompleted ? "Comment marked as completed" : "Comment marked as incomplete");
        setTimeout(() => setDbNotice(null), 2000);
      }
    } catch (err) {
      console.error("Failed to toggle comment completion in database:", err);
    }
  };

  // Delete a specific comment from a task
  const handleDeleteComment = async (taskId: string, commentId: string) => {
    if (!canDelete) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const existingComments = parseComments(task.comments);
    const updatedComments = existingComments.filter((c) => c.id !== commentId);
    const commentsJson = updatedComments.length > 0 ? JSON.stringify(updatedComments) : "";

    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, comments: commentsJson } : t
    );
    commitTasks(updatedTasks);

    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          projectId: project.id,
          heading: task.heading || task.title,
          title: task.heading || task.title,
          description: task.description || "",
          stage: task.stage,
          comments: commentsJson,
          startDate: task.startDate || "",
          endDate: task.endDate || "",
          createdAt: task.createdAt,
        }),
      });
      setDbNotice("Comment deleted & synced");
      setTimeout(() => setDbNotice(null), 2500);
    } catch (err) {
      console.error("Failed to delete comment:", err);
    }
  };

  // Add a sub-comment to a parent comment with Live Sync to Database
  const handleAddSubComment = async (taskId: string, commentId: string, subCommentText: string) => {
    if (isReadOnly) return;
    const text = subCommentText.trim();
    if (!text) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const now = Date.now();
    const dateTime = formatFullDateTime(now);
    const existingComments = parseComments(task.comments, task.createdAt);
    const newSubItem: TaskSubComment = {
      id: `sub-${now}-${Math.random().toString(36).substring(2, 6)}`,
      text,
      createdAt: now,
      dateTime,
      completed: false,
    };

    const updatedComments = existingComments.map((c) => {
      if (c.id === commentId) {
        return {
          ...c,
          subComments: [...(c.subComments || []), newSubItem],
        };
      }
      return c;
    });

    const commentsJson = JSON.stringify(updatedComments);
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, comments: commentsJson } : t
    );
    commitTasks(updatedTasks);
    setInlineSubComments((prev) => ({ ...prev, [commentId]: "" }));

    try {
      setSavingSubCommentCommentId(commentId);
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          projectId: project.id,
          heading: task.heading || task.title,
          title: task.heading || task.title,
          description: task.description || "",
          stage: task.stage,
          comments: commentsJson,
          startDate: task.startDate || "",
          endDate: task.endDate || "",
          createdAt: task.createdAt,
        }),
      });
      if (res.ok) {
        setDbNotice("Sub-comment added & synced");
        setTimeout(() => setDbNotice(null), 2500);
      }
    } catch (err) {
      console.error("Failed to add sub-comment:", err);
    } finally {
      setSavingSubCommentCommentId(null);
    }
  };

  // Toggle sub-comment completion status with Live Sync to Database
  const handleToggleSubCommentCheck = async (taskId: string, commentId: string, subCommentId: string) => {
    if (isReadOnly) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const existingComments = parseComments(task.comments, task.createdAt);
    let targetCompleted = false;
    const updatedComments = existingComments.map((c) => {
      if (c.id === commentId) {
        const subs = (c.subComments || []).map((sc) => {
          if (sc.id === subCommentId) {
            targetCompleted = !sc.completed;
            return { ...sc, completed: targetCompleted };
          }
          return sc;
        });
        return { ...c, subComments: subs };
      }
      return c;
    });

    const commentsJson = JSON.stringify(updatedComments);
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, comments: commentsJson } : t
    );
    commitTasks(updatedTasks);

    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          projectId: project.id,
          heading: task.heading || task.title,
          title: task.heading || task.title,
          description: task.description || "",
          stage: task.stage,
          comments: commentsJson,
          startDate: task.startDate || "",
          endDate: task.endDate || "",
          createdAt: task.createdAt,
        }),
      });
      if (res.ok) {
        setDbNotice(targetCompleted ? "Sub-comment marked as completed" : "Sub-comment marked as incomplete");
        setTimeout(() => setDbNotice(null), 2000);
      }
    } catch (err) {
      console.error("Failed to toggle sub-comment completion in database:", err);
    }
  };

  // Delete a sub-comment with Live Sync to Database
  const handleDeleteSubComment = async (taskId: string, commentId: string, subCommentId: string) => {
    if (!canDelete) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const existingComments = parseComments(task.comments, task.createdAt);
    const updatedComments = existingComments.map((c) => {
      if (c.id === commentId) {
        return {
          ...c,
          subComments: (c.subComments || []).filter((sc) => sc.id !== subCommentId),
        };
      }
      return c;
    });

    const commentsJson = JSON.stringify(updatedComments);
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, comments: commentsJson } : t
    );
    commitTasks(updatedTasks);

    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          projectId: project.id,
          heading: task.heading || task.title,
          title: task.heading || task.title,
          description: task.description || "",
          stage: task.stage,
          comments: commentsJson,
          startDate: task.startDate || "",
          endDate: task.endDate || "",
          createdAt: task.createdAt,
        }),
      });
      setDbNotice("Sub-comment deleted & synced");
      setTimeout(() => setDbNotice(null), 2500);
    } catch (err) {
      console.error("Failed to delete sub-comment:", err);
    }
  };



  // Upload attachment for the Add/Edit form
  const handleUploadFormAttachment = async (file: File) => {
    if (isReadOnly || !file) return;

    if (!file.type.startsWith("image/")) {
      setFormAttachmentError("Only image files (JPEG, PNG, WebP, GIF, SVG) are supported.");
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setFormAttachmentError("File size exceeds 15MB limit.");
      return;
    }

    setIsUploadingFormAttachment(true);
    setFormAttachmentError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("projectId", project.id);
      if (editingTaskId) {
        formData.append("taskId", editingTaskId);
      }

      const res = await fetch("/api/tasks/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to upload image");
      }

      setFormAttachments((prev) => [...prev, data.attachment]);
    } catch (err: any) {
      console.error("Failed to upload image for form:", err);
      setFormAttachmentError(err?.message || "Failed to upload image. Please try again.");
    } finally {
      setIsUploadingFormAttachment(false);
      if (formAttachmentFileInputRef.current) {
        formAttachmentFileInputRef.current.value = "";
      }
    }
  };

  // Remove attachment from form
  const handleRemoveFormAttachment = async (fileId: string) => {
    setFormAttachments((prev) => prev.filter((a) => a.fileId !== fileId));
    try {
      await fetch(
        `/api/tasks/upload?fileId=${encodeURIComponent(fileId)}&projectId=${encodeURIComponent(project.id)}`,
        { method: "DELETE" }
      );
    } catch (err) {
      console.warn("Background file delete warning:", err);
    }
  };

  // Add a new folder to current project
  const handleAddFolder = async (folderName: string) => {
    const cleanName = folderName.trim();
    if (!cleanName || folders.includes(cleanName) || isReadOnly) return;
    const updatedFolders = [...folders, cleanName];
    setFolders(updatedFolders);
    setActiveFolder(cleanName);
    if (onUpdateProjectFolders) {
      onUpdateProjectFolders(updatedFolders);
    }
    // Live sync project to DB
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...project,
          taskFolders: updatedFolders,
        }),
      });
      setDbNotice(`Folder "${cleanName}" created`);
      setTimeout(() => setDbNotice(null), 2500);
    } catch (err) {
      console.error("Failed to sync new folder:", err);
    }
  };

  // Rename an existing folder
  const handleRenameFolder = async (oldName: string, newName: string) => {
    const cleanNew = newName.trim();
    if (!cleanNew || cleanNew === oldName || isReadOnly) return;
    const updatedFolders = folders.map((f) => (f === oldName ? cleanNew : f));
    setFolders(updatedFolders);
    if (activeFolder === oldName) setActiveFolder(cleanNew);
    if (onUpdateProjectFolders) {
      onUpdateProjectFolders(updatedFolders);
    }

    // Update all tasks in this folder
    const tasksToUpdate = tasks.filter((t) => (t.folder || "").toLowerCase() === oldName.toLowerCase());
    const updatedTasks = tasks.map((t) =>
      (t.folder || "").toLowerCase() === oldName.toLowerCase() ? { ...t, folder: cleanNew } : t
    );
    commitTasks(updatedTasks);

    // Live sync project & affected tasks
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...project,
          taskFolders: updatedFolders,
        }),
      });
      for (const t of tasksToUpdate) {
        await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...t,
            folder: cleanNew,
            projectId: project.id,
          }),
        });
      }
      setDbNotice(`Folder renamed to "${cleanNew}"`);
      setTimeout(() => setDbNotice(null), 2500);
    } catch (err) {
      console.error("Failed to rename folder:", err);
    }
  };

  // Delete a folder (tasks move to general/unassigned)
  const handleDeleteFolder = async (folderName: string) => {
    if (isReadOnly) return;
    const confirmed = confirm(
      `Are you sure you want to delete folder "${folderName}"? Tasks inside will be moved to General (Unassigned).`
    );
    if (!confirmed) return;

    const updatedFolders = folders.filter((f) => f !== folderName);
    setFolders(updatedFolders);
    if (activeFolder === folderName) setActiveFolder("all");
    if (onUpdateProjectFolders) {
      onUpdateProjectFolders(updatedFolders);
    }

    // Move tasks in this folder to "" (unassigned)
    const tasksToUpdate = tasks.filter((t) => (t.folder || "").toLowerCase() === folderName.toLowerCase());
    const updatedTasks = tasks.map((t) =>
      (t.folder || "").toLowerCase() === folderName.toLowerCase() ? { ...t, folder: "" } : t
    );
    commitTasks(updatedTasks);

    // Live sync project & affected tasks
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...project,
          taskFolders: updatedFolders,
        }),
      });
      for (const t of tasksToUpdate) {
        await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...t,
            folder: "",
            projectId: project.id,
          }),
        });
      }
      setDbNotice(`Folder "${folderName}" deleted`);
      setTimeout(() => setDbNotice(null), 2500);
    } catch (err) {
      console.error("Failed to delete folder:", err);
    }
  };

  // Move task to a different folder
  const handleChangeTaskFolder = async (taskId: string, newFolder: string) => {
    if (isReadOnly) return;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const cleanFolder = newFolder === "__general__" || newFolder === "__none__" ? "" : newFolder.trim();
    const updatedTasks = tasks.map((t) =>
      t.id === taskId ? { ...t, folder: cleanFolder } : t
    );
    commitTasks(updatedTasks);

    try {
      const res = await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          projectId: project.id,
          heading: task.heading || task.title,
          title: task.heading || task.title,
          description: task.description || "",
          stage: task.stage,
          comments: task.comments || "",
          startDate: task.startDate || "",
          endDate: task.endDate || "",
          createdAt: task.createdAt,
          folder: cleanFolder,
        }),
      });
      if (res.ok) {
        setDbNotice(`Task moved to ${cleanFolder ? `"${cleanFolder}"` : "General"}`);
        setTimeout(() => setDbNotice(null), 2500);
      }
    } catch (err) {
      console.error("Failed to update task folder:", err);
    }
  };

  // Open Form Modal for Creating a New Task
  const openCreateForm = (stagePreset?: TaskStage) => {
    if (isReadOnly) return;
    setFormMode("create");
    setEditingTaskId(null);
    setFormHeading("");
    setFormDescription("");
    setFormStatus(stagePreset || (filterStage !== "all" ? filterStage : "inprogress"));
    setFormFolder(activeFolder !== "all" && activeFolder !== "general" ? activeFolder : "");
    setIsCreatingInlineFolder(false);
    setInlineFolderInput("");
    setFormCommentsList([]);
    setFormNewComment("");
    setFormStartDate("");
    setFormEndDate("");
    setFormAttachments([]);
    setFormAttachmentError(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  // Open Form Modal for Editing an Existing Task
  const openEditForm = (task: TaskItem) => {
    if (isReadOnly) return;
    setFormMode("edit");
    setEditingTaskId(task.id);
    setFormHeading(task.heading || task.title || "");
    setFormDescription(task.description || "");
    setFormStatus(task.stage);
    setFormFolder(task.folder || "");
    setIsCreatingInlineFolder(false);
    setInlineFolderInput("");
    setFormCommentsList(parseComments(task.comments));
    setFormNewComment("");
    setFormStartDate(task.startDate || "");
    setFormEndDate(task.endDate || "");
    setFormAttachments(task.attachments || []);
    setFormAttachmentError(null);
    setFormError(null);
    setIsFormOpen(true);
  };

  // Close Form Modal
  const closeForm = () => {
    if (formSubmitting) return;
    setIsFormOpen(false);
    setFormError(null);
  };

  // Handle Form Submission: Adds to form, updates tasks table, and Live Syncs with DB
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const heading = formHeading.trim();
    if (!heading) {
      setFormError("Task heading is required.");
      if (headingInputRef.current) headingInputRef.current.focus();
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError(null);

      // Collect all comments
      const finalCommentsList = [...formCommentsList];
      if (formNewComment.trim()) {
        const now = Date.now();
        finalCommentsList.push({
          id: `c-${now}-${Math.random().toString(36).substring(2, 6)}`,
          text: formNewComment.trim(),
          createdAt: now,
          dateTime: formatFullDateTime(now),
          completed: false,
        });
      }
      const commentsSerialized = finalCommentsList.length > 0 ? JSON.stringify(finalCommentsList) : "";

      if (formMode === "create") {
        const newId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
        const newTask: TaskItem = {
          id: newId,
          projectId: project.id,
          title: heading,
          heading: heading,
          description: formDescription.trim(),
          stage: formStatus,
          comments: commentsSerialized,
          startDate: formStartDate.trim(),
          endDate: formEndDate.trim(),
          createdAt: Date.now(),
          folder: formFolder.trim(),
          attachments: formAttachments,
        };

        // 1. Optimistic UI update
        const updated = [newTask, ...tasks];
        commitTasks(updated);
        setActiveDetailTaskId(newId);
        setIsFormOpen(false);

        // 2. Live Sync with Database Table
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: newId,
            projectId: project.id,
            heading: newTask.heading,
            title: newTask.heading,
            description: newTask.description,
            stage: newTask.stage,
            comments: newTask.comments,
            startDate: newTask.startDate,
            endDate: newTask.endDate,
            createdAt: newTask.createdAt,
            folder: newTask.folder,
            attachments: formAttachments,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.task && data.task.id) {
            setTasks((prev) =>
              prev.map((t) => (t.id === newId ? { ...t, ...data.task } : t))
            );
          }
          setDbNotice("Task added & live synced with database table");
          setTimeout(() => setDbNotice(null), 3000);
        } else {
          console.error("Database task insert returned non-200:", res.status);
        }
      } else if (formMode === "edit" && editingTaskId) {
        const existingTask = tasks.find((t) => t.id === editingTaskId);
        const updatedTask: TaskItem = {
          id: editingTaskId,
          projectId: project.id,
          title: heading,
          heading: heading,
          description: formDescription.trim(),
          stage: formStatus,
          comments: commentsSerialized,
          startDate: formStartDate.trim(),
          endDate: formEndDate.trim(),
          createdAt: existingTask?.createdAt || Date.now(),
          folder: formFolder.trim(),
          attachments: formAttachments,
        };

        // 1. Optimistic UI update
        const updated = tasks.map((t) =>
          t.id === editingTaskId ? updatedTask : t
        );
        commitTasks(updated);
        setIsFormOpen(false);

        // 2. Live Sync with Database Table
        const res = await fetch("/api/tasks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: updatedTask.id,
            projectId: project.id,
            heading: updatedTask.heading,
            title: updatedTask.heading,
            description: updatedTask.description,
            stage: updatedTask.stage,
            comments: updatedTask.comments,
            startDate: updatedTask.startDate,
            endDate: updatedTask.endDate,
            createdAt: updatedTask.createdAt,
            folder: updatedTask.folder,
            attachments: formAttachments,
          }),
        });

        if (res.ok) {
          setDbNotice("Task updated & live synced with database table");
          setTimeout(() => setDbNotice(null), 3000);
        }
      }
    } catch (err) {
      console.error("Error saving task to database:", err);
      setFormError("Failed to save task to database. Please try again.");
    } finally {
      setFormSubmitting(false);
    }
  };

  // Quick toggle task completion (checkbox) with Live Sync
  const handleToggleCheck = async (id: string) => {
    if (isReadOnly) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const nextStage: TaskStage = task.stage === "completed" ? "inprogress" : "completed";
    const updated = tasks.map((t) => (t.id === id ? { ...t, stage: nextStage } : t));
    commitTasks(updated);

    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          projectId: project.id,
          heading: task.heading || task.title,
          title: task.heading || task.title,
          description: task.description || "",
          stage: nextStage,
          comments: task.comments || "",
          startDate: task.startDate || "",
          endDate: task.endDate || "",
          createdAt: task.createdAt,
        }),
      });
      setDbNotice("Status synced with database");
      setTimeout(() => setDbNotice(null), 2500);
    } catch (err) {
      console.error("Failed to update task stage in database:", err);
    }
  };

  // Change stage directly from badge dropdown with Live Sync
  const handleChangeStage = async (id: string, stage: TaskStage) => {
    if (isReadOnly) return;
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const updated = tasks.map((t) => (t.id === id ? { ...t, stage } : t));
    commitTasks(updated);

    try {
      await fetch("/api/tasks", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: task.id,
          projectId: project.id,
          heading: task.heading || task.title,
          title: task.heading || task.title,
          description: task.description || "",
          stage,
          comments: task.comments || "",
          startDate: task.startDate || "",
          endDate: task.endDate || "",
          createdAt: task.createdAt,
        }),
      });
      setDbNotice("Status synced with database");
      setTimeout(() => setDbNotice(null), 2500);
    } catch (err) {
      console.error("Failed to update task stage in database:", err);
    }
  };

  // Delete task with Live Sync
  const handleDeleteTask = async (id: string) => {
    if (!canDelete) return;
    const confirmed = confirm("Are you sure you want to delete this task?");
    if (!confirmed) return;

    const updated = tasks.filter((t) => t.id !== id);
    commitTasks(updated);
    if (activeDetailTaskId === id) {
      setActiveDetailTaskId(null);
    }

    try {
      await fetch(`/api/tasks?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      setDbNotice("Task deleted from database");
      setTimeout(() => setDbNotice(null), 2500);
    } catch (err) {
      console.error("Failed to delete task from database:", err);
    }
  };

  // Copy tasks to clipboard
  const handleCopy = () => {
    const formatted = tasksToMarkdown(tasks);
    if (!formatted) return;
    navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Manual save
  const handleManualSave = () => {
    if (isReadOnly) return;
    if (onManualSave) {
      onManualSave();
    }
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  // Clear all tasks
  const handleClearAll = async () => {
    if (!canDelete) return;
    if (tasks.length === 0) return;
    const confirmed = confirm(
      "Are you sure you want to clear all tasks for this project?"
    );
    if (confirmed) {
      for (const t of tasks) {
        try {
          await fetch(`/api/tasks?id=${encodeURIComponent(t.id)}`, {
            method: "DELETE",
          });
        } catch {}
      }
      commitTasks([]);
      setActiveDetailTaskId(null);
      setRawText("");
      onUpdateTasks("");
    }
  };

  // Switch between List, Grouped, and Read-Only Notepad mode
  const handleSwitchMode = (mode: "list" | "grouped" | "notepad") => {
    setViewMode(mode);
  };

  // Metrics
  const totalCount = tasks.length;
  const inProgressCount = tasks.filter((t) => t.stage === "inprogress").length;
  const completedCount = tasks.filter((t) => t.stage === "completed").length;
  const stoppedCount = tasks.filter((t) => t.stage === "stopped").length;

  const completedPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const inProgressPct = totalCount > 0 ? Math.round((inProgressCount / totalCount) * 100) : 0;
  const stoppedPct = totalCount > 0 ? Math.round((stoppedCount / totalCount) * 100) : 0;

  // Filtered tasks for list view
  const filteredTasks = tasks.filter((t) => {
    // 1. Folder filtering
    if (activeFolder !== "all") {
      if (activeFolder === "general") {
        if (t.folder && t.folder.trim() !== "") return false;
      } else {
        if ((t.folder || "").toLowerCase() !== activeFolder.toLowerCase()) return false;
      }
    }

    // 2. Stage filtering
    const matchesFilter = filterStage === "all" || t.stage === filterStage;

    // 3. Search filtering
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      (t.heading || t.title || "").toLowerCase().includes(query) ||
      (t.description || "").toLowerCase().includes(query) ||
      (t.folder || "").toLowerCase().includes(query) ||
      (t.comments || "").toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  // Active task for right-side slide-over details modal
  const activeDetailTask = tasks.find((t) => t.id === activeDetailTaskId);

  // Render individual task as a clean tabular table row
  const renderTaskTableRow = (task: TaskItem) => {
    const cfg = STAGE_CONFIG[task.stage];
    const taskHeading = task.heading || task.title;
    const taskComments = parseComments(task.comments);
    const hasComments = taskComments.length > 0;
    const hasTimeline = Boolean(task.startDate || task.endDate);

    return (
      <tr
        key={task.id}
        className="group border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors"
      >
        {/* Status / Checkbox */}
        <td className="py-3 px-3.5 w-12 text-center align-middle">
          <button
            type="button"
            disabled={isReadOnly}
            onClick={(e) => {
              e.stopPropagation();
              if (!isReadOnly) handleToggleCheck(task.id);
            }}
            className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all mx-auto ${
              isReadOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer active:scale-95"
            } ${
              task.stage === "completed"
                ? "bg-emerald-600 border-emerald-500 text-white shadow-sm"
                : "border-slate-600 bg-slate-800/80 hover:border-blue-400 text-transparent"
            }`}
            title={
              isReadOnly
                ? "Read only mode"
                : task.stage === "completed"
                ? "Mark as in progress"
                : "Mark as completed"
            }
            aria-label={task.stage === "completed" ? "Mark incomplete" : "Mark complete"}
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${
                task.stage === "completed" ? "scale-100" : "scale-0"
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </button>
        </td>

        {/* Heading: Clickable to open Right Drawer Modal */}
        <td className="py-3 px-3 min-w-[200px] align-middle">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveDetailTaskId(task.id)}
              className="text-left font-semibold hover:text-blue-400 transition-colors flex items-center gap-2 group/title cursor-pointer max-w-full"
              title="Click to view full task details & comments in side modal"
            >
              <span
                className={`text-sm font-semibold truncate transition-colors ${
                  task.stage === "completed"
                    ? "line-through text-slate-500"
                    : task.stage === "stopped"
                    ? "text-slate-300 group-hover/title:text-rose-400"
                    : "text-slate-100 group-hover/title:text-blue-400"
                }`}
              >
                {taskHeading}
              </span>
              <span className="opacity-0 group-hover/title:opacity-100 transition-opacity text-blue-400 text-xs shrink-0 flex items-center gap-0.5">
                <span>view</span>
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>
            {task.folder && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveFolder(task.folder!);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-950/70 border border-blue-500/30 text-blue-300 hover:bg-blue-900/80 cursor-pointer transition shrink-0"
                title={`Folder: ${task.folder}. Click to filter`}
              >
                📁 {task.folder}
              </span>
            )}
            {task.attachments && task.attachments.length > 0 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveDetailTaskId(task.id);
                }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-purple-950/70 border border-purple-500/30 text-purple-300 hover:bg-purple-900/80 cursor-pointer transition shrink-0"
                title={`${task.attachments.length} image attachment(s). Click to view.`}
              >
                <span>🖼️</span>
                <span>{task.attachments.length}</span>
              </span>
            )}
          </div>
        </td>

        {/* Comments Count Badge: Clickable to open Right Drawer Modal */}
        <td className="py-3 px-3 w-28 text-center align-middle">
          <button
            type="button"
            onClick={() => setActiveDetailTaskId(task.id)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition cursor-pointer ${
              hasComments
                ? "bg-blue-500/10 text-blue-300 border border-blue-500/30 hover:bg-blue-500/20"
                : "text-slate-500 hover:text-slate-400 hover:bg-slate-800/60 border border-transparent"
            }`}
            title={hasComments ? `${taskComments.length} comment${taskComments.length > 1 ? "s" : ""}. Click to view` : "No comments yet. Click to add"}
          >
            <svg className="w-3.5 h-3.5 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span>{taskComments.length}</span>
          </button>
        </td>

        {/* Dates / Timeline */}
        <td className="py-3 px-3 w-44 text-center align-middle">
          {hasTimeline ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] text-slate-300 font-mono">
              <svg className="w-3 h-3 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>
                {task.startDate ? task.startDate.split("-").slice(1).join("/") : "—"}
                {" → "}
                {task.endDate ? task.endDate.split("-").slice(1).join("/") : "—"}
              </span>
            </span>
          ) : (
            <span className="text-slate-600 text-xs">—</span>
          )}
        </td>

        {/* Stage Status Selector / Badge */}
        <td className="py-3 px-3 w-36 text-center align-middle">
          <div className="relative inline-block">
            <select
              value={task.stage}
              disabled={isReadOnly}
              onChange={(e) => handleChangeStage(task.id, e.target.value as TaskStage)}
              aria-label="Change task status"
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border appearance-none pr-6 outline-none transition-colors ${cfg.badgeClass} ${
                isReadOnly ? "cursor-not-allowed opacity-80" : "cursor-pointer"
              }`}
            >
              <option value="inprogress" className="bg-slate-900 text-amber-400">
                ⏳ In Progress
              </option>
              <option value="completed" className="bg-slate-900 text-emerald-400">
                ✓ Completed
              </option>
              <option value="stopped" className="bg-slate-900 text-rose-400">
                ⏹ Stopped
              </option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-current opacity-70">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </td>

        {/* Action Buttons */}
        <td className="py-3 px-3 w-28 text-right align-middle">
          <div className="flex items-center justify-end gap-1">
            {/* View Details Drawer Button */}
            <button
              type="button"
              onClick={() => setActiveDetailTaskId(task.id)}
              className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition cursor-pointer"
              title="Open task details from right side"
              aria-label="View task details"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </button>

            {/* Edit Button */}
            {canEdit && (
              <button
                type="button"
                onClick={() => openEditForm(task)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                title="Edit task form"
                aria-label="Edit task"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}

            {/* Delete Button */}
            {canDelete && (
              <button
                type="button"
                onClick={() => handleDeleteTask(task.id)}
                className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                title="Delete task"
                aria-label="Delete task"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="bg-slate-900 p-6 sm:p-8 rounded-xl shadow-md border border-slate-800 space-y-6 flex flex-col min-h-[680px] relative">
      {/* HEADER SECTION */}
      <div className="border-b border-slate-800 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Project Tasks & Notepad
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-950/60 text-blue-400 font-medium border border-blue-500/30 truncate max-w-[220px]">
              {project.name}
            </span>
            {role !== "owner" && (
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                  role === "full"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : role === "edit_no_delete"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                }`}
              >
                {role === "full"
                  ? "Full Access"
                  : role === "edit_no_delete"
                  ? "Read & Edit (No Delete)"
                  : "Read Only"}
              </span>
            )}
            {isDbLoading && (
              <span className="text-[11px] text-blue-400 animate-pulse flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Loading tasks...
              </span>
            )}
            {dbNotice && (
              <span className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                ✓ {dbNotice}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage your project tasks across the 3 stages: In Progress, Completed, and Stopped.
          </p>
        </div>

        {/* TOP ACTION BUTTONS */}
        <div className="flex items-center flex-wrap gap-2">
          {/* View Mode Toggle: List / Grouped / Notepad */}
          <div className="bg-slate-950 p-0.5 rounded-lg border border-slate-800 flex items-center">
            <button
              type="button"
              onClick={() => handleSwitchMode("list")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === "list"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="List View"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>List</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchMode("grouped")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === "grouped"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Grouped by Stage"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
                />
              </svg>
              <span>By Stage</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchMode("notepad")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition flex items-center gap-1.5 cursor-pointer ${
                viewMode === "notepad"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
              title="Raw Notepad / Markdown"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                />
              </svg>
              <span>Notepad</span>
            </button>
          </div>

          {/* Save Button */}
          {canEdit && (
            <button
              onClick={handleManualSave}
              type="button"
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition shadow-sm shadow-blue-600/30 cursor-pointer active:scale-95"
              title="Save tasks to database immediately"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
              <span>{justSaved ? "Saved!" : "Save Now"}</span>
            </button>
          )}
        </div>
      </div>

      {/* TASK FOLDERS TAB BAR */}
      <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-3 overflow-hidden">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-thin py-0.5 min-w-0 flex-1">
          {/* All Tasks Tab */}
          <button
            type="button"
            onClick={() => setActiveFolder("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeFolder === "all"
                ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
            }`}
          >
            <span>📁</span>
            <span>All Tasks</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              activeFolder === "all" ? "bg-blue-700 text-white" : "bg-slate-800 text-slate-400"
            }`}>
              {tasks.length}
            </span>
          </button>

          {/* Unassigned / General Tab (if there are unassigned tasks and at least one custom folder) */}
          {folders.length > 0 && tasks.some((t) => !t.folder || t.folder.trim() === "") && (
            <button
              type="button"
              onClick={() => setActiveFolder("general")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 shrink-0 cursor-pointer ${
                activeFolder === "general"
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent"
              }`}
            >
              <span>📁</span>
              <span>General</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-400">
                {tasks.filter((t) => !t.folder || t.folder.trim() === "").length}
              </span>
            </button>
          )}

          {/* Custom Folders */}
          {folders.map((f) => {
            const count = tasks.filter((t) => (t.folder || "").toLowerCase() === f.toLowerCase()).length;
            const isActive = activeFolder === f;
            return (
              <div
                key={f}
                className={`group flex items-center rounded-lg transition shrink-0 ${
                  isActive
                    ? "bg-blue-600/20 border border-blue-500/50 text-blue-300"
                    : "bg-slate-900/60 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setActiveFolder(f)}
                  className="px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <span>📁</span>
                  <span>{f}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isActive ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400"
                  }`}>
                    {count}
                  </span>
                </button>

                {canEdit && (
                  <div className="flex items-center pr-1.5 opacity-60 group-hover:opacity-100 transition">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFolderToRename(f);
                        setRenameFolderInput(f);
                      }}
                      title={`Rename folder "${f}"`}
                      className="p-1 hover:text-white rounded transition text-[11px] cursor-pointer"
                    >
                      ✎
                    </button>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFolder(f);
                        }}
                        title={`Delete folder "${f}"`}
                        className="p-1 hover:text-rose-400 rounded transition text-[11px] cursor-pointer"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Folder Button */}
        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setNewFolderInput("");
              setIsAddFolderModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 hover:text-white rounded-lg transition shrink-0 cursor-pointer"
            title="Create a new task folder in this project"
          >
            <span>+</span>
            <span>New Folder</span>
          </button>
        )}
      </div>

      {/* METRICS & PROGRESS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Tasks */}
        <div
          onClick={() => {
            if (viewMode === "notepad") setViewMode("list");
            setFilterStage("all");
          }}
          className={`bg-slate-950/70 border rounded-xl p-3 flex flex-col justify-between transition cursor-pointer ${
            filterStage === "all" && viewMode === "list"
              ? "border-blue-500/60 ring-1 ring-blue-500/30"
              : "border-slate-800 hover:border-slate-700"
          }`}
          title="Show All Tasks"
        >
          <span className="text-xs font-medium text-slate-400">Total Tasks</span>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-white">{totalCount}</span>
            <span className="text-[11px] text-slate-500">100%</span>
          </div>
        </div>

        {/* In Progress */}
        <div
          onClick={() => {
            if (viewMode === "notepad") setViewMode("list");
            setFilterStage((prev) => (prev === "inprogress" ? "all" : "inprogress"));
          }}
          className={`bg-slate-950/70 border rounded-xl p-3 flex flex-col justify-between transition cursor-pointer ${
            filterStage === "inprogress" && viewMode === "list"
              ? "border-amber-500/60 ring-1 ring-amber-500/30"
              : "border-slate-800 hover:border-amber-500/30"
          }`}
          title={filterStage === "inprogress" ? "Clear filter (Show all)" : "Filter by In Progress"}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="text-xs font-medium text-amber-400">In Progress</span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-amber-400">{inProgressCount}</span>
            <span className="text-[11px] text-amber-400/70">{inProgressPct}%</span>
          </div>
        </div>

        {/* Completed */}
        <div
          onClick={() => {
            if (viewMode === "notepad") setViewMode("list");
            setFilterStage((prev) => (prev === "completed" ? "all" : "completed"));
          }}
          className={`bg-slate-950/70 border rounded-xl p-3 flex flex-col justify-between transition cursor-pointer ${
            filterStage === "completed" && viewMode === "list"
              ? "border-emerald-500/60 ring-1 ring-emerald-500/30"
              : "border-slate-800 hover:border-emerald-500/30"
          }`}
          title={filterStage === "completed" ? "Clear filter (Show all)" : "Filter by Completed"}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-xs font-medium text-emerald-400">Completed</span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-emerald-400">{completedCount}</span>
            <span className="text-[11px] text-emerald-400/70">{completedPct}%</span>
          </div>
        </div>

        {/* Stopped */}
        <div
          onClick={() => {
            if (viewMode === "notepad") setViewMode("list");
            setFilterStage((prev) => (prev === "stopped" ? "all" : "stopped"));
          }}
          className={`bg-slate-950/70 border rounded-xl p-3 flex flex-col justify-between transition cursor-pointer ${
            filterStage === "stopped" && viewMode === "list"
              ? "border-rose-500/60 ring-1 ring-rose-500/30"
              : "border-slate-800 hover:border-rose-500/30"
          }`}
          title={filterStage === "stopped" ? "Clear filter (Show all)" : "Filter by Stopped"}
        >
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span className="text-xs font-medium text-rose-400">Stopped</span>
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <span className="text-xl font-bold text-rose-400">{stoppedCount}</span>
            <span className="text-[11px] text-rose-400/70">{stoppedPct}%</span>
          </div>
        </div>
      </div>

      {/* MULTI-SEGMENT PROGRESS BAR */}
      {totalCount > 0 && (
        <div className="space-y-1.5">
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800/80">
            <div
              style={{ width: `${completedPct}%` }}
              className="bg-emerald-500 transition-all duration-300"
              title={`Completed: ${completedPct}%`}
            />
            <div
              style={{ width: `${inProgressPct}%` }}
              className="bg-amber-500 transition-all duration-300"
              title={`In Progress: ${inProgressPct}%`}
            />
            <div
              style={{ width: `${stoppedPct}%` }}
              className="bg-rose-500 transition-all duration-300"
              title={`Stopped: ${stoppedPct}%`}
            />
          </div>
        </div>
      )}

      {/* NOTEPAD RAW VIEW - STRICTLY READ-ONLY */}
      {viewMode === "notepad" ? (
        <div className="flex-1 flex flex-col relative rounded-xl border border-slate-800 bg-slate-950 shadow-inner overflow-hidden">
          {/* Top Info Bar */}
          <div className="px-4 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold text-[11px]">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Read-Only
              </span>
              <span className="text-slate-400 text-xs hidden sm:inline">
                Editing is disabled in notepad view to prevent accidental task formatting loss. Use &quot;+ Add Task&quot; or Edit in List view.
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg transition border border-slate-700 cursor-pointer shadow-sm active:scale-95"
            >
              {copied ? (
                <>
                  <span className="text-emerald-400 font-bold">✓</span>
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  <span>Copy Markdown</span>
                </>
              )}
            </button>
          </div>

          <textarea
            readOnly={true}
            value={tasksToMarkdown(tasks)}
            placeholder="No tasks to display in notepad view."
            className="w-full flex-1 min-h-[460px] p-5 sm:p-6 bg-slate-950/70 text-slate-200 placeholder:text-slate-600 font-mono text-sm leading-relaxed outline-none resize-none cursor-default select-text"
            spellCheck={false}
          />
        </div>
      ) : (
        /* LIST / GROUPED VIEWS */
        <div className="flex-1 flex flex-col space-y-4">
          {/* TOP ACTION & SEARCH TOOLBAR */}
          <div className="flex items-center gap-2.5 sm:gap-3 p-2.5 sm:p-3 bg-slate-950 rounded-xl border border-slate-800">
            {/* Wider Search Input */}
            <div className="relative flex-1 min-w-0">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white rounded-lg pl-8 sm:pl-9 pr-8 py-2 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
              <div className="absolute inset-y-0 left-0 pl-2.5 sm:pl-3 flex items-center pointer-events-none text-slate-500">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-white transition cursor-pointer"
                  title="Clear search"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Add Button that opens the Form */}
            {canEdit && (
              <button
                type="button"
                onClick={() => openCreateForm()}
                className="flex items-center gap-1.5 px-4 py-2 text-xs sm:text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition shadow-sm cursor-pointer active:scale-95 flex-shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                <span>Add</span>
              </button>
            )}
          </div>

          {/* VIEW RENDERER */}
          {viewMode === "list" ? (
            /* TABULAR LIST VIEW */
            <div>
              {filteredTasks.length === 0 ? (
                <div className="py-12 px-4 text-center rounded-xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-400 space-y-3">
                  <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      {searchQuery
                        ? "No tasks match your search."
                        : filterStage === "all"
                        ? "No tasks added yet."
                        : `No ${STAGE_CONFIG[filterStage].label.toLowerCase()} tasks.`}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      Click the &quot;Add&quot; button to open the form and add your first task.
                    </p>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => openCreateForm()}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition shadow-sm cursor-pointer"
                    >
                      <span>+ Add Task</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-950/90 text-[11px] font-semibold text-slate-400 uppercase tracking-wider select-none">
                          <th className="py-3 px-3.5 w-12 text-center">Status</th>
                          <th className="py-3 px-3 min-w-[200px]">Task Heading</th>
                          <th className="py-3 px-3 w-28 text-center">Comments</th>
                          <th className="py-3 px-3 w-44 text-center">Dates</th>
                          <th className="py-3 px-3 w-36 text-center">Stage</th>
                          <th className="py-3 px-3 w-28 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60 text-xs">
                        {filteredTasks.map((task) => renderTaskTableRow(task))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* GROUPED BY STAGE VIEW */
            <div className="space-y-6">
              {(["inprogress", "completed", "stopped"] as TaskStage[]).map((stg) => {
                const stageTasks = filteredTasks.filter((t) => t.stage === stg);
                const cfg = STAGE_CONFIG[stg];

                return (
                  <div
                    key={stg}
                    className="bg-slate-950/60 rounded-xl border border-slate-800/80 p-4 space-y-3"
                  >
                    {/* Stage Header */}
                    <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                        <h3 className="text-sm font-bold text-white tracking-wide">
                          {cfg.label}
                        </h3>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badgeClass}`}>
                          {stageTasks.length}
                        </span>
                      </div>

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => openCreateForm(stg)}
                          className="text-xs text-blue-400 hover:text-blue-300 transition flex items-center gap-1 cursor-pointer font-medium"
                        >
                          <span>+ Add to {cfg.label}</span>
                        </button>
                      )}
                    </div>

                    {/* Stage Tasks List */}
                    {stageTasks.length === 0 ? (
                      <p className="text-xs text-slate-500 italic py-2">
                        No tasks currently in {cfg.label.toLowerCase()}. Click &quot;+ Add to {cfg.label}&quot; to create one.
                      </p>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/40">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse">
                            <thead>
                              <tr className="border-b border-slate-800 bg-slate-950/70 text-[10px] font-semibold text-slate-400 uppercase tracking-wider select-none">
                                <th className="py-2.5 px-3 w-12 text-center">Status</th>
                                <th className="py-2.5 px-3 min-w-[200px]">Task Heading</th>
                                <th className="py-2.5 px-3 w-28 text-center">Comments</th>
                                <th className="py-2.5 px-3 w-44 text-center">Dates</th>
                                <th className="py-2.5 px-3 w-36 text-center">Stage</th>
                                <th className="py-2.5 px-3 w-28 text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-xs">
                              {stageTasks.map((task) => renderTaskTableRow(task))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* FOOTER / STATUS BAR */}
      <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <span>
            <strong>{totalCount}</strong> total tasks
          </span>
          <span>•</span>
          <span className="text-amber-400">
            <strong>{inProgressCount}</strong> in progress
          </span>
          <span>•</span>
          <span className="text-emerald-400">
            <strong>{completedCount}</strong> completed
          </span>
          <span>•</span>
          <span className="text-rose-400">
            <strong>{stoppedCount}</strong> stopped
          </span>
        </div>

        <div className="flex items-center gap-3">
          {saveStatus === "unsaved" && (
            <span className="text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded font-medium flex items-center gap-1.5 border border-amber-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span> Unsaved changes
            </span>
          )}
          {saveStatus === "saving" && (
            <span className="text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded font-medium flex items-center gap-1.5 border border-amber-500/30">
              <span className="animate-spin text-xs">⟳</span> Saving to database...
            </span>
          )}
          {saveStatus === "saved" && (
            <span className="text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded font-medium flex items-center gap-1 border border-emerald-500/30">
              ✓ Saved to database
            </span>
          )}
          {saveStatus === "error" && (
            <span className="text-red-400 bg-red-950/40 px-2 py-0.5 rounded font-medium flex items-center gap-1 border border-red-500/30">
              ⚠ Save error
            </span>
          )}

          {canDelete && (tasks.length > 0 || rawText.trim()) && (
            <button
              onClick={handleClearAll}
              type="button"
              className="text-slate-500 hover:text-red-400 transition underline cursor-pointer ml-2"
            >
              Clear all
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ADD / EDIT TASK MODAL FORM (heading, description, status & comments)      */}
      {/* ========================================================================= */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-white tracking-tight">
                    {formMode === "create" ? "Add New Task" : "Edit Task"}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Live syncs with the database tasks table
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeForm}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body: Form */}
            <form
              onSubmit={handleFormSubmit}
              onPaste={(e) => {
                if (isReadOnly) return;
                const items = e.clipboardData?.items;
                if (!items) return;
                for (let i = 0; i < items.length; i++) {
                  if (items[i].type.startsWith("image/")) {
                    const file = items[i].getAsFile();
                    if (file) {
                      e.preventDefault();
                      handleUploadFormAttachment(file);
                      break;
                    }
                  }
                }
              }}
              className="p-6 space-y-4 overflow-y-auto flex-1"
            >
              {formError && (
                <div className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
                  <span>⚠</span>
                  <span>{formError}</span>
                </div>
              )}

              {/* 1. HEADING */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Task Heading <span className="text-rose-400">*</span></span>
                  <span className="text-[11px] text-slate-500 font-normal">Required</span>
                </label>
                <input
                  ref={headingInputRef}
                  type="text"
                  value={formHeading}
                  onChange={(e) => setFormHeading(e.target.value)}
                  placeholder="e.g. Implement Supabase database pooling"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                  required
                />
              </div>

              {/* IMAGES & ATTACHMENTS (IMAGEKIT.IO) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                    {/* <span className="text-sm">🖼️</span> */}
                    <span>Images & Attachments</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 font-semibold border border-purple-500/30">
                      {formAttachments.length}
                    </span>
                    {/* <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-mono border border-slate-700/60 hidden sm:inline-block">
                      ImageKit CDN
                    </span> */}
                  </label>
                  <span className="text-[11px] text-slate-500 font-normal">Optional</span>
                </div>

                {/* Upload Trigger Input */}
                <input
                  type="file"
                  ref={formAttachmentFileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleUploadFormAttachment(file);
                    }
                  }}
                />

                {/* Drag and Drop / Browse Card */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsFormDraggingOver(true);
                  }}
                  onDragLeave={() => setIsFormDraggingOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsFormDraggingOver(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      handleUploadFormAttachment(file);
                    }
                  }}
                  onClick={() => formAttachmentFileInputRef.current?.click()}
                  className={`p-3.5 rounded-xl border border-dashed transition text-center cursor-pointer select-none ${
                    isFormDraggingOver
                      ? "border-purple-400 bg-purple-950/40 text-purple-200"
                      : "border-slate-800 hover:border-slate-700 bg-slate-950 text-slate-400 hover:text-slate-300"
                  }`}
                >
                  <div className="flex flex-col items-center justify-center gap-1">
                    {isUploadingFormAttachment ? (
                      <div className="flex items-center gap-2 text-purple-300 py-1">
                        <span className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs font-medium">Uploading to ImageKit CDN...</span>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
                          <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span><span className="text-purple-400 hover:underline">Click to upload image</span> or drag here</span>
                        </div>
                        <span className="text-[10px] text-slate-500">
                          PNG, JPG, WebP, GIF, SVG (up to 15MB) • Or press <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 font-mono text-[9px]">Ctrl+V</kbd> to paste screenshot
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Form Attachment Error */}
                {formAttachmentError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300 flex items-center justify-between gap-2">
                    <span>⚠️ {formAttachmentError}</span>
                    <button
                      type="button"
                      onClick={() => setFormAttachmentError(null)}
                      className="text-rose-400 hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                )}

                {/* Attached Images Grid in Form */}
                {formAttachments.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                    {formAttachments.map((att) => (
                      <div
                        key={att.fileId}
                        className="group/formimg relative rounded-xl overflow-hidden bg-slate-900 border border-slate-800 hover:border-purple-500/50 transition flex flex-col"
                      >
                        <div
                          onClick={() => setLightboxAttachment(att)}
                          className="relative aspect-video w-full bg-slate-950 overflow-hidden cursor-zoom-in"
                        >
                          <img
                            src={att.thumbnailUrl || att.url}
                            alt={att.name}
                            className="w-full h-full object-cover transition-transform group-hover/formimg:scale-105"
                          />
                        </div>
                        <div className="p-2 bg-slate-950 flex items-center justify-between gap-1 text-[11px]">
                          <span className="truncate text-slate-300 flex-1" title={att.name}>
                            {att.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveFormAttachment(att.fileId)}
                            className="text-slate-500 hover:text-rose-400 p-0.5 rounded cursor-pointer transition"
                            title="Remove image"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. DESCRIPTION */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Description</span>
                  <span className="text-[11px] text-slate-500 font-normal">Optional</span>
                </label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Describe the task details, requirements, or acceptance criteria..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-y"
                />
              </div>

              {/* FOLDER / CATEGORY SELECTOR */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Folder <span className="text-slate-500 font-normal">(Optional)</span>
                  </label>
                  {!isCreatingInlineFolder && (
                    <button
                      type="button"
                      onClick={() => setIsCreatingInlineFolder(true)}
                      className="text-[11px] text-blue-400 hover:text-blue-300 font-medium cursor-pointer"
                    >
                      + New Folder
                    </button>
                  )}
                </div>

                {isCreatingInlineFolder ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoFocus
                      value={inlineFolderInput}
                      onChange={(e) => setInlineFolderInput(e.target.value)}
                      placeholder="Folder name (e.g. Backend, Frontend)..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="button"
                      disabled={!inlineFolderInput.trim()}
                      onClick={async () => {
                        const name = inlineFolderInput.trim();
                        if (name) {
                          await handleAddFolder(name);
                          setFormFolder(name);
                          setIsCreatingInlineFolder(false);
                          setInlineFolderInput("");
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition cursor-pointer"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingInlineFolder(false);
                        setInlineFolderInput("");
                      }}
                      className="px-2.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-xl cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={formFolder}
                      onChange={(e) => {
                        if (e.target.value === "__create_new__") {
                          setIsCreatingInlineFolder(true);
                        } else {
                          setFormFolder(e.target.value);
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 outline-none focus:border-blue-500 appearance-none transition cursor-pointer"
                    >
                      <option value="" className="bg-slate-900 text-slate-400">
                        📁 General (No Folder)
                      </option>
                      {folders.map((f) => (
                        <option key={f} value={f} className="bg-slate-900 text-slate-100">
                          📁 {f}
                        </option>
                      ))}
                      <option value="__create_new__" className="bg-slate-900 text-blue-400 font-semibold">
                        + Create New Folder...
                      </option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. STATUS (IN PROGRESS, COMPLETED, STOPPED) */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 block">
                  Status Stage <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {/* In Progress Radio Card */}
                  <button
                    type="button"
                    onClick={() => setFormStatus("inprogress")}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                      formStatus === "inprogress"
                        ? "bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-500/40 text-amber-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-amber-500/30"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-xs font-bold">In Progress</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">Active work</span>
                  </button>

                  {/* Completed Radio Card */}
                  <button
                    type="button"
                    onClick={() => setFormStatus("completed")}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                      formStatus === "completed"
                        ? "bg-emerald-500/15 border-emerald-500/60 ring-1 ring-emerald-500/40 text-emerald-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-emerald-500/30"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="text-xs font-bold">Completed</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">Finished</span>
                  </button>

                  {/* Stopped Radio Card */}
                  <button
                    type="button"
                    onClick={() => setFormStatus("stopped")}
                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                      formStatus === "stopped"
                        ? "bg-rose-500/15 border-rose-500/60 ring-1 ring-rose-500/40 text-rose-300"
                        : "bg-slate-950 border-slate-800 text-slate-400 hover:border-rose-500/30"
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      <span className="text-xs font-bold">Stopped</span>
                    </div>
                    <span className="text-[10px] text-slate-500 mt-1">Blocked / Paused</span>
                  </button>
                </div>
              </div>

              {/* 4. DATES: STARTING DATE & END DATE */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Starting Date</span>
                    <span className="text-[11px] text-slate-500 font-normal">Optional</span>
                  </label>
                  <input
                    type="date"
                    value={formStartDate}
                    onChange={(e) => setFormStartDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition [color-scheme:dark]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>End Date</span>
                    <span className="text-[11px] text-slate-500 font-normal">Optional</span>
                  </label>
                  <input
                    type="date"
                    value={formEndDate}
                    onChange={(e) => setFormEndDate(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* 5. COMMENTS */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Comments & Notes</span>
                  <span className="text-[11px] text-slate-500 font-normal">Optional</span>
                </label>

                {/* Existing comments in modal */}
                {formCommentsList.length > 0 && (
                  <div className="space-y-2 max-h-52 overflow-y-auto p-2 bg-slate-950/80 rounded-xl border border-slate-800">
                    {formCommentsList.map((c) => {
                      const timeInfo = formatCommentBadge(c.createdAt, c.dateTime);
                      const subComments = c.subComments || [];
                      return (
                        <div key={c.id} className="space-y-1">
                          <div
                            className={`group flex items-start justify-between gap-2.5 p-2 rounded-lg border text-xs ${
                              c.completed
                                ? "bg-slate-900/40 border-slate-800/40"
                                : "bg-slate-900 border-slate-800"
                            }`}
                          >
                            {/* Checkbox to mark comment completed */}
                            <button
                              type="button"
                              onClick={() =>
                                setFormCommentsList((prev) =>
                                  prev.map((item) =>
                                    item.id === c.id ? { ...item, completed: !item.completed } : item
                                  )
                                )
                              }
                              className={`w-4 h-4 rounded border flex items-center justify-center transition-all cursor-pointer flex-shrink-0 mt-0.5 ${
                                c.completed
                                  ? "bg-emerald-600 border-emerald-500 text-white"
                                  : "border-slate-600 bg-slate-950 hover:border-emerald-500 text-transparent"
                              }`}
                              title={c.completed ? "Mark comment as incomplete" : "Mark comment as completed"}
                            >
                              <svg className={`w-3 h-3 ${c.completed ? "scale-100" : "scale-0"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>

                            <div className="flex-1 min-w-0">
                              <p
                                onClick={() =>
                                  setFormCommentsList((prev) =>
                                    prev.map((item) =>
                                      item.id === c.id ? { ...item, completed: !item.completed } : item
                                    )
                                  )
                                }
                                className={`cursor-pointer whitespace-pre-wrap break-words leading-relaxed ${
                                  c.completed ? "line-through text-slate-500" : "text-slate-200"
                                }`}
                              >
                                {c.text}
                              </p>
                              <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400">
                                <span className="inline-flex items-center gap-1 text-blue-300 font-medium">
                                  <svg className="w-2.5 h-2.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  <span>{timeInfo.full}</span>
                                </span>
                                {c.completed && (
                                  <span className="text-emerald-400 font-medium">✓ Done</span>
                                )}
                                {subComments.length > 0 && (
                                  <span className="text-slate-500 ml-1">
                                    ({subComments.length} sub-comment{subComments.length > 1 ? "s" : ""})
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setFormCommentsList((prev) => prev.filter((item) => item.id !== c.id))}
                              className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 p-1 rounded transition cursor-pointer"
                              title="Remove comment"
                            >
                              ✕
                            </button>
                          </div>

                          {/* Sub-comments in modal */}
                          {subComments.length > 0 && (
                            <div className="ml-5 pl-2.5 border-l-2 border-blue-500/30 space-y-1">
                              {subComments.map((sc) => {
                                const scTime = formatCommentBadge(sc.createdAt, sc.dateTime);
                                return (
                                  <div
                                    key={sc.id}
                                    className={`group/sc flex items-start justify-between gap-2 p-1.5 rounded border text-[11px] ${
                                      sc.completed
                                        ? "bg-slate-900/30 border-slate-800/40 text-slate-500"
                                        : "bg-slate-900/70 border-slate-800/60 text-slate-300"
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setFormCommentsList((prev) =>
                                          prev.map((item) =>
                                            item.id === c.id
                                              ? {
                                                  ...item,
                                                  subComments: (item.subComments || []).map((sub) =>
                                                    sub.id === sc.id ? { ...sub, completed: !sub.completed } : sub
                                                  ),
                                                }
                                              : item
                                          )
                                        )
                                      }
                                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all cursor-pointer flex-shrink-0 mt-0.5 ${
                                        sc.completed
                                          ? "bg-emerald-600 border-emerald-500 text-white"
                                          : "border-slate-600 bg-slate-950 hover:border-emerald-500 text-transparent"
                                      }`}
                                      title={sc.completed ? "Mark as incomplete" : "Mark as completed"}
                                    >
                                      <svg className={`w-2.5 h-2.5 ${sc.completed ? "scale-100" : "scale-0"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                      </svg>
                                    </button>
                                    <span className={`flex-1 break-words ${sc.completed ? "line-through text-slate-500" : ""}`}>
                                      {sc.text}
                                      <span className="text-[10px] text-slate-500 ml-2">({scTime.full})</span>
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setFormCommentsList((prev) =>
                                          prev.map((item) =>
                                            item.id === c.id
                                              ? {
                                                  ...item,
                                                  subComments: (item.subComments || []).filter((sub) => sub.id !== sc.id),
                                                }
                                              : item
                                          )
                                        )
                                      }
                                      className="opacity-0 group-hover/sc:opacity-100 text-slate-500 hover:text-rose-400 p-0.5 rounded cursor-pointer"
                                      title="Remove sub-comment"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add new comment field */}
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formNewComment}
                      onChange={(e) => setFormNewComment(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey && formNewComment.trim()) {
                          e.preventDefault();
                          const now = Date.now();
                          setFormCommentsList((prev) => [
                            ...prev,
                            {
                              id: `c-${now}-${Math.random().toString(36).substring(2, 6)}`,
                              text: formNewComment.trim(),
                              createdAt: now,
                              dateTime: formatFullDateTime(now),
                            },
                          ]);
                          setFormNewComment("");
                        }
                      }}
                      placeholder={
                        formCommentsList.length > 0
                          ? "Add another comment..."
                          : "Add an initial comment..."
                      }
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                    <button
                      type="button"
                      disabled={!formNewComment.trim()}
                      onClick={() => {
                        if (formNewComment.trim()) {
                          const now = Date.now();
                          setFormCommentsList((prev) => [
                            ...prev,
                            {
                              id: `c-${now}-${Math.random().toString(36).substring(2, 6)}`,
                              text: formNewComment.trim(),
                              createdAt: now,
                              dateTime: formatFullDateTime(now),
                            },
                          ]);
                          setFormNewComment("");
                        }
                      }}
                      className="px-3.5 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 rounded-xl transition border border-slate-700 cursor-pointer disabled:cursor-not-allowed flex-shrink-0"
                    >
                      + Add
                    </button>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Press Enter or click &quot;+ Add&quot; to append multiple comments to this task.
                  </span>
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={formSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={formSubmitting || !formHeading.trim()}
                  className="px-5 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl transition shadow-sm shadow-blue-600/30 cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 active:scale-95"
                >
                  {formSubmitting ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Saving to DB...</span>
                    </>
                  ) : (
                    <span>
                      {formMode === "create" ? "Add to Tasks Table" : "Save Changes"}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE NEW FOLDER MODAL */}
      {isAddFolderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📁</span>
                <span>Create New Folder</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddFolderModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const name = newFolderInput.trim();
                if (name) {
                  await handleAddFolder(name);
                  setIsAddFolderModalOpen(false);
                  setNewFolderInput("");
                }
              }}
              className="space-y-3"
            >
              <input
                type="text"
                autoFocus
                required
                value={newFolderInput}
                onChange={(e) => setNewFolderInput(e.target.value)}
                placeholder="Folder name (e.g. Backend, Frontend)..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddFolderModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newFolderInput.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg shadow-sm transition cursor-pointer"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RENAME FOLDER MODAL */}
      {folderToRename && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-150 p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>✎</span>
                <span>Rename Folder</span>
              </h3>
              <button
                type="button"
                onClick={() => setFolderToRename(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const clean = renameFolderInput.trim();
                if (clean && folderToRename) {
                  await handleRenameFolder(folderToRename, clean);
                  setFolderToRename(null);
                }
              }}
              className="space-y-3"
            >
              <input
                type="text"
                autoFocus
                required
                value={renameFolderInput}
                onChange={(e) => setRenameFolderInput(e.target.value)}
                placeholder="New folder name..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setFolderToRename(null)}
                  className="px-3.5 py-1.5 text-xs text-slate-400 hover:text-white bg-slate-800 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!renameFolderInput.trim()}
                  className="px-4 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg shadow-sm transition cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================================= */}
      {/* RIGHT SIDE SLIDE-OVER DRAWER MODAL (Task Details & Comments)              */}
      {/* ========================================================================= */}
      {activeDetailTaskId && activeDetailTask && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setActiveDetailTaskId(null)}
          />

          {/* Slide-over Drawer Panel (Wider Dual-Window Modal) */}
          <div
            className="relative z-50 w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1440px] bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col h-full overflow-hidden animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Modal Header Bar */}
            <div className="px-6 py-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-950/60 text-blue-400 border border-blue-500/30 uppercase tracking-wider shrink-0">
                  Task Workspace
                </span>
                <span className="text-slate-600 font-light hidden sm:inline">|</span>
                <h2 className="text-sm font-semibold text-white truncate max-w-md hidden sm:block">
                  {activeDetailTask.heading || activeDetailTask.title}
                </h2>
              </div>

              {/* Close Button */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveDetailTaskId(null)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
                  title="Close (Esc)"
                  aria-label="Close modal"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Dual Window Container: Left = Task Details & Comments, Right = Project Chats */}
            <div
              ref={splitContainerRef}
              style={{ "--left-panel-width": `${drawerSplitRatio}%` } as React.CSSProperties}
              className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-0 relative"
            >
              {/* ========================================================================= */}
              {/* LEFT WINDOW: Task Details & Comments Discussion                           */}
              {/* ========================================================================= */}
              <div className="w-full lg:w-[var(--left-panel-width)] lg:shrink-0 flex flex-col h-full overflow-hidden border-b lg:border-b-0 border-slate-800 bg-slate-900">
                {/* Left Window Header */}
                <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      Task Details
                    </span>
                    <div className="relative">
                      <select
                        value={activeDetailTask.stage}
                        disabled={isReadOnly}
                        onChange={(e) =>
                          handleChangeStage(activeDetailTask.id, e.target.value as TaskStage)
                        }
                        aria-label="Change task status in drawer"
                        className={`text-xs font-semibold px-2.5 py-1 rounded-lg border appearance-none pr-6 outline-none transition-colors ${
                          STAGE_CONFIG[activeDetailTask.stage].badgeClass
                        } ${isReadOnly ? "cursor-not-allowed opacity-80" : "cursor-pointer"}`}
                      >
                        <option value="inprogress" className="bg-slate-900 text-amber-400">⏳ In Progress</option>
                        <option value="completed" className="bg-slate-900 text-emerald-400">✓ Completed</option>
                        <option value="stopped" className="bg-slate-900 text-rose-400">⏹ Stopped</option>
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-current opacity-70">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Edit, Delete */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openEditForm(activeDetailTask)}
                        className="p-1.5 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-lg transition text-xs font-medium flex items-center gap-1.5 px-2.5 cursor-pointer"
                        title="Edit task form"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                        <span>Edit</span>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          handleDeleteTask(activeDetailTask.id);
                          setActiveDetailTaskId(null);
                        }}
                        className="p-1.5 text-rose-400 hover:text-rose-300 bg-rose-950/30 hover:bg-rose-950/60 rounded-lg transition text-xs font-medium flex items-center gap-1.5 px-2.5 cursor-pointer"
                        title="Delete this task"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Left Window Body (Scrollable) */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                  {/* Task Title & Metadata Badges */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider">
                          Task Title
                        </span>
                        {activeDetailTask.stage === "completed" && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-medium border border-emerald-500/30">
                            ✓ Completed
                          </span>
                        )}
                      </div>

                      {/* Right-aligned Metadata Badges with Headings */}
                      <div className="flex items-center flex-wrap gap-2">
                        {/* Timeline Badge */}
                        <span
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs sm:text-sm text-slate-300 shadow-sm"
                          title="Task Timeline"
                        >
                          <svg className="w-4 h-4 text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
                          </svg>
                          <span className="text-slate-400 font-medium">Timeline:</span>
                          <span className="font-semibold text-slate-100">
                            {activeDetailTask.startDate || activeDetailTask.endDate
                              ? `${activeDetailTask.startDate || "—"} → ${activeDetailTask.endDate || "—"}`
                              : "No timeline"}
                          </span>
                        </span>

                        {/* Created Date Badge */}
                        <span
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs sm:text-sm text-slate-300 shadow-sm"
                          title="Created Date"
                        >
                          <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="text-slate-400 font-medium">Created:</span>
                          <span className="font-semibold text-slate-100">
                            {formatFullDateTime(Number(activeDetailTask.createdAt) || 0) || "Recently"}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Task Title Content (Read-only container like Description) */}
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 text-sm text-slate-200 font-semibold leading-relaxed whitespace-pre-wrap break-words">
                      {activeDetailTask.heading || activeDetailTask.title ? (
                        activeDetailTask.heading || activeDetailTask.title
                      ) : (
                        <span className="text-slate-500 italic font-normal">No title provided</span>
                      )}
                    </div>
                  </div>

                  {/* Task Description */}
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                      Description
                    </span>
                    <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800/90 text-sm text-slate-200 leading-relaxed whitespace-pre-wrap break-words min-h-[60px]">
                      {activeDetailTask.description ? (
                        activeDetailTask.description
                      ) : (
                        <span className="text-slate-500 italic">No description provided</span>
                      )}
                    </div>
                  </div>

                  {/* Task Attachments & Images Section (View Only in Task Workspace) */}
                  {activeDetailTask.attachments && activeDetailTask.attachments.length > 0 && (
                    <div className="space-y-3 pt-3 border-t border-slate-800/80">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <h3 className="text-sm font-bold text-white tracking-wide">
                            Images & Attachments
                          </h3>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-950/80 text-purple-300 font-semibold border border-purple-500/30">
                            {activeDetailTask.attachments.length}
                          </span>
                        </div>
                      </div>

                      {/* Image Gallery Grid (View Only) */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {activeDetailTask.attachments.map((att) => (
                          <div
                            key={att.fileId}
                            className="group/img relative rounded-xl overflow-hidden bg-slate-950 border border-slate-800 hover:border-purple-500/50 transition-all shadow-sm flex flex-col"
                          >
                            {/* Thumbnail preview */}
                            <div
                              onClick={() => setLightboxAttachment(att)}
                              className="relative aspect-video w-full bg-slate-900 overflow-hidden cursor-zoom-in flex items-center justify-center"
                            >
                              <img
                                src={att.thumbnailUrl || att.url}
                                alt={att.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-105"
                                loading="lazy"
                              />
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                <span className="p-1.5 rounded-lg bg-black/70 text-white text-xs font-medium flex items-center gap-1 shadow-md">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                                  </svg>
                                  <span>Zoom</span>
                                </span>
                              </div>
                            </div>

                            {/* Card Footer: Name, Size & Open Link */}
                            <div className="p-2.5 bg-slate-950 flex items-center justify-between gap-1.5 text-xs">
                              <div className="min-w-0 flex-1">
                                <p
                                  title={att.name}
                                  onClick={() => setLightboxAttachment(att)}
                                  className="text-[11px] font-semibold text-slate-200 truncate hover:text-purple-300 cursor-pointer"
                                >
                                  {att.name}
                                </p>
                                <span className="text-[10px] text-slate-500 block">
                                  {formatFileSize(att.size)}
                                </span>
                              </div>

                              <div className="flex items-center gap-1">
                                <a
                                  href={att.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open original high-res image in new tab"
                                  className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                  </svg>
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Comments Section */}
                  {(() => {
                    const taskComments = parseComments(activeDetailTask.comments);
                    const hasNoComments = taskComments.length === 0;

                    return (
                      <div className="space-y-3 pt-2 border-t border-slate-800/80">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-white tracking-wide">
                              Comments & Discussion
                            </h3>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-blue-400 font-semibold border border-slate-700">
                              {taskComments.length}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            {isReadOnly && (
                              <span className="text-[11px] text-amber-400 flex items-center gap-1">
                                <span>👁️</span> Read-only mode
                              </span>
                            )}

                            {canEdit && hasNoComments && !isDrawerCommentFormOpen && (
                              <button
                                type="button"
                                onClick={() => setIsDrawerCommentFormOpen(true)}
                                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition shadow-sm cursor-pointer flex items-center gap-1.5"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                </svg>
                                <span>+ Post Comment</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Add New Comment Box (shown when comments exist, or when user clicks + Post Comment) */}
                        {canEdit && (!hasNoComments || isDrawerCommentFormOpen) && (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (!drawerNewComment.trim() || isAddingDrawerComment) return;
                              setIsAddingDrawerComment(true);
                              await handleAddCommentToTask(activeDetailTask.id, drawerNewComment);
                              setDrawerNewComment("");
                              setIsAddingDrawerComment(false);
                              setIsDrawerCommentFormOpen(false);
                            }}
                            className="space-y-2 bg-slate-950/70 p-3.5 rounded-xl border border-slate-800"
                          >
                            <textarea
                              value={drawerNewComment}
                              onChange={(e) => setDrawerNewComment(e.target.value)}
                              placeholder="Write a comment or update for your team..."
                              rows={2}
                              autoFocus={hasNoComments && isDrawerCommentFormOpen}
                              className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-500">
                                Press Post Comment to save to database
                              </span>
                              <div className="flex items-center gap-2">
                                {hasNoComments && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsDrawerCommentFormOpen(false);
                                      setDrawerNewComment("");
                                    }}
                                    className="px-2.5 py-1 text-xs text-slate-400 hover:text-white transition cursor-pointer"
                                  >
                                    Cancel
                                  </button>
                                )}
                                <button
                                  type="submit"
                                  disabled={!drawerNewComment.trim() || isAddingDrawerComment}
                                  className="px-3.5 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg transition shadow-sm cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5"
                                >
                                  {isAddingDrawerComment ? (
                                    <>
                                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                      <span>Posting...</span>
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                                      </svg>
                                      <span>Post Comment</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>
                          </form>
                        )}

                        {isReadOnly && (
                          <div className="p-3 rounded-lg bg-slate-950/40 border border-slate-800 text-xs text-slate-400 italic">
                            You have read-only access to this project. You can read comments, but adding comments is restricted.
                          </div>
                        )}

                        {/* Existing Comments List */}
                        {!hasNoComments && (
                          <div className="space-y-2.5 pt-1">
                            {taskComments.map((comment) => {
                          const timeInfo = formatCommentBadge(comment.createdAt, comment.dateTime);
                          const subComments = comment.subComments || [];
                          const isReplying = replyingCommentId === comment.id;

                          return (
                            <div key={comment.id} className="space-y-1.5">
                              {/* Parent Comment Card */}
                              <div
                                className={`group/comment flex items-start justify-between gap-3 p-3 rounded-xl border text-xs transition ${
                                  comment.completed
                                    ? "bg-slate-950/40 border-slate-800/50"
                                    : "bg-slate-950/90 border-slate-800 hover:border-slate-700"
                                }`}
                              >
                                {/* Checkbox to toggle comment completion */}
                                <button
                                  type="button"
                                  disabled={isReadOnly}
                                  onClick={() => handleToggleCommentCheck(activeDetailTask.id, comment.id)}
                                  className={`w-4 h-4 rounded border flex items-center justify-center transition-all flex-shrink-0 mt-0.5 ${
                                    isReadOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                                  } ${
                                    comment.completed
                                      ? "bg-emerald-600 border-emerald-500 text-white shadow-sm"
                                      : "border-slate-600 bg-slate-900 hover:border-emerald-500 text-transparent"
                                  }`}
                                  title={
                                    isReadOnly
                                      ? "Read-only mode"
                                      : comment.completed
                                      ? "Mark comment incomplete"
                                      : "Mark comment completed"
                                  }
                                >
                                  <svg
                                    className={`w-3 h-3 transition-transform ${
                                      comment.completed ? "scale-100" : "scale-0"
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </button>

                                {/* Comment Text & Metadata */}
                                <div className="flex-1 min-w-0">
                                  <p
                                    onClick={() => {
                                      if (!isReadOnly) handleToggleCommentCheck(activeDetailTask.id, comment.id);
                                    }}
                                    className={`whitespace-pre-wrap break-words leading-relaxed text-xs transition-colors ${
                                      isReadOnly ? "cursor-default" : "cursor-pointer"
                                    } ${
                                      comment.completed
                                        ? "line-through text-slate-500"
                                        : "text-slate-200 hover:text-white"
                                    }`}
                                  >
                                    {comment.text}
                                  </p>

                                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-[11px] text-blue-300 font-medium">
                                      <svg className="w-3 h-3 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span>{timeInfo.full}</span>
                                    </span>

                                    {timeInfo.relative && (
                                      <span className="text-[10px] text-slate-500">
                                        ({timeInfo.relative})
                                      </span>
                                    )}

                                    {comment.completed && (
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-medium">
                                        ✓ Done
                                      </span>
                                    )}

                                    {/* Reply Button */}
                                    {canEdit && (
                                      <button
                                        type="button"
                                        onClick={() => setReplyingCommentId(isReplying ? null : comment.id)}
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                                          isReplying
                                            ? "bg-blue-600/20 text-blue-300 border border-blue-500/40"
                                            : "text-slate-400 hover:text-blue-300 hover:bg-slate-900 border border-transparent"
                                        }`}
                                      >
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a5 5 0 015 5v3m0 0l-3-3m3 3l3-3" />
                                        </svg>
                                        <span>{isReplying ? "Cancel" : "Reply"}</span>
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Delete Comment Button */}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteComment(activeDetailTask.id, comment.id)}
                                    className="opacity-0 group-hover/comment:opacity-100 text-slate-500 hover:text-rose-400 p-1 rounded transition cursor-pointer"
                                    title="Delete this comment"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                )}
                              </div>

                              {/* Nested Sub-Comments Thread */}
                              {(subComments.length > 0 || isReplying) && (
                                <div className="ml-6 pl-3 border-l-2 border-blue-500/30 space-y-2 pt-1 pb-1">
                                  {subComments.map((subComment) => {
                                    const subTime = formatCommentBadge(subComment.createdAt, subComment.dateTime);
                                    return (
                                      <div
                                        key={subComment.id}
                                        className={`group/subcomment flex items-start justify-between gap-2.5 p-2.5 rounded-lg border text-xs transition ${
                                          subComment.completed
                                            ? "bg-slate-950/30 border-slate-800/40"
                                            : "bg-slate-950/70 border-slate-800 hover:border-slate-700"
                                        }`}
                                      >
                                        <button
                                          type="button"
                                          disabled={isReadOnly}
                                          onClick={() => handleToggleSubCommentCheck(activeDetailTask.id, comment.id, subComment.id)}
                                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all cursor-pointer flex-shrink-0 mt-0.5 ${
                                            isReadOnly ? "cursor-not-allowed opacity-60" : "cursor-pointer"
                                          } ${
                                            subComment.completed
                                              ? "bg-emerald-600 border-emerald-500 text-white shadow-sm"
                                              : "border-slate-600 bg-slate-900 hover:border-emerald-500 text-transparent"
                                          }`}
                                        >
                                          <svg
                                            className={`w-2.5 h-2.5 transition-transform ${
                                              subComment.completed ? "scale-100" : "scale-0"
                                            }`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                          </svg>
                                        </button>

                                        <div className="flex-1 min-w-0">
                                          <p
                                            onClick={() => {
                                              if (!isReadOnly) handleToggleSubCommentCheck(activeDetailTask.id, comment.id, subComment.id);
                                            }}
                                            className={`whitespace-pre-wrap break-words leading-relaxed ${
                                              isReadOnly ? "cursor-default" : "cursor-pointer"
                                            } ${
                                              subComment.completed ? "line-through text-slate-500" : "text-slate-200"
                                            }`}
                                          >
                                            {subComment.text}
                                          </p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] text-blue-300">
                                              {subTime.full}
                                            </span>
                                          </div>
                                        </div>

                                        {canDelete && (
                                          <button
                                            type="button"
                                            onClick={() => handleDeleteSubComment(activeDetailTask.id, comment.id, subComment.id)}
                                            className="opacity-0 group-hover/subcomment:opacity-100 text-slate-500 hover:text-rose-400 p-0.5 rounded transition cursor-pointer"
                                            title="Delete this sub-comment"
                                          >
                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}

                                  {/* Sub-comment input when replying */}
                                  {isReplying && (
                                    <div className="flex items-center gap-2 pt-1">
                                      <input
                                        type="text"
                                        value={inlineSubComments[comment.id] || ""}
                                        onChange={(e) =>
                                          setInlineSubComments((prev) => ({
                                            ...prev,
                                            [comment.id]: e.target.value,
                                          }))
                                        }
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            handleAddSubComment(activeDetailTask.id, comment.id, inlineSubComments[comment.id] || "");
                                          } else if (e.key === "Escape") {
                                            setReplyingCommentId(null);
                                          }
                                        }}
                                        placeholder="Write a reply..."
                                        autoFocus
                                        className="flex-1 bg-slate-950 border border-slate-800 text-xs text-white rounded-lg px-2.5 py-1.5 placeholder:text-slate-500 focus:outline-none focus:border-blue-500 transition"
                                      />
                                      <button
                                        type="button"
                                        disabled={!(inlineSubComments[comment.id] || "").trim() || savingSubCommentCommentId === comment.id}
                                        onClick={() => handleAddSubComment(activeDetailTask.id, comment.id, inlineSubComments[comment.id] || "")}
                                        className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition cursor-pointer"
                                      >
                                        Reply
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setReplyingCommentId(null)}
                                        className="px-2 py-1.5 text-xs text-slate-400 hover:text-white"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}
                </div>

                {/* Left Window Footer */}
                <div className="px-5 py-2.5 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-500 shrink-0">
                  <span>Task ID: {activeDetailTask.id.slice(0, 10)}...</span>
                  <span className="text-[11px] text-slate-400">Task Details & Notes</span>
                </div>
              </div>

              {/* Draggable Resizer Bar (Middle line to resize Task Details and Project Chats) */}
              <div
                onMouseDown={handleSplitterMouseDown}
                onTouchStart={handleSplitterTouchStart}
                onDoubleClick={() => {
                  setDrawerSplitRatio(50);
                  try {
                    localStorage.setItem("task_workspace_split_ratio", "50");
                  } catch {
                    // ignore
                  }
                }}
                className={`hidden lg:flex w-2.5 hover:w-2.5 relative z-30 cursor-col-resize items-center justify-center bg-slate-950 hover:bg-blue-600/70 border-x border-slate-800 transition-colors shrink-0 group select-none ${
                  isDraggingSplitter ? "bg-blue-600 ring-2 ring-blue-500/40" : ""
                }`}
                title="Click and drag to resize windows • Double-click to reset (50/50)"
              >
                {/* Visual handle dots */}
                <div className="flex flex-col items-center gap-1 opacity-50 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
                  <span className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-white transition-colors" />
                  <span className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-white transition-colors" />
                  <span className="w-1 h-1 rounded-full bg-slate-400 group-hover:bg-white transition-colors" />
                </div>
              </div>

              {/* ========================================================================= */}
              {/* RIGHT WINDOW: Project Chats (Task-Specific Live Sync)                     */}
              {/* ========================================================================= */}
              <div className="flex-1 w-full lg:w-auto flex flex-col h-full overflow-hidden bg-slate-950/80 min-w-0">
                {/* Project Chats Header */}
                <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3 shrink-0">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-white tracking-wide">
                          Project Chats
                        </h3>
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Live Sync
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate">
                        Task: <span className="text-slate-300 font-medium">{activeDetailTask.heading || activeDetailTask.title}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-slate-300">
                      {taskMessages.length} {taskMessages.length === 1 ? "message" : "messages"}
                    </span>
                  </div>
                </div>

                {/* Project Chats Messages Body */}
                <div
                  ref={chatMessagesEndRef}
                  className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-950/40"
                >
                  {isLoadingChat && taskMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-2 py-12">
                      <span className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      <span>Loading task chat...</span>
                    </div>
                  ) : taskMessages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500 border border-dashed border-slate-800 rounded-2xl bg-slate-950/30 my-auto">
                      <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center mb-3 border border-blue-500/20 text-xl">
                        💬
                      </div>
                      <p className="text-sm font-semibold text-slate-300 mb-1">No chat messages yet</p>
                      <p className="text-xs text-slate-400 max-w-xs leading-relaxed">
                        Start the conversation for this task! Only members of this project can see and participate in this chat.
                      </p>
                    </div>
                  ) : (
                    taskMessages.map((msg) => {
                      const isCurrentUser = chatCurrentUserId ? msg.userId === chatCurrentUserId : false;
                      const msgTime = formatFullDateTime(Date.parse(msg.createdAt) || 0) || msg.createdAt;

                      return (
                        <div
                          key={msg.id}
                          className={`flex flex-col ${isCurrentUser ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 px-1 text-[11px] text-slate-400">
                            <span className="font-semibold text-slate-300">
                              {isCurrentUser ? "You" : msg.fullName || msg.username}
                            </span>
                            <span className="text-slate-600">•</span>
                            <span className="text-[10px] text-slate-500">
                              {msgTime}
                            </span>
                          </div>
                          <div
                            className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed whitespace-pre-wrap break-words shadow-sm ${
                              isCurrentUser
                                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-xs"
                                : "bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-bl-xs"
                            }`}
                          >
                            {msg.message}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Project Chats Input Footer */}
                <div className="p-3.5 border-t border-slate-800 bg-slate-950/90 shrink-0">
                  <form
                    onSubmit={handleSendChatMessage}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder={`Message team about this task...`}
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || isSendingChat}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
                    >
                      {isSendingChat ? (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Send</span>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </>
                      )}
                    </button>
                  </form>
                </div>

                {/* Right Window Sub-Footer */}
                <div className="px-5 py-2 border-t border-slate-900 bg-slate-950 flex items-center justify-between text-[11px] text-slate-500 shrink-0">
                  <span className="flex items-center gap-1">
                    🔒 Project Members Only
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveDetailTaskId(null)}
                    className="text-slate-400 hover:text-white transition font-medium cursor-pointer"
                  >
                    Close Drawer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE LIGHTBOX MODAL */}
      {lightboxAttachment && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setLightboxAttachment(null)}
        >
          <div
            className="relative max-w-5xl max-h-[90vh] w-full bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header */}
            <div className="px-5 py-3 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-sm font-semibold text-white truncate max-w-md">
                  {lightboxAttachment.name}
                </span>
                <span className="text-xs text-slate-400">
                  ({formatFileSize(lightboxAttachment.size)})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={lightboxAttachment.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 hover:text-white transition flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  <span>Open Full Size</span>
                </a>
                <button
                  type="button"
                  onClick={() => setLightboxAttachment(null)}
                  className="w-8 h-8 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition cursor-pointer"
                  title="Close (Esc)"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Lightbox Image Viewport */}
            <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-black/50 min-h-[300px]">
              <img
                src={lightboxAttachment.url}
                alt={lightboxAttachment.name}
                className="max-h-[75vh] w-auto max-w-full object-contain rounded-lg shadow-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
