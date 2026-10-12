import { Pool } from "pg";
import type { Project, Section } from "./types";

let poolInstance: Pool | null = null;
let initialized = false;

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
    // If raw string has unencoded characters like @ in password
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

export async function ensureTableExists(): Promise<void> {
  if (initialized) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at BIGINT NOT NULL,
      sections JSONB NOT NULL DEFAULT '[]'::jsonb,
      tasks TEXT DEFAULT ''
    );
  `);
  initialized = true;
}

export async function getAllProjects(): Promise<Project[]> {
  await ensureTableExists();
  const pool = getPool();
  const { rows } = await pool.query<{
    id: string;
    name: string;
    created_at: string | number;
    sections: unknown;
    tasks: string | null;
  }>(
    "SELECT id, name, created_at, sections, tasks FROM projects ORDER BY created_at DESC"
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
    };
  });
}

export async function saveProject(project: Project): Promise<void> {
  await ensureTableExists();
  const pool = getPool();
  await pool.query(
    `
    INSERT INTO projects (id, name, created_at, sections, tasks)
    VALUES ($1, $2, $3, $4::jsonb, $5)
    ON CONFLICT (id) DO UPDATE SET
      name = EXCLUDED.name,
      sections = EXCLUDED.sections,
      tasks = EXCLUDED.tasks
  `,
    [
      project.id,
      project.name,
      project.createdAt,
      JSON.stringify(project.sections || []),
      project.tasks || "",
    ]
  );
}

export async function deleteProject(id: string): Promise<void> {
  await ensureTableExists();
  const pool = getPool();
  await pool.query("DELETE FROM projects WHERE id = $1", [id]);
}
