import { Pool } from "pg";
import crypto from "crypto";
import type {
  Project,
  Section,
  Subscription,
  PasswordItem,
  User,
  UserProfile,
  SharedLink,
  TaskItem,
  TaskStage,
  TaskMessage,
  SavedPrompt,
  ProjectInvitation,
  ProjectMember,
  ProjectPermissionLevel,
  ProjectRole,
  ProjectViewTab,
  TaskNotification,
} from "./types";

let poolInstance: Pool | null = null;
let usersInitialized = false;
let projectsInitialized = false;
let tasksInitialized = false;
let taskMessagesInitialized = false;
let subscriptionsInitialized = false;
let passwordsInitialized = false;
let sharedLinksInitialized = false;
let settingsInitialized = false;
let promptsInitialized = false;
let invitationsInitialized = false;
let notificationsInitialized = false;

function resolveConnectionString(raw: string): string {
  try {
    const url = new URL(raw);
    if (url.hostname.startsWith("db.") && url.hostname.endsWith(".supabase.co")) {
      const projectRef = url.hostname.split(".")[1];
      url.hostname = "aws-0-ap-southeast-2.pooler.supabase.com";
      if (!url.username.includes(".")) {
        url.username = `${url.username}.${projectRef}`;
      }
      return url.toString();
    }
  } catch {
    const match = raw.match(/@db\.([a-z0-9]+)\.supabase\.co/);
    if (match) {
      const projectRef = match[1];
      return raw
        .replace(
          `@db.${projectRef}.supabase.co`,
          `@aws-0-ap-southeast-2.pooler.supabase.com`
        )
        .replace("postgres:", `postgres.${projectRef}:`);
    }
  }
  return raw;
}

export function getPool(): Pool {
  if (!poolInstance) {
    const rawConnectionString = process.env.DATABASE_URL;
    if (!rawConnectionString) {
      throw new Error("DATABASE_URL environment variable is missing.");
    }

    const connectionString = resolveConnectionString(rawConnectionString);

    poolInstance = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }
  return poolInstance;
}

// ==========================================
// USERS TABLE & AUTH METHODS
// ==========================================
export async function ensureUsersTableExists(): Promise<void> {
  if (usersInitialized) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      recovery_key TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
  `);
  usersInitialized = true;
}

export async function findUserByUsername(username: string): Promise<User | null> {
  await ensureUsersTableExists();
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    username: string;
    email: string | null;
    full_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    password_hash: string;
    recovery_key: string | null;
    created_at: Date | string;
  }>(
    "SELECT id, username, email, full_name, bio, avatar_url, password_hash, recovery_key, created_at FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1",
    [username.trim()]
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    username: row.username,
    email: row.email || undefined,
    fullName: row.full_name || undefined,
    bio: row.bio || undefined,
    avatarUrl: row.avatar_url || undefined,
    passwordHash: row.password_hash,
    recoveryKey: row.recovery_key || undefined,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

export async function findUserById(id: string): Promise<User | null> {
  await ensureUsersTableExists();
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    username: string;
    email: string | null;
    full_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    password_hash: string;
    recovery_key: string | null;
    created_at: Date | string;
  }>(
    "SELECT id, username, email, full_name, bio, avatar_url, password_hash, recovery_key, created_at FROM users WHERE id = $1 LIMIT 1",
    [id]
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    username: row.username,
    email: row.email || undefined,
    fullName: row.full_name || undefined,
    bio: row.bio || undefined,
    avatarUrl: row.avatar_url || undefined,
    passwordHash: row.password_hash,
    recoveryKey: row.recovery_key || undefined,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const user = await findUserById(userId);
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    fullName: user.fullName,
    bio: user.bio,
    avatarUrl: user.avatarUrl,
    recoveryKey: user.recoveryKey,
    createdAt: user.createdAt,
  };
}

export async function updateUserProfile(
  userId: string,
  updates: {
    username?: string;
    email?: string;
    fullName?: string;
    bio?: string;
    avatarUrl?: string;
    recoveryKey?: string;
    newPasswordHash?: string;
  }
): Promise<{ success: boolean; error?: string; user?: UserProfile }> {
  await ensureUsersTableExists();
  const pool = getPool();

  // 1. If username is being changed, check if it's already taken by someone else
  if (updates.username) {
    const cleanUsername = updates.username.trim();
    if (cleanUsername.length < 3) {
      return { success: false, error: "Username must be at least 3 characters long." };
    }
    const { rows: conflictRows } = await pool.query(
      "SELECT id FROM users WHERE LOWER(username) = LOWER($1) AND id != $2 LIMIT 1",
      [cleanUsername, userId]
    );
    if (conflictRows.length > 0) {
      return { success: false, error: "This username is already taken by another account." };
    }
  }

  // 2. If email is being changed, check if it's already taken by someone else
  if (updates.email && updates.email.trim()) {
    const cleanEmail = updates.email.trim();
    const { rows: emailConflicts } = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id != $2 LIMIT 1",
      [cleanEmail, userId]
    );
    if (emailConflicts.length > 0) {
      return { success: false, error: "This email address is already in use by another account." };
    }
  }

  // 3. Build dynamic update query
  const setClauses: string[] = [];
  const params: unknown[] = [userId];

  if (updates.username !== undefined) {
    params.push(updates.username.trim());
    setClauses.push(`username = $${params.length}`);
  }
  if (updates.email !== undefined) {
    params.push(updates.email.trim() || null);
    setClauses.push(`email = $${params.length}`);
  }
  if (updates.fullName !== undefined) {
    params.push(updates.fullName.trim() || null);
    setClauses.push(`full_name = $${params.length}`);
  }
  if (updates.bio !== undefined) {
    params.push(updates.bio.trim() || null);
    setClauses.push(`bio = $${params.length}`);
  }
  if (updates.avatarUrl !== undefined) {
    params.push(updates.avatarUrl.trim() || null);
    setClauses.push(`avatar_url = $${params.length}`);
  }
  if (updates.recoveryKey !== undefined) {
    params.push(updates.recoveryKey.trim() || null);
    setClauses.push(`recovery_key = $${params.length}`);
  }
  if (updates.newPasswordHash) {
    params.push(updates.newPasswordHash);
    setClauses.push(`password_hash = $${params.length}`);
  }

  if (setClauses.length === 0) {
    const current = await getUserProfile(userId);
    return { success: true, user: current || undefined };
  }

  const query = `UPDATE users SET ${setClauses.join(", ")} WHERE id = $1 RETURNING id, username, email, full_name, bio, avatar_url, recovery_key, created_at`;
  const { rows } = await pool.query<{
    id: string;
    username: string;
    email: string | null;
    full_name: string | null;
    bio: string | null;
    avatar_url: string | null;
    recovery_key: string | null;
    created_at: Date | string;
  }>(query, params);

  if (rows.length === 0) {
    return { success: false, error: "User not found." };
  }

  const row = rows[0];
  const profile: UserProfile = {
    id: row.id,
    username: row.username,
    email: row.email || undefined,
    fullName: row.full_name || undefined,
    bio: row.bio || undefined,
    avatarUrl: row.avatar_url || undefined,
    recoveryKey: row.recovery_key || undefined,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };

  return { success: true, user: profile };
}

export async function createUser(
  username: string,
  email: string | undefined,
  passwordHash: string,
  recoveryKey?: string
): Promise<User> {
  await ensureUsersTableExists();
  const pool = getPool();
  const id = crypto.randomUUID();
  const cleanUsername = username.trim();
  const cleanEmail = email?.trim() || null;

  await pool.query(
    `
    INSERT INTO users (id, username, email, password_hash, recovery_key, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
  `,
    [id, cleanUsername, cleanEmail, passwordHash, recoveryKey || null]
  );

  return {
    id,
    username: cleanUsername,
    email: cleanEmail || undefined,
    passwordHash,
    recoveryKey,
    createdAt: new Date().toISOString(),
  };
}

export async function resetUserPassword(
  identifier: string,
  newPasswordHash: string,
  recoveryKey?: string
): Promise<boolean> {
  await ensureUsersTableExists();
  const pool = getPool();

  let query =
    "UPDATE users SET password_hash = $1 WHERE (LOWER(username) = LOWER($2) OR LOWER(email) = LOWER($2))";
  const params: unknown[] = [newPasswordHash, identifier.trim()];

  if (recoveryKey) {
    query += " AND recovery_key = $3";
    params.push(recoveryKey.trim());
  }

  const result = await pool.query(query, params);
  return (result.rowCount ?? 0) > 0;
}

// ==========================================
// PROJECTS TABLE & DATA-ISOLATED CRUD
// ==========================================
export async function ensureTableExists(): Promise<void> {
  if (projectsInitialized) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      sections JSONB NOT NULL DEFAULT '[]'::jsonb,
      tasks TEXT DEFAULT '',
      user_id UUID
    );
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS user_id UUID;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS task_folders JSONB DEFAULT '[]'::jsonb;
  `);
  projectsInitialized = true;
}

