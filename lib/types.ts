export interface Section {
  id: number;
  heading: string;
  content: string;
}

export type StageColor =
  | "amber"
  | "emerald"
  | "rose"
  | "blue"
  | "purple"
  | "cyan"
  | "indigo"
  | "teal"
  | "orange"
  | "slate"
  | "pink";

export interface ProjectStatusStage {
  id: string;
  name?: string;
  label?: string;
  slug?: string;
  color: StageColor;
  description?: string;
  isDefault?: boolean;
}

export type TaskStage = "completed" | "inprogress" | "stopped" | string;

export interface TaskSubComment {
  id: string;
  text: string;
  createdAt: number;
  dateTime?: string;
  completed?: boolean;
}

export interface TaskComment {
  id: string;
  text: string;
  createdAt: number;
  dateTime?: string;
  completed?: boolean;
  subComments?: TaskSubComment[];
}

export interface TaskAttachment {
  fileId: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  size?: number;
  filePath?: string;
  fileType?: "image" | "audio" | "file";
  createdAt: number;
}

export interface TaskVoiceNote {
  fileId: string;
  name: string;
  url: string;
  size?: number;
  duration?: number;
  createdAt: number;
}

export interface TaskItem {
  id: string;
  title: string;
  heading?: string;
  description?: string;
  stage: TaskStage;
  comments?: string;
  attachments?: TaskAttachment[];
  voiceNote?: TaskVoiceNote | null;
  startDate?: string;
  endDate?: string;
  createdAt?: number;
  projectId?: string;
  userId?: string;
  folder?: string;
}

export interface TaskMessage {
  id: string;
  taskId: string;
  projectId: string;
  userId: string;
  username: string;
  fullName?: string;
  avatarUrl?: string;
  message: string;
  createdAt: string;
  attachment?: TaskAttachment;
}

export type ProjectPermissionLevel = "read" | "edit_no_delete" | "full";
export type ProjectRole = "owner" | ProjectPermissionLevel;
export type ProjectViewTab = "builder" | "preview" | "tasks";

export interface Project {
  id: string;
  name: string;
  createdAt: number;
  sections: Section[];
  tasks?: string;
  userId?: string;
  currentUserPermission?: ProjectRole;
  isOwner?: boolean;
  allowedViews?: ProjectViewTab[];
  taskFolders?: string[];
  statusStages?: ProjectStatusStage[];
}

export interface ProjectInvitation {
  id: string;
  invitedByUserId: string;
  invitedUserName: string;
  invitedUserEmail?: string;
  projectId: string;
  projectName?: string;
  permissionLevel: ProjectPermissionLevel;
  allowedViews?: ProjectViewTab[];
  status: "pending" | "accepted" | "expired" | "revoked";
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
  isPublic?: boolean;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  permissionLevel: ProjectPermissionLevel;
  allowedViews?: ProjectViewTab[];
  createdAt: string;
  userEmail?: string;
  userName?: string;
  fullName?: string;
  avatarUrl?: string;
  role?: "owner" | "member";
}


export interface Subscription {
  id: string;
  name: string;
  amount: number;
  purchaseDate: string; // YYYY-MM-DD
  renewalDate: string;  // YYYY-MM-DD
  createdAt?: number;
  userId?: string;
}

export interface PasswordItem {
  id: string;
  projectName: string;
  url: string;
  identifier: string; // ID / Username / Email
  password: string;   // Saved in plain text
  createdAt: string;
  userId?: string;
}

export interface User {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
  passwordHash: string;
  recoveryKey?: string;
  createdAt: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email?: string;
  fullName?: string;
  bio?: string;
  avatarUrl?: string;
  recoveryKey?: string;
  createdAt: string;
}

export interface SharedLink {
  id: string;
  projectId: string;
  projectName: string;
  content: string;
  expiresAt: string;
  createdAt: string;
}

export interface SavedPrompt {
  id: string;
  heading: string;
  description: string;
  prompt: string;
  createdAt: string;
  updatedAt?: string;
  userId?: string;
}

export interface TaskNotification {
  id: string;
  userId: string;
  projectId: string;
  projectName?: string;
  taskId?: string;
  taskHeading?: string;
  actorId: string;
  actorName?: string;
  actorFullName?: string;
  actorAvatar?: string;
  type: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

