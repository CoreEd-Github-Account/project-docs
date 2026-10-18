import type { ProjectStatusStage, StageColor } from "./types";

export const DEFAULT_STATUS_STAGES: ProjectStatusStage[] = [
  { id: "inprogress", slug: "inprogress", name: "In Progress", label: "In Progress", color: "amber", description: "Active work" },
  { id: "completed", slug: "completed", name: "Completed", label: "Completed", color: "emerald", description: "Finished" },
  { id: "stopped", slug: "stopped", name: "Stopped", label: "Stopped", color: "rose", description: "Blocked / Paused" },
];

export interface StagePresetTemplate {
  id: string;
  name: string;
  description: string;
  stages: ProjectStatusStage[];
}

export const STAGE_PRESET_TEMPLATES: StagePresetTemplate[] = [
  {
    id: "standard",
    name: "Standard (3 Stages)",
    description: "In Progress, Completed, Stopped",
    stages: [
      { id: "inprogress", slug: "inprogress", name: "In Progress", label: "In Progress", color: "amber", description: "Active work" },
      { id: "completed", slug: "completed", name: "Completed", label: "Completed", color: "emerald", description: "Finished" },
      { id: "stopped", slug: "stopped", name: "Stopped", label: "Stopped", color: "rose", description: "Blocked / Paused" },
    ],
  },
  {
    id: "kanban",
    name: "Kanban / Agile (4 Stages)",
    description: "To Do, In Progress, In Review, Done",
    stages: [
      { id: "todo", slug: "todo", name: "To Do", label: "To Do", color: "blue", description: "Ready to start" },
      { id: "inprogress", slug: "inprogress", name: "In Progress", label: "In Progress", color: "amber", description: "Actively working" },
      { id: "inreview", slug: "inreview", name: "In Review", label: "In Review", color: "purple", description: "Under inspection" },
      { id: "completed", slug: "completed", name: "Done", label: "Done", color: "emerald", description: "Completed" },
    ],
  },
  {
    id: "software",
    name: "Software Dev (5 Stages)",
    description: "Backlog, In Progress, Testing, Deployed, Blocked",
    stages: [
      { id: "backlog", slug: "backlog", name: "Backlog", label: "Backlog", color: "indigo", description: "Queued work" },
      { id: "inprogress", slug: "inprogress", name: "In Progress", label: "In Progress", color: "blue", description: "In development" },
      { id: "testing", slug: "testing", name: "QA / Testing", label: "QA / Testing", color: "cyan", description: "Verification & QA" },
      { id: "completed", slug: "completed", name: "Deployed", label: "Deployed", color: "emerald", description: "Shipped & live" },
      { id: "stopped", slug: "stopped", name: "Blocked", label: "Blocked", color: "rose", description: "Blocked / waiting" },
    ],
  },
  {
    id: "simple",
    name: "Simple (2 Stages)",
    description: "Pending, Done",
    stages: [
      { id: "inprogress", slug: "inprogress", name: "Pending", label: "Pending", color: "amber", description: "Work remaining" },
      { id: "completed", slug: "completed", name: "Done", label: "Done", color: "emerald", description: "Task completed" },
    ],
  },
];

export const QUICK_STAGE_SUGGESTIONS: Array<{
  name: string;
  label: string;
  color: StageColor;
  description?: string;
}> = [
  { name: "To Do", label: "To Do", color: "blue", description: "Ready to start" },
  { name: "In Progress", label: "In Progress", color: "amber", description: "Active work" },
  { name: "In Review", label: "In Review", color: "purple", description: "Under inspection" },
  { name: "Testing", label: "Testing", color: "cyan", description: "QA testing" },
  { name: "Completed", label: "Completed", color: "emerald", description: "Finished" },
  { name: "Stopped", label: "Stopped", color: "rose", description: "Blocked / Paused" },
  { name: "On Hold", label: "On Hold", color: "orange", description: "Temporarily paused" },
  { name: "Backlog", label: "Backlog", color: "indigo", description: "Future queued" },
];