export async function ensureInvitationsAndMembersTablesExist(): Promise<void> {
  if (invitationsInitialized) return;
  try {
    await ensureUsersTableExists();
    await ensureTableExists();
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS project_members (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        project_id TEXT NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        permission_level TEXT NOT NULL CHECK (permission_level IN ('read', 'edit_no_delete', 'full')),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE (project_id, user_id)
      );
      CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);

      CREATE TABLE IF NOT EXISTS project_invitations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        invited_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        invited_user_name TEXT NOT NULL,
        invited_user_email TEXT NOT NULL,
        project_id TEXT NOT NULL,
        permission_level TEXT NOT NULL CHECK (permission_level IN ('read', 'edit_no_delete', 'full')),
        token_hash TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_invitations_token ON project_invitations(token_hash);
      CREATE INDEX IF NOT EXISTS idx_invitations_project ON project_invitations(project_id);
      CREATE INDEX IF NOT EXISTS idx_invitations_email ON project_invitations(LOWER(invited_user_email));

      ALTER TABLE project_invitations ALTER COLUMN invited_user_email DROP NOT NULL;
      ALTER TABLE project_invitations ALTER COLUMN invited_user_email SET DEFAULT '';
      ALTER TABLE project_invitations ADD COLUMN IF NOT EXISTS allowed_views JSONB DEFAULT '["builder", "preview", "tasks"]'::jsonb;
      ALTER TABLE project_invitations ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false;
      ALTER TABLE project_members ADD COLUMN IF NOT EXISTS allowed_views JSONB DEFAULT '["builder", "preview", "tasks"]'::jsonb;
    `);
    invitationsInitialized = true;
  } catch (err) {
    console.warn("ensureInvitationsAndMembersTablesExist warning (continuing):", err);
    invitationsInitialized = true;
  }
}

export async function getProjectPermission(
  projectId: string,
  userId?: string | null
): Promise<ProjectRole | null> {
  if (!projectId || !userId) return null;
  await ensureTableExists();
  await ensureInvitationsAndMembersTablesExist();
  const pool = getPool();

  const { rows: projectRows } = await pool.query<{ user_id: string | null }>(
    "SELECT user_id FROM projects WHERE id = $1 LIMIT 1",
    [projectId]
  );
  if (projectRows.length === 0) return null;
  if (projectRows[0].user_id === userId) return "owner";

  const { rows: memberRows } = await pool.query<{ permission_level: ProjectPermissionLevel }>(
    "SELECT permission_level FROM project_members WHERE project_id = $1 AND user_id::text = $2 LIMIT 1",
    [projectId, String(userId)]
  );
  if (memberRows.length > 0) {
    return memberRows[0].permission_level;
  }

  return null;
}

export async function getAllProjects(userId: string): Promise<Project[]> {
  await ensureTableExists();
  await ensureInvitationsAndMembersTablesExist();
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    name: string;
    created_at: string | number;
    sections: unknown;
    tasks: string | null;
    task_folders: unknown;
    user_id: string | null;
    permission_level: ProjectPermissionLevel | null;
    allowed_views: unknown;
  }>(
    `SELECT 
       p.id, 
       p.name, 
       p.created_at, 
       p.sections, 
       p.tasks, 
       p.task_folders,
       p.user_id,
       pm.permission_level,
       pm.allowed_views
     FROM projects p
     LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id::text = $1
     WHERE p.user_id::text = $1 OR pm.user_id::text = $1
     ORDER BY p.created_at DESC`,
    [userId]
  );

  return rows.map((row) => {
    let parsedSections: Section[] = [];
    if (Array.isArray(row.sections)) {
      parsedSections = row.sections as Section[];
    } else if (typeof row.sections === "string") {
      try {
        parsedSections = JSON.parse(row.sections);
      } catch {
        parsedSections = [];
      }
    }

    let parsedFolders: string[] = [];
    if (Array.isArray(row.task_folders)) {
      parsedFolders = row.task_folders as string[];
    } else if (typeof row.task_folders === "string") {
      try {
        parsedFolders = JSON.parse(row.task_folders);
      } catch {
        parsedFolders = [];
      }
    }

    const isOwner = row.user_id === userId;
    const currentUserPermission: ProjectRole = isOwner
      ? "owner"
      : row.permission_level || "read";

    let allowedViews: ProjectViewTab[] = ["builder", "preview", "tasks"];
    if (!isOwner && row.allowed_views) {
      if (Array.isArray(row.allowed_views)) {
        allowedViews = row.allowed_views as ProjectViewTab[];
      } else if (typeof row.allowed_views === "string") {
        try {
          allowedViews = JSON.parse(row.allowed_views);
        } catch {
          allowedViews = ["builder", "preview", "tasks"];
        }
      }
    }

    return {
      id: row.id,
      name: row.name,
      createdAt: Number(row.created_at) || Date.now(),
      sections: parsedSections,
      tasks: row.tasks ?? "",
      taskFolders: parsedFolders,
      userId: row.user_id || userId,
      currentUserPermission,
      isOwner,
      allowedViews,
    };
  });
}

export async function saveProject(project: Project, userId: string): Promise<void> {
  await ensureTableExists();
  const pool = getPool();
  await pool.query(
    `
    INSERT INTO projects (id, name, created_at, sections, tasks, user_id, task_folders)
    VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7::jsonb)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      sections = EXCLUDED.sections,
      tasks = EXCLUDED.tasks,
      user_id = COALESCE(projects.user_id, EXCLUDED.user_id),
      task_folders = COALESCE(EXCLUDED.task_folders, projects.task_folders, '[]'::jsonb)
  `,
    [
      project.id,
      project.name,
      project.createdAt,
      JSON.stringify(project.sections || []),
      project.tasks || "",
      userId,
      JSON.stringify(project.taskFolders || []),
    ]
  );
}

export async function deleteProject(id: string, userId: string): Promise<void> {
  await ensureTableExists();
  const pool = getPool();
  await pool.query("DELETE FROM projects WHERE id = $1 AND user_id::text = $2", [id, String(userId)]);
}

// ==========================================
// TASKS TABLE & RELATIONAL CRUD
// ==========================================
export async function ensureTasksTableExists(): Promise<void> {
  if (tasksInitialized) return;
  try {
    await ensureTableExists();
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        user_id UUID,
        title TEXT NOT NULL,
        heading TEXT DEFAULT '',
        description TEXT DEFAULT '',
        comments TEXT DEFAULT '',
        stage TEXT NOT NULL DEFAULT 'inprogress' CHECK (stage IN ('inprogress', 'completed', 'stopped')),
        start_date TEXT DEFAULT '',
        end_date TEXT DEFAULT '',
        created_at BIGINT NOT NULL
      );
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS heading TEXT DEFAULT '';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS comments TEXT DEFAULT '';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date TEXT DEFAULT '';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS end_date TEXT DEFAULT '';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS folder TEXT DEFAULT '';
      CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks (project_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks (user_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_stage ON tasks (stage);
      CREATE INDEX IF NOT EXISTS idx_tasks_folder ON tasks (folder);
      CREATE OR REPLACE VIEW task AS SELECT * FROM tasks;
    `);
    tasksInitialized = true;
  } catch (err) {
    console.warn("ensureTasksTableExists warning (continuing):", err);
    tasksInitialized = true;
  }
}

