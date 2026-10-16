import { Pool } from "pg";
import crypto from "crypto";
import type { Project, Section, Subscription, PasswordItem, User, SharedLink } from "./types";

let poolInstance: Pool | null = null;
let usersInitialized = false;
let projectsInitialized = false;
let subscriptionsInitialized = false;
let passwordsInitialized = false;
let sharedLinksInitialized = false;

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
    password_hash: string;
    recovery_key: string | null;
    created_at: Date | string;
  }>(
    "SELECT id, username, email, password_hash, recovery_key, created_at FROM users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1",
    [username.trim()]
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    username: row.username,
    email: row.email || undefined,
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
    password_hash: string;
    recovery_key: string | null;
    created_at: Date | string;
  }>(
    "SELECT id, username, email, password_hash, recovery_key, created_at FROM users WHERE id = $1 LIMIT 1",
    [id]
  );

  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    username: row.username,
    email: row.email || undefined,
    passwordHash: row.password_hash,
    recoveryKey: row.recovery_key || undefined,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at),
  };
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
  `);
  projectsInitialized = true;
}

export async function getAllProjects(userId: string): Promise<Project[]> {
  await ensureTableExists();
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    name: string;
    created_at: string | number;
    sections: unknown;
    tasks: string | null;
    user_id: string | null;
  }>(
    "SELECT id, name, created_at, sections, tasks, user_id FROM projects WHERE user_id = $1 ORDER BY created_at DESC",
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

    return {
      id: row.id,
      name: row.name,
      createdAt: Number(row.created_at) || Date.now(),
      sections: parsedSections,
      tasks: row.tasks ?? "",
      userId: row.user_id || userId,
    };
  });
}

export async function saveProject(project: Project, userId: string): Promise<void> {
  await ensureTableExists();
  const pool = getPool();
  await pool.query(
    `
    INSERT INTO projects (id, name, created_at, sections, tasks, user_id)
    VALUES ($1, $2, $3, $4::jsonb, $5, $6)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      sections = EXCLUDED.sections,
      tasks = EXCLUDED.tasks,
      user_id = COALESCE(projects.user_id, EXCLUDED.user_id)
  `,
    [
      project.id,
      project.name,
      project.createdAt,
      JSON.stringify(project.sections || []),
      project.tasks || "",
      userId,
    ]
  );
}

export async function deleteProject(id: string, userId: string): Promise<void> {
  await ensureTableExists();
  const pool = getPool();
  await pool.query("DELETE FROM projects WHERE id = $1 AND user_id = $2", [id, userId]);
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