export const AVAILABLE_STAGE_COLORS: StageColor[] = [
  "amber",
  "emerald",
  "rose",
  "blue",
  "purple",
  "cyan",
  "indigo",
  "orange",
  "teal",
  "slate",
];

export function getStageStyles(color?: StageColor) {
  switch (color) {
    case "emerald":
      return {
        badgeClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
        dotClass: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]",
        borderClass: "border-emerald-500/40",
        bgHoverClass: "hover:bg-emerald-500/10",
        activeBorder: "bg-emerald-500/15 border-emerald-500/60 ring-1 ring-emerald-500/40 text-emerald-300",
        textClass: "text-emerald-400",
        bgLight: "bg-emerald-500/20",
        ringClass: "ring-emerald-500/30 border-emerald-500/60",
      };
    case "rose":
      return {
        badgeClass: "bg-rose-500/10 text-rose-400 border-rose-500/30",
        dotClass: "bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.5)]",
        borderClass: "border-rose-500/40",
        bgHoverClass: "hover:bg-rose-500/10",
        activeBorder: "bg-rose-500/15 border-rose-500/60 ring-1 ring-rose-500/40 text-rose-300",
        textClass: "text-rose-400",
        bgLight: "bg-rose-500/20",
        ringClass: "ring-rose-500/30 border-rose-500/60",
      };
    case "blue":
      return {
        badgeClass: "bg-blue-500/10 text-blue-400 border-blue-500/30",
        dotClass: "bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.5)]",
        borderClass: "border-blue-500/40",
        bgHoverClass: "hover:bg-blue-500/10",
        activeBorder: "bg-blue-500/15 border-blue-500/60 ring-1 ring-blue-500/40 text-blue-300",
        textClass: "text-blue-400",
        bgLight: "bg-blue-500/20",
        ringClass: "ring-blue-500/30 border-blue-500/60",
      };
    case "purple":
      return {
        badgeClass: "bg-purple-500/10 text-purple-400 border-purple-500/30",
        dotClass: "bg-purple-400 shadow-[0_0_8px_rgba(192,132,252,0.5)]",
        borderClass: "border-purple-500/40",
        bgHoverClass: "hover:bg-purple-500/10",
        activeBorder: "bg-purple-500/15 border-purple-500/60 ring-1 ring-purple-500/40 text-purple-300",
        textClass: "text-purple-400",
        bgLight: "bg-purple-500/20",
        ringClass: "ring-purple-500/30 border-purple-500/60",
      };
    case "cyan":
      return {
        badgeClass: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
        dotClass: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]",
        borderClass: "border-cyan-500/40",
        bgHoverClass: "hover:bg-cyan-500/10",
        activeBorder: "bg-cyan-500/15 border-cyan-500/60 ring-1 ring-cyan-500/40 text-cyan-300",
        textClass: "text-cyan-400",
        bgLight: "bg-cyan-500/20",
        ringClass: "ring-cyan-500/30 border-cyan-500/60",
      };
    case "indigo":
      return {
        badgeClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
        dotClass: "bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]",
        borderClass: "border-indigo-500/40",
        bgHoverClass: "hover:bg-indigo-500/10",
        activeBorder: "bg-indigo-500/15 border-indigo-500/60 ring-1 ring-indigo-500/40 text-indigo-300",
        textClass: "text-indigo-400",
        bgLight: "bg-indigo-500/20",
        ringClass: "ring-indigo-500/30 border-indigo-500/60",
      };
    case "orange":
      return {
        badgeClass: "bg-orange-500/10 text-orange-400 border-orange-500/30",
        dotClass: "bg-orange-400 shadow-[0_0_8px_rgba(251,146,60,0.5)]",
        borderClass: "border-orange-500/40",
        bgHoverClass: "hover:bg-orange-500/10",
        activeBorder: "bg-orange-500/15 border-orange-500/60 ring-1 ring-orange-500/40 text-orange-300",
        textClass: "text-orange-400",
        bgLight: "bg-orange-500/20",
        ringClass: "ring-orange-500/30 border-orange-500/60",
      };
    case "teal":
      return {
        badgeClass: "bg-teal-500/10 text-teal-400 border-teal-500/30",
        dotClass: "bg-teal-400 shadow-[0_0_8px_rgba(45,212,191,0.5)]",
        borderClass: "border-teal-500/40",
        bgHoverClass: "hover:bg-teal-500/10",
        activeBorder: "bg-teal-500/15 border-teal-500/60 ring-1 ring-teal-500/40 text-teal-300",
        textClass: "text-teal-400",
        bgLight: "bg-teal-500/20",
        ringClass: "ring-teal-500/30 border-teal-500/60",
      };
    case "pink":
      return {
        badgeClass: "bg-pink-500/10 text-pink-400 border-pink-500/30",
        dotClass: "bg-pink-400 shadow-[0_0_8px_rgba(244,114,182,0.5)]",
        borderClass: "border-pink-500/40",
        bgHoverClass: "hover:bg-pink-500/10",
        activeBorder: "bg-pink-500/15 border-pink-500/60 ring-1 ring-pink-500/40 text-pink-300",
        textClass: "text-pink-400",
        bgLight: "bg-pink-500/20",
        ringClass: "ring-pink-500/30 border-pink-500/60",
      };
    case "slate":
      return {
        badgeClass: "bg-slate-500/10 text-slate-300 border-slate-500/30",
        dotClass: "bg-slate-400 shadow-[0_0_8px_rgba(148,163,184,0.5)]",
        borderClass: "border-slate-500/40",
        bgHoverClass: "hover:bg-slate-500/10",
        activeBorder: "bg-slate-500/15 border-slate-500/60 ring-1 ring-slate-500/40 text-slate-200",
        textClass: "text-slate-300",
        bgLight: "bg-slate-500/20",
        ringClass: "ring-slate-500/30 border-slate-500/60",
      };
    case "amber":
    default:
      return {
        badgeClass: "bg-amber-500/10 text-amber-400 border-amber-500/30",
        dotClass: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]",
        borderClass: "border-amber-500/40",
        bgHoverClass: "hover:bg-amber-500/10",
        activeBorder: "bg-amber-500/15 border-amber-500/60 ring-1 ring-amber-500/40 text-amber-300",
        textClass: "text-amber-400",
        bgLight: "bg-amber-500/20",
        ringClass: "ring-amber-500/30 border-amber-500/60",
      };
  }
}

export function resolveStageConfig(
  stageId: string,
  projectStages?: ProjectStatusStage[]
) {
  const stages = projectStages && projectStages.length > 0 ? projectStages : DEFAULT_STATUS_STAGES;
  const match = stages.find(
    (s) =>
      (s.id && s.id.toLowerCase() === (stageId || "").toLowerCase()) ||
      (s.slug && s.slug.toLowerCase() === (stageId || "").toLowerCase()) ||
      (s.label && s.label.toLowerCase() === (stageId || "").toLowerCase()) ||
      (s.name && s.name.toLowerCase() === (stageId || "").toLowerCase())
  ) || stages[0] || DEFAULT_STATUS_STAGES[0];

  const styles = getStageStyles(match.color);
  const slug = match.slug || match.id;
  const label = match.label || match.name || slug;

  return {
    id: match.id || slug,
    slug,
    name: label,
    label,
    color: match.color,
    description: match.description,
    badgeClass: styles.badgeClass,
    dotClass: styles.dotClass,
    borderClass: styles.borderClass,
    bgHoverClass: styles.bgHoverClass,
    activeBorder: styles.activeBorder,
    textClass: styles.textClass,
    bgLight: styles.bgLight,
    ringClass: styles.ringClass,
    styles,
  };
}