export async function getTasksByProject(
  projectId: string,
  userId?: string | null
): Promise<TaskItem[]> {
  if (!projectId) return [];
  const safeUserId = (userId && typeof userId === "string") ? userId : undefined;
  await ensureTasksTableExists();
  await ensureInvitationsAndMembersTablesExist();

  // Verify access permission
  const perm = await getProjectPermission(projectId, userId);
  if (!perm) {
    return [];
  }

  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    project_id: string;
    user_id: string | null;
    title: string;
    heading: string | null;
    description: string | null;
    comments: string | null;
    stage: TaskStage;
    start_date: string | null;
    end_date: string | null;
    created_at: string | number;
    folder: string | null;
  }>(
    "SELECT id, project_id, user_id, title, COALESCE(NULLIF(heading, ''), title) as heading, description, comments, stage, start_date, end_date, created_at, COALESCE(folder, '') as folder FROM tasks WHERE project_id = $1 ORDER BY created_at ASC",
    [projectId]
  );

  if (rows.length > 0) {
    return rows.map((r) => ({
      id: r.id,
      projectId: r.project_id,
      userId: r.user_id || safeUserId,
      title: r.heading || r.title,
      heading: r.heading || r.title,
      description: r.description || "",
      comments: r.comments || "",
      stage: r.stage,
      startDate: r.start_date || "",
      endDate: r.end_date || "",
      createdAt: Number(r.created_at) || Date.now(),
      folder: r.folder || "",
    }));
  }

  // Fallback to legacy projects.tasks column if tasks table is empty
  const { rows: projRows } = await pool.query<{ tasks: string | null }>(
    "SELECT tasks FROM projects WHERE id = $1 LIMIT 1",
    [projectId]
  );

  if (projRows.length > 0 && projRows[0].tasks && projRows[0].tasks.trim()) {
    const rawText = projRows[0].tasks.trim();
    const lines = rawText.split("\n");
    const items: TaskItem[] = [];
    let currentStage: TaskStage = "inprogress";

    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();
      if (!trimmedLine) continue;

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
      } else if (!trimmedLine.startsWith("#") && !trimmedLine.startsWith(">") && !trimmedLine.startsWith("[")) {
        isTask = true;
      }

      if (isTask && heading) {
        items.push({
          id: `task-legacy-${i}-${projectId}`,
          projectId,
          userId: safeUserId,
          title: heading,
          heading: heading,
          description: "",
          comments: "[]",
          stage: taskStage,
          startDate: "",
          endDate: "",
          createdAt: Date.now() - (lines.length - i) * 60000,
          folder: "",
        });
      }
    }

    return items;
  }

  return [];
}

export async function saveTask(
  task: TaskItem,
  projectId: string,
  userId: string
): Promise<void> {
  await ensureTasksTableExists();
  const pool = getPool();
  const createdAt = task.createdAt || Date.now();
  const headingText = task.heading || task.title;
  const descriptionText = task.description || "";
  const commentsText = task.comments || "";
  const startDateText = task.startDate || "";
  const endDateText = task.endDate || "";
  const folderText = task.folder || "";

  await pool.query(
    `
    INSERT INTO tasks (id, project_id, user_id, title, heading, description, comments, stage, start_date, end_date, created_at, folder)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      heading = EXCLUDED.heading,
      description = EXCLUDED.description,
      comments = EXCLUDED.comments,
      stage = EXCLUDED.stage,
      start_date = EXCLUDED.start_date,
      end_date = EXCLUDED.end_date,
      folder = EXCLUDED.folder,
      project_id = EXCLUDED.project_id,
      user_id = COALESCE(tasks.user_id, EXCLUDED.user_id)
  `,
    [
      task.id,
      projectId,
      userId,
      headingText,
      headingText,
      descriptionText,
      commentsText,
      task.stage,
      startDateText,
      endDateText,
      createdAt,
      folderText,
    ]
  );
}

export async function deleteTask(id: string, userId: string): Promise<boolean> {
  await ensureTasksTableExists();
  await ensureInvitationsAndMembersTablesExist();
  const pool = getPool();

  // Find task's project
  const { rows: taskRows } = await pool.query<{ project_id: string; user_id: string | null }>(
    "SELECT project_id, user_id FROM tasks WHERE id = $1 LIMIT 1",
    [id]
  );
  if (taskRows.length === 0) return false;

  const projectId = taskRows[0].project_id;
  const perm = await getProjectPermission(projectId, userId);
  if (perm !== "owner" && perm !== "full") {
    return false; // Forbidden!
  }

  await pool.query("DELETE FROM tasks WHERE id = $1", [id]);
  return true;
}

// ==========================================
// TASK-SPECIFIC REAL-TIME CHAT METHODS
// ==========================================
export async function ensureTaskMessagesTableExists(): Promise<void> {
  if (taskMessagesInitialized) return;
  await ensureTasksTableExists();
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS task_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      task_id TEXT NOT NULL,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      username TEXT NOT NULL,
      full_name TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '👤',
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_task_messages_task_id ON task_messages(task_id);
    CREATE INDEX IF NOT EXISTS idx_task_messages_project_id ON task_messages(project_id);
    CREATE INDEX IF NOT EXISTS idx_task_messages_created_at ON task_messages(created_at ASC);
  `);
  taskMessagesInitialized = true;
}

export async function getTaskMessages(
  taskId: string,
  projectId: string,
  userId: string
): Promise<{ messages: TaskMessage[]; permission: ProjectRole } | null> {
  await ensureTaskMessagesTableExists();
  const perm = await getProjectPermission(projectId, userId);
  if (!perm) return null;

  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    task_id: string;
    project_id: string;
    user_id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    message: string;
    created_at: Date | string;
  }>(
    `SELECT id, task_id, project_id, user_id, username, full_name, avatar_url, message, created_at 
     FROM task_messages 
     WHERE task_id = $1 AND project_id = $2 
     ORDER BY created_at ASC`,
    [taskId, projectId]
  );

  return {
    permission: perm,
    messages: rows.map((r) => ({
      id: r.id,
      taskId: r.task_id,
      projectId: r.project_id,
      userId: r.user_id,
      username: r.username,
      fullName: r.full_name || undefined,
      avatarUrl: r.avatar_url || "👤",
      message: r.message,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    })),
  };
}

export async function createTaskMessage(
  taskId: string,
  projectId: string,
  userId: string,
  messageText: string
): Promise<TaskMessage | null> {
  await ensureTaskMessagesTableExists();
  const perm = await getProjectPermission(projectId, userId);
  if (!perm) return null;

  const cleanMessage = messageText.trim();
  if (!cleanMessage) return null;

  const user = await findUserById(userId);
  if (!user) return null;

  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    task_id: string;
    project_id: string;
    user_id: string;
    username: string;
    full_name: string | null;
    avatar_url: string | null;
    message: string;
    created_at: Date | string;
  }>(
    `INSERT INTO task_messages (task_id, project_id, user_id, username, full_name, avatar_url, message)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, task_id, project_id, user_id, username, full_name, avatar_url, message, created_at`,
    [
      taskId,
      projectId,
      userId,
      user.username,
      user.fullName || "",
      user.avatarUrl || "👤",
      cleanMessage,
    ]
  );

  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    id: r.id,
    taskId: r.task_id,
    projectId: r.project_id,
    userId: r.user_id,
    username: r.username,
    fullName: r.full_name || undefined,
    avatarUrl: r.avatar_url || "👤",
    message: r.message,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  };
}

// ==========================================
// INVITATION & MEMBERSHIP METHODS
// ==========================================
export function hashInvitationToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

export async function createProjectInvitation(
  invitedByUserId: string,
  projectId: string,
  invitedUserName: string,
  invitedUserEmail: string | undefined | null,
  permissionLevel: ProjectPermissionLevel,
  allowedViews: ProjectViewTab[] = ["builder", "preview", "tasks"],
  isPublic: boolean = false,
  expiresInDays: number = 7
): Promise<{ invitation: ProjectInvitation; token: string }> {
  await ensureInvitationsAndMembersTablesExist();
  const pool = getPool();

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashInvitationToken(token);
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();
  const cleanEmail = (invitedUserEmail || "").trim().toLowerCase();
  const cleanName = (invitedUserName || "").trim() || (isPublic ? "Public Invite" : "Friend");

  const { rows } = await pool.query<{
    id: string;
    invited_by_user_id: string;
    invited_user_name: string;
    invited_user_email: string | null;
    project_id: string;
    permission_level: ProjectPermissionLevel;
    allowed_views: unknown;
    status: "pending" | "accepted" | "expired" | "revoked";
    expires_at: Date | string;
    created_at: Date | string;
    is_public: boolean;
  }>(
    `INSERT INTO project_invitations (
      id, invited_by_user_id, invited_user_name, invited_user_email,
      project_id, permission_level, allowed_views, token_hash, status, expires_at, is_public, created_at, updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, 'pending', $9, $10, NOW(), NOW())
    RETURNING id, invited_by_user_id, invited_user_name, invited_user_email, project_id, permission_level, allowed_views, status, expires_at, created_at, is_public`,
    [
      id,
      invitedByUserId,
      cleanName,
      cleanEmail || "",
      projectId,
      permissionLevel,
      JSON.stringify(allowedViews && allowedViews.length > 0 ? allowedViews : ["builder", "preview", "tasks"]),
      tokenHash,
      expiresAt,
      isPublic,
    ]
  );

  const row = rows[0];
  let parsedViews: ProjectViewTab[] = ["builder", "preview", "tasks"];
  if (row.allowed_views) {
    if (Array.isArray(row.allowed_views)) {
      parsedViews = row.allowed_views as ProjectViewTab[];
    } else if (typeof row.allowed_views === "string") {
      try {
        parsedViews = JSON.parse(row.allowed_views);
      } catch {
        parsedViews = ["builder", "preview", "tasks"];
      }
    }
  }

  const invitation: ProjectInvitation = {
    id: row.id,
    invitedByUserId: row.invited_by_user_id,
    invitedUserName: row.invited_user_name,
    invitedUserEmail: row.invited_user_email || undefined,
    projectId: row.project_id,
    permissionLevel: row.permission_level,
    allowedViews: parsedViews,
    status: row.status,
    expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : String(row.expires_at),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    isPublic: Boolean(row.is_public),
  };

  return { invitation, token };
}

export async function getInvitationByToken(token: string): Promise<{
  invitation: ProjectInvitation | null;
  projectName?: string;
  inviterName?: string;
  error?: "invalid" | "expired" | "already_accepted" | "revoked";
}> {
  if (!token || !token.trim()) {
    return { invitation: null, error: "invalid" };
  }

  await ensureInvitationsAndMembersTablesExist();
  const pool = getPool();
  const tokenHash = hashInvitationToken(token);

  const { rows } = await pool.query<{
    id: string;
    invited_by_user_id: string;
    invited_user_name: string;
    invited_user_email: string;
    project_id: string;
    permission_level: ProjectPermissionLevel;
    allowed_views: unknown;
    status: "pending" | "accepted" | "expired" | "revoked";
    expires_at: Date | string;
    accepted_at: Date | string | null;
    created_at: Date | string;
    project_name: string | null;
    inviter_username: string | null;
    inviter_fullname: string | null;
    is_public: boolean;
  }>(
    `SELECT 
       pi.id, pi.invited_by_user_id, pi.invited_user_name, pi.invited_user_email,
       pi.project_id, pi.permission_level, pi.allowed_views, pi.status, pi.expires_at, pi.accepted_at, pi.created_at,
       COALESCE(pi.is_public, false) as is_public,
       p.name as project_name,
       u.username as inviter_username,
       u.full_name as inviter_fullname
     FROM project_invitations pi
     LEFT JOIN projects p ON p.id = pi.project_id
     LEFT JOIN users u ON u.id = pi.invited_by_user_id
     WHERE pi.token_hash = $1
     LIMIT 1`,
    [tokenHash]
  );

  if (rows.length === 0) {
    return { invitation: null, error: "invalid" };
  }

  const row = rows[0];
  const expiresAtDate = new Date(row.expires_at);
  const isExpired = expiresAtDate.getTime() <= Date.now();
  const isPublic = Boolean(row.is_public);

  let parsedViews: ProjectViewTab[] = ["builder", "preview", "tasks"];
  if (row.allowed_views) {
    if (Array.isArray(row.allowed_views)) {
      parsedViews = row.allowed_views as ProjectViewTab[];
    } else if (typeof row.allowed_views === "string") {
      try {
        parsedViews = JSON.parse(row.allowed_views);
      } catch {
        parsedViews = ["builder", "preview", "tasks"];
      }
    }
  }

  const invitation: ProjectInvitation = {
    id: row.id,
    invitedByUserId: row.invited_by_user_id,
    invitedUserName: row.invited_user_name,
    invitedUserEmail: row.invited_user_email,
    projectId: row.project_id,
    projectName: row.project_name || "Project",
    permissionLevel: row.permission_level,
    allowedViews: parsedViews,
    status: row.status,
    expiresAt: expiresAtDate.toISOString(),
    acceptedAt: row.accepted_at ? (row.accepted_at instanceof Date ? row.accepted_at.toISOString() : String(row.accepted_at)) : undefined,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    isPublic,
  };

  if (row.status === "accepted" && !isPublic) {
    return { invitation, projectName: row.project_name || "Project", error: "already_accepted" };
  }
  if (row.status === "revoked") {
    return { invitation, projectName: row.project_name || "Project", error: "revoked" };
  }
  if (isExpired || row.status === "expired") {
    return { invitation, projectName: row.project_name || "Project", error: "expired" };
  }

  return {
    invitation,
    projectName: row.project_name || "Project",
    inviterName: row.inviter_fullname || row.inviter_username || "A teammate",
  };
}

export async function acceptProjectInvitation(
  token: string,
  userId: string
): Promise<{ success: boolean; error?: string; projectId?: string }> {
  await ensureInvitationsAndMembersTablesExist();
  const pool = getPool();
  const tokenHash = hashInvitationToken(token);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: invRows } = await client.query<{
      id: string;
      project_id: string;
      permission_level: ProjectPermissionLevel;
      allowed_views: unknown;
      status: string;
      expires_at: Date;
      is_public: boolean;
    }>(
      "SELECT id, project_id, permission_level, allowed_views, status, expires_at, COALESCE(is_public, false) as is_public FROM project_invitations WHERE token_hash = $1 FOR UPDATE",
      [tokenHash]
    );

    if (invRows.length === 0) {
      await client.query("ROLLBACK");
      return { success: false, error: "Invitation not found." };
    }

    const inv = invRows[0];
    if (inv.status === "accepted" && !inv.is_public) {
      await client.query("ROLLBACK");
      return { success: false, error: "This invitation link has already been used." };
    }
    if (inv.status === "revoked") {
      await client.query("ROLLBACK");
      return { success: false, error: "This invitation has been revoked." };
    }
    if (new Date(inv.expires_at).getTime() <= Date.now()) {
      await client.query("ROLLBACK");
      return { success: false, error: "This invitation link has expired." };
    }

    let parsedViews = ["builder", "preview", "tasks"];
    if (inv.allowed_views) {
      if (Array.isArray(inv.allowed_views)) {
        parsedViews = inv.allowed_views as string[];
      } else if (typeof inv.allowed_views === "string") {
        try {
          parsedViews = JSON.parse(inv.allowed_views);
        } catch {
          parsedViews = ["builder", "preview", "tasks"];
        }
      }
    }

    // Insert or update member in project_members with allowed_views
    await client.query(
      `INSERT INTO project_members (project_id, user_id, permission_level, allowed_views, created_at)
       VALUES ($1, $2, $3, $4::jsonb, NOW())
       ON CONFLICT (project_id, user_id)
       DO UPDATE SET 
         permission_level = EXCLUDED.permission_level,
         allowed_views = EXCLUDED.allowed_views`,
      [inv.project_id, userId, inv.permission_level, JSON.stringify(parsedViews)]
    );

    // If it's a personal invitation, mark as accepted; if it's a public link, keep it pending (active) so others can use it too!
    if (!inv.is_public) {
      await client.query(
        `UPDATE project_invitations
         SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [inv.id]
      );
    } else {
      await client.query(
        `UPDATE project_invitations
         SET accepted_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [inv.id]
      );
    }

    await client.query("COMMIT");
    return { success: true, projectId: inv.project_id };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error accepting invitation:", err);
    return { success: false, error: "Database error while accepting invitation." };
  } finally {
    client.release();
  }
}

export async function getProjectInvitations(
  projectId: string,
  userId: string
): Promise<ProjectInvitation[]> {
  await ensureInvitationsAndMembersTablesExist();
  const perm = await getProjectPermission(projectId, userId);
  if (perm !== "owner" && perm !== "full") {
    return [];
  }

  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    invited_by_user_id: string;
    invited_user_name: string;
    invited_user_email: string;
    project_id: string;
    permission_level: ProjectPermissionLevel;
    allowed_views: unknown;
    status: "pending" | "accepted" | "expired" | "revoked";
    expires_at: Date | string;
    accepted_at: Date | string | null;
    created_at: Date | string;
    is_public: boolean;
  }>(
    `SELECT id, invited_by_user_id, invited_user_name, invited_user_email, project_id, permission_level, allowed_views, status, expires_at, accepted_at, created_at, COALESCE(is_public, false) as is_public
     FROM project_invitations
     WHERE project_id = $1
     ORDER BY created_at DESC`,
    [projectId]
  );

  return rows.map((r) => {
    let parsedViews: ProjectViewTab[] = ["builder", "preview", "tasks"];
    if (r.allowed_views) {
      if (Array.isArray(r.allowed_views)) {
        parsedViews = r.allowed_views as ProjectViewTab[];
      } else if (typeof r.allowed_views === "string") {
        try {
          parsedViews = JSON.parse(r.allowed_views);
        } catch {
          parsedViews = ["builder", "preview", "tasks"];
        }
      }
    }

    return {
      id: r.id,
      invitedByUserId: r.invited_by_user_id,
      invitedUserName: r.invited_user_name,
      invitedUserEmail: r.invited_user_email || undefined,
      projectId: r.project_id,
      permissionLevel: r.permission_level,
      allowedViews: parsedViews,
      status: r.status,
      expiresAt: r.expires_at instanceof Date ? r.expires_at.toISOString() : String(r.expires_at),
      acceptedAt: r.accepted_at ? (r.accepted_at instanceof Date ? r.accepted_at.toISOString() : String(r.accepted_at)) : undefined,
      createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      isPublic: Boolean(r.is_public),
    };
  });
}

export async function updateProjectInvitation(
  invitationId: string,
  userId: string,
  updates: {
    permissionLevel?: ProjectPermissionLevel;
    allowedViews?: ProjectViewTab[];
  }
): Promise<{ success: boolean; error?: string }> {
  await ensureInvitationsAndMembersTablesExist();
  const pool = getPool();

  const { rows: invRows } = await pool.query<{ project_id: string; invited_by_user_id: string }>(
    "SELECT project_id, invited_by_user_id FROM project_invitations WHERE id = $1 LIMIT 1",
    [invitationId]
  );
  if (invRows.length === 0) return { success: false, error: "Invitation not found." };

  const perm = await getProjectPermission(invRows[0].project_id, userId);
  if (perm !== "owner" && perm !== "full") {
    return { success: false, error: "Unauthorized to update this invitation." };
  }

  const clauses: string[] = ["updated_at = NOW()"];
  const params: any[] = [invitationId];
  let paramIdx = 2;

  if (updates.permissionLevel) {
    clauses.push(`permission_level = $${paramIdx++}`);
    params.push(updates.permissionLevel);
  }
  if (updates.allowedViews) {
    clauses.push(`allowed_views = $${paramIdx++}::jsonb`);
    params.push(JSON.stringify(updates.allowedViews));
  }

  await pool.query(
    `UPDATE project_invitations SET ${clauses.join(", ")} WHERE id = $1`,
    params
  );

  return { success: true };
}

export async function updateProjectMember(
  projectId: string,
  targetUserId: string,
  requesterUserId: string,
  updates: {
    permissionLevel?: ProjectPermissionLevel;
    allowedViews?: ProjectViewTab[];
  }
): Promise<{ success: boolean; error?: string }> {
  await ensureInvitationsAndMembersTablesExist();
  const perm = await getProjectPermission(projectId, requesterUserId);
  if (perm !== "owner" && perm !== "full") {
    return { success: false, error: "Unauthorized to update project member." };
  }

  const pool = getPool();
  const clauses: string[] = [];
  const params: any[] = [projectId, targetUserId];
  let paramIdx = 3;

  if (updates.permissionLevel) {
    clauses.push(`permission_level = $${paramIdx++}`);
    params.push(updates.permissionLevel);
  }
  if (updates.allowedViews) {
    clauses.push(`allowed_views = $${paramIdx++}::jsonb`);
    params.push(JSON.stringify(updates.allowedViews));
  }

  if (clauses.length > 0) {
    await pool.query(
      `UPDATE project_members SET ${clauses.join(", ")} WHERE project_id = $1 AND user_id = $2`,
      params
    );
  }

  return { success: true };
}

export async function removeProjectMember(
  projectId: string,
  targetUserId: string,
  requesterUserId: string
): Promise<{ success: boolean; error?: string }> {
  await ensureInvitationsAndMembersTablesExist();
  const perm = await getProjectPermission(projectId, requesterUserId);
  if (perm !== "owner" && perm !== "full") {
    return { success: false, error: "Unauthorized to remove project member." };
  }

  const pool = getPool();
  await pool.query(
    "DELETE FROM project_members WHERE project_id = $1 AND user_id = $2",
    [projectId, targetUserId]
  );

  return { success: true };
}

export async function revokeProjectInvitation(
  invitationId: string,
  requesterUserId: string
): Promise<{ success: boolean; error?: string }> {
  await ensureInvitationsAndMembersTablesExist();
  const pool = getPool();

  const { rows } = await pool.query<{ project_id: string }>(
    "SELECT project_id FROM project_invitations WHERE id = $1 LIMIT 1",
    [invitationId]
  );
  if (rows.length === 0) return { success: false, error: "Invitation not found." };

  const perm = await getProjectPermission(rows[0].project_id, requesterUserId);
  if (perm !== "owner" && perm !== "full") {
    return { success: false, error: "Unauthorized to revoke invitation." };
  }

  await pool.query(
    "UPDATE project_invitations SET status = 'revoked', updated_at = NOW() WHERE id = $1",
    [invitationId]
  );

  return { success: true };
}

export async function getProjectMemberDetails(
  projectId: string,
  requesterUserId: string
): Promise<{
  project: {
    id: string;
    name: string;
    isOwner: boolean;
    currentUserRole: ProjectRole;
  };
  owner: ProjectMember;
  members: ProjectMember[];
  invitations: ProjectInvitation[];
} | null> {
  await ensureTableExists();
  await ensureInvitationsAndMembersTablesExist();
  const pool = getPool();

  // 1. Get project and owner info
  const { rows: projRows } = await pool.query<{
    id: string;
    name: string;
    user_id: string;
    owner_username: string | null;
    owner_email: string | null;
    owner_fullname: string | null;
    owner_avatar: string | null;
  }>(
    `SELECT 
       p.id, 
       p.name, 
       p.user_id,
       u.username as owner_username,
       u.email as owner_email,
       u.full_name as owner_fullname,
       u.avatar_url as owner_avatar
     FROM projects p
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.id = $1
     LIMIT 1`,
    [projectId]
  );

  if (projRows.length === 0) return null;
  const proj = projRows[0];

  const userPerm = await getProjectPermission(projectId, requesterUserId);
  if (!userPerm) return null; // No access

  const isOwner = proj.user_id === requesterUserId;

  const ownerMember: ProjectMember = {
    id: `owner-${proj.user_id}`,
    projectId: proj.id,
    userId: proj.user_id,
    userName: proj.owner_username || "Project Owner",
    userEmail: proj.owner_email || undefined,
    fullName: proj.owner_fullname || proj.owner_username || "Project Owner",
    avatarUrl: proj.owner_avatar || undefined,
    permissionLevel: "full",
    allowedViews: ["builder", "preview", "tasks"],
    role: "owner",
    createdAt: new Date().toISOString(),
  };

  // 2. Fetch project members
  const { rows: memberRows } = await pool.query<{
    id: string;
    project_id: string;
    user_id: string;
    permission_level: ProjectPermissionLevel;
    allowed_views: unknown;
    created_at: Date | string;
    username: string | null;
    email: string | null;
    full_name: string | null;
    avatar_url: string | null;
  }>(
    `SELECT 
       pm.id, 
       pm.project_id, 
       pm.user_id, 
       pm.permission_level, 
       pm.allowed_views, 
       pm.created_at,
       u.username,
       u.email,
       u.full_name,
       u.avatar_url
     FROM project_members pm
     JOIN users u ON u.id = pm.user_id
     WHERE pm.project_id = $1
     ORDER BY pm.created_at ASC`,
    [projectId]
  );

  const members: ProjectMember[] = memberRows.map((m) => {
    let parsedViews: ProjectViewTab[] = ["builder", "preview", "tasks"];
    if (m.allowed_views) {
      if (Array.isArray(m.allowed_views)) {
        parsedViews = m.allowed_views as ProjectViewTab[];
      } else if (typeof m.allowed_views === "string") {
        try {
          parsedViews = JSON.parse(m.allowed_views);
        } catch {
          parsedViews = ["builder", "preview", "tasks"];
        }
      }
    }

    return {
      id: m.id,
      projectId: m.project_id,
      userId: m.user_id,
      permissionLevel: m.permission_level,
      allowedViews: parsedViews,
      createdAt: m.created_at instanceof Date ? m.created_at.toISOString() : String(m.created_at),
      userName: m.username || "Collaborator",
      userEmail: m.email || undefined,
      fullName: m.full_name || m.username || "Collaborator",
      avatarUrl: m.avatar_url || undefined,
      role: "member",
    };
  });

  // 3. Fetch invitations
  const invitations = await getProjectInvitations(projectId, requesterUserId);

  return {
    project: {
      id: proj.id,
      name: proj.name,
      isOwner,
      currentUserRole: userPerm,
    },
    owner: ownerMember,
    members,
    invitations,
  };
}

// ==========================================
// SUBSCRIPTIONS TABLE & DATA-ISOLATED CRUD
// ==========================================
export async function ensureSubscriptionsTableExists(): Promise<void> {
  if (subscriptionsInitialized) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      amount NUMERIC NOT NULL DEFAULT 0,
      purchase_date TEXT NOT NULL,
      renewal_date TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      user_id UUID
    );
    ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS user_id UUID;
  `);
  subscriptionsInitialized = true;
}

export async function getAllSubscriptions(userId: string): Promise<Subscription[]> {
  await ensureSubscriptionsTableExists();
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    name: string;
    amount: string | number;
    purchase_date: string;
    renewal_date: string;
    created_at: string | number;
    user_id: string | null;
  }>(
    "SELECT id, name, amount, purchase_date, renewal_date, created_at, user_id FROM subscriptions WHERE user_id = $1 ORDER BY renewal_date ASC, created_at DESC",
    [userId]
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    amount: Number(row.amount) || 0,
    purchaseDate: row.purchase_date,
    renewalDate: row.renewal_date,
    createdAt: Number(row.created_at) || Date.now(),
    userId: row.user_id || userId,
  }));
}

export async function saveSubscription(sub: Subscription, userId: string): Promise<void> {
  await ensureSubscriptionsTableExists();
  const pool = getPool();
  const createdAt = sub.createdAt || Date.now();
  await pool.query(
    `
    INSERT INTO subscriptions (id, name, amount, purchase_date, renewal_date, created_at, user_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      amount = EXCLUDED.amount,
      purchase_date = EXCLUDED.purchase_date,
      renewal_date = EXCLUDED.renewal_date,
      user_id = COALESCE(subscriptions.user_id, EXCLUDED.user_id)
  `,
    [sub.id, sub.name, sub.amount, sub.purchaseDate, sub.renewalDate, createdAt, userId]
  );
}

export async function deleteSubscription(id: string, userId: string): Promise<void> {
  await ensureSubscriptionsTableExists();
  const pool = getPool();
  await pool.query("DELETE FROM subscriptions WHERE id = $1 AND user_id = $2", [id, userId]);
}

// ==========================================
// PASSWORDS TABLE & DATA-ISOLATED CRUD
// ==========================================
export async function ensurePasswordsTableExists(): Promise<void> {
  if (passwordsInitialized) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS passwords (
      id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      url TEXT DEFAULT '',
      identifier TEXT NOT NULL,
      password TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      user_id UUID
    );
    ALTER TABLE passwords ADD COLUMN IF NOT EXISTS user_id UUID;
  `);
  passwordsInitialized = true;
}

export async function getAllPasswords(userId: string): Promise<PasswordItem[]> {
  await ensurePasswordsTableExists();
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    project_name: string;
    url: string | null;
    identifier: string;
    password: string;
    created_at: Date | string;
    user_id: string | null;
  }>(
    "SELECT id, project_name, url, identifier, password, created_at, user_id FROM passwords WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );

  return rows.map((row) => ({
    id: row.id,
    projectName: row.project_name,
    url: row.url || "",
    identifier: row.identifier,
    password: row.password,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at || new Date().toISOString()),
    userId: row.user_id || userId,
  }));
}

export async function savePassword(item: PasswordItem, userId: string): Promise<void> {
  await ensurePasswordsTableExists();
  const pool = getPool();
  const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();
  await pool.query(
    `
    INSERT INTO passwords (id, project_name, url, identifier, password, created_at, user_id)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT (id) DO UPDATE SET
      project_name = EXCLUDED.project_name,
      url = EXCLUDED.url,
      identifier = EXCLUDED.identifier,
      password = EXCLUDED.password,
      user_id = COALESCE(passwords.user_id, EXCLUDED.user_id)
  `,
    [item.id, item.projectName, item.url || "", item.identifier, item.password, createdAt, userId]
  );
}

export async function deletePassword(id: string, userId: string): Promise<void> {
  await ensurePasswordsTableExists();
  const pool = getPool();
  await pool.query("DELETE FROM passwords WHERE id = $1 AND user_id = $2", [id, userId]);
}

// ==========================================
// SHARED LINKS TABLE & 10-MIN EXPIRING CRUD
// ==========================================
export async function ensureSharedLinksTableExists(): Promise<void> {
  if (sharedLinksInitialized) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shared_links (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      project_name TEXT NOT NULL,
      content TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  sharedLinksInitialized = true;
}

export async function createSharedLink(
  projectId: string,
  projectName: string,
  content: string
): Promise<{ id: string; expiresAt: string }> {
  await ensureSharedLinksTableExists();
  const pool = getPool();
  const id = `share-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  // 10 minutes lifetime
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  await pool.query(
    `
    INSERT INTO shared_links (id, project_id, project_name, content, expires_at, created_at)
    VALUES ($1, $2, $3, $4, $5, NOW())
  `,
    [id, projectId, projectName, content, expiresAt]
  );

  return { id, expiresAt };
}

export async function getSharedLink(
  id: string
): Promise<{ link: SharedLink | null; isExpired: boolean }> {
  await ensureSharedLinksTableExists();
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    project_id: string;
    project_name: string;
    content: string;
    expires_at: Date | string;
    created_at: Date | string;
  }>(
    "SELECT id, project_id, project_name, content, expires_at, created_at FROM shared_links WHERE id = $1",
    [id]
  );

  if (rows.length === 0) {
    return { link: null, isExpired: true };
  }

  const row = rows[0];
  const expiresAtDate = new Date(row.expires_at);
  const isExpired = Date.now() > expiresAtDate.getTime();

  return {
    link: {
      id: row.id,
      projectId: row.project_id,
      projectName: row.project_name,
      content: row.content,
      expiresAt: expiresAtDate.toISOString(),
      createdAt:
        row.created_at instanceof Date
          ? row.created_at.toISOString()
          : String(row.created_at),
    },
    isExpired,
  };
}

// ==========================================
// USER SETTINGS & THEME
// ==========================================
export interface UserSettings {
  theme: string;
  customColor?: string;
}

export async function ensureSettingsTableExists(): Promise<void> {
  if (settingsInitialized) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      theme TEXT NOT NULL DEFAULT 'blue',
      custom_color TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  settingsInitialized = true;
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  await ensureSettingsTableExists();
  const pool = getPool();
  const { rows } = await pool.query<{
    theme: string;
    custom_color: string | null;
  }>(
    "SELECT theme, custom_color FROM user_settings WHERE user_id = $1 LIMIT 1",
    [userId]
  );

  if (rows.length === 0) {
    return { theme: "blue" };
  }
  return {
    theme: rows[0].theme || "blue",
    customColor: rows[0].custom_color || undefined,
  };
}

export async function saveUserSettings(
  userId: string,
  theme: string,
  customColor?: string
): Promise<UserSettings> {
  await ensureSettingsTableExists();
  const pool = getPool();
  await pool.query(
    `
    INSERT INTO user_settings (user_id, theme, custom_color, updated_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id)
    DO UPDATE SET
      theme = EXCLUDED.theme,
      custom_color = EXCLUDED.custom_color,
      updated_at = NOW();
    `,
    [userId, theme, customColor || null]
  );

  return { theme, customColor };
}

// ==========================================
// PROMPT SAVER TABLE & CRUD METHODS
// ==========================================
export async function ensurePromptsTableExists(): Promise<void> {
  if (promptsInitialized) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS prompts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      heading TEXT NOT NULL,
      description TEXT DEFAULT '',
      prompt TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_prompts_user_id ON prompts(user_id);
  `);
  promptsInitialized = true;
}

export async function getPrompts(userId: string): Promise<SavedPrompt[]> {
  await ensurePromptsTableExists();
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    heading: string;
    description: string | null;
    prompt: string;
    created_at: Date | string;
    updated_at: Date | string | null;
    user_id: string;
  }>(
    "SELECT id, heading, description, prompt, created_at, updated_at, user_id FROM prompts WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );

  return rows.map((row) => ({
    id: row.id,
    heading: row.heading,
    description: row.description || "",
    prompt: row.prompt,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at || new Date().toISOString()),
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : row.updated_at
        ? String(row.updated_at)
        : undefined,
    userId: row.user_id,
  }));
}

export async function savePrompt(
  item: { id: string; heading: string; description?: string; prompt: string; createdAt?: string },
  userId: string
): Promise<SavedPrompt> {
  await ensurePromptsTableExists();
  const pool = getPool();
  const createdAt = item.createdAt ? new Date(item.createdAt) : new Date();

  await pool.query(
    `
    INSERT INTO prompts (id, user_id, heading, description, prompt, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (id) DO UPDATE SET
      heading = EXCLUDED.heading,
      description = EXCLUDED.description,
      prompt = EXCLUDED.prompt,
      updated_at = NOW(),
      user_id = COALESCE(prompts.user_id, EXCLUDED.user_id);
    `,
    [item.id, userId, item.heading, item.description || "", item.prompt, createdAt]
  );

  return {
    id: item.id,
    heading: item.heading,
    description: item.description || "",
    prompt: item.prompt,
    createdAt: createdAt.toISOString(),
    updatedAt: new Date().toISOString(),
    userId,
  };
}

export async function deletePrompt(id: string, userId: string): Promise<void> {
  await ensurePromptsTableExists();
  const pool = getPool();
  await pool.query("DELETE FROM prompts WHERE id = $1 AND user_id = $2", [id, userId]);
}

// ==========================================
// NOTIFICATIONS TABLE & RELATIONAL LIVE SYNC
// ==========================================
export async function ensureNotificationsTableExists(): Promise<void> {
  if (notificationsInitialized) return;
  try {
    await ensureUsersTableExists();
    await ensureTableExists();
    await ensureInvitationsAndMembersTablesExist();
    const pool = getPool();
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS push_token TEXT;
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        task_id TEXT,
        actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL DEFAULT 'task_created',
        title TEXT NOT NULL DEFAULT 'New Task Created',
        message TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_project_id ON notifications(project_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read);
    `);
    notificationsInitialized = true;
  } catch (err) {
    console.warn("ensureNotificationsTableExists warning (continuing):", err);
    notificationsInitialized = true;
  }
}

export async function saveUserPushToken(userId: string, pushToken: string): Promise<void> {
  await ensureNotificationsTableExists();
  const pool = getPool();
  await pool.query("UPDATE users SET push_token = $1 WHERE id = $2", [pushToken, userId]);
}

export async function notifyProjectMembers({
  projectId,
  taskId,
  taskHeading,
  actorUserId,
  type,
  title,
  message,
}: {
  projectId: string;
  taskId?: string;
  taskHeading: string;
  actorUserId: string;
  type: string;
  title: string;
  message: string;
}): Promise<void> {
  await ensureNotificationsTableExists();
  const pool = getPool();

  // 1. Fetch project name and owner
  const { rows: projRows } = await pool.query<{ name: string; user_id: string | null }>(
    "SELECT name, user_id FROM projects WHERE id = $1 LIMIT 1",
    [projectId]
  );
  if (projRows.length === 0) return;
  const project = projRows[0];
  const projectName = project.name || "Untitled Project";

  // 2. Fetch actor info (user performing the action)
  const { rows: actorRows } = await pool.query<{ username: string; full_name: string | null }>(
    "SELECT username, full_name FROM users WHERE id = $1 LIMIT 1",
    [actorUserId]
  );
  const actorName = actorRows.length > 0
    ? (actorRows[0].full_name || actorRows[0].username || "A collaborator")
    : "A collaborator";

  // 3. Find all member user IDs in this project only (excluding the actor)
  const recipientIds = new Set<string>();

  // If project owner is another user, add them
  if (project.user_id && project.user_id !== actorUserId) {
    recipientIds.add(project.user_id);
  }

  // Collaborators in project_members
  const { rows: memberRows } = await pool.query<{ user_id: string }>(
    "SELECT user_id FROM project_members WHERE project_id = $1",
    [projectId]
  );
  for (const m of memberRows) {
    if (m.user_id !== actorUserId) {
      recipientIds.add(m.user_id);
    }
  }

  if (recipientIds.size === 0) return;

  const finalMessage = message.includes(actorName) ? message : `${actorName} ${message}`;

  for (const recipientId of recipientIds) {
    await pool.query(
      `INSERT INTO notifications (user_id, project_id, task_id, actor_id, type, title, message, is_read, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, NOW())`,
      [recipientId, projectId, taskId || null, actorUserId, type, title, finalMessage]
    );
  }

  // 4. Send Mobile Push Notifications via Expo Push Service
  try {
    const recipientArray = Array.from(recipientIds);
    const { rows: tokenRows } = await pool.query<{ push_token: string | null }>(
      `SELECT push_token FROM users WHERE id = ANY($1::uuid[]) AND push_token IS NOT NULL AND push_token != ''`,
      [recipientArray]
    );

    const pushTokens = tokenRows.map((r) => r.push_token).filter(Boolean) as string[];
    if (pushTokens.length > 0) {
      const pushPayloads = pushTokens.map((to) => ({
        to,
        sound: "default",
        title: `${projectName}: ${title}`,
        body: finalMessage,
        data: { projectId, taskId, type },
      }));

      await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(pushPayloads),
      });
    }
  } catch (pushErr) {
    console.error("Expo push notification delivery error (continuing):", pushErr);
  }
}

export async function notifyProjectMembersOnTaskCreated({
  projectId,
  taskId,
  taskHeading,
  actorUserId,
}: {
  projectId: string;
  taskId: string;
  taskHeading: string;
  actorUserId: string;
}): Promise<void> {
  await notifyProjectMembers({
    projectId,
    taskId,
    taskHeading,
    actorUserId,
    type: "task_created",
    title: "New Task Created",
    message: `created task "${taskHeading}"`,
  });
}

export async function getNotificationsByUser(userId: string): Promise<TaskNotification[]> {
  await ensureNotificationsTableExists();
  const pool = getPool();

  const { rows } = await pool.query<{
    id: string;
    user_id: string;
    project_id: string;
    task_id: string | null;
    actor_id: string;
    type: string;
    title: string;
    message: string;
    is_read: boolean;
    created_at: Date | string;
    project_name: string | null;
    actor_username: string | null;
    actor_fullname: string | null;
    actor_avatar: string | null;
  }>(
    `SELECT 
       n.id,
       n.user_id,
       n.project_id,
       n.task_id,
       n.actor_id,
       n.type,
       n.title,
       n.message,
       n.is_read,
       n.created_at,
       COALESCE(p.name, 'Untitled Project') AS project_name,
       u.username AS actor_username,
       u.full_name AS actor_fullname,
       u.avatar_url AS actor_avatar
     FROM notifications n
     LEFT JOIN projects p ON p.id = n.project_id
     LEFT JOIN users u ON u.id = n.actor_id
     WHERE n.user_id = $1
     ORDER BY n.created_at DESC
     LIMIT 150`,
    [userId]
  );

  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    projectId: r.project_id,
    projectName: r.project_name || "Untitled Project",
    taskId: r.task_id || undefined,
    taskHeading: r.title,
    actorId: r.actor_id,
    actorName: r.actor_username || "Collaborator",
    actorFullName: r.actor_fullname || r.actor_username || "Collaborator",
    actorAvatar: r.actor_avatar || undefined,
    type: r.type,
    title: r.title,
    message: r.message,
    isRead: Boolean(r.is_read),
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
  }));
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  await ensureNotificationsTableExists();
  const pool = getPool();
  const { rows } = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text as count FROM notifications WHERE user_id = $1 AND is_read = false",
    [userId]
  );
  return parseInt(rows[0]?.count || "0", 10);
}

export async function markNotificationRead(id: string, userId: string): Promise<boolean> {
  await ensureNotificationsTableExists();
  const pool = getPool();
  const res = await pool.query(
    "UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function markNotificationUnread(id: string, userId: string): Promise<boolean> {
  await ensureNotificationsTableExists();
  const pool = getPool();
  const res = await pool.query(
    "UPDATE notifications SET is_read = false WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  await ensureNotificationsTableExists();
  const pool = getPool();
  await pool.query(
    "UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false",
    [userId]
  );
}

export async function deleteNotification(id: string, userId: string): Promise<boolean> {
  await ensureNotificationsTableExists();
  const pool = getPool();
  const res = await pool.query(
    "DELETE FROM notifications WHERE id = $1 AND user_id = $2",
    [id, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function clearAllNotifications(userId: string): Promise<void> {
  await ensureNotificationsTableExists();
  const pool = getPool();
  await pool.query(
    "DELETE FROM notifications WHERE user_id = $1",
    [userId]
  );
}


