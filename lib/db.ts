import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import fs from "node:fs";
import type { Project } from "./types";

function getDatabasePath(): string {
  const rootDbPath = path.join(process.cwd(), "sqlite.db");
  // On Vercel serverless environments, the project root is read-only.
  // /tmp is the writable filesystem in serverless functions.
  if (process.env.VERCEL) {
    const tmpDbPath = path.join("/tmp", "sqlite.db");
    if (!fs.existsSync(tmpDbPath) && fs.existsSync(rootDbPath)) {
      try {
        fs.copyFileSync(rootDbPath, tmpDbPath);
      } catch (err) {
        console.error("Failed to copy sqlite.db to /tmp:", err);
      }
    }
    return tmpDbPath;
  }
  return rootDbPath;
}

let dbInstance: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (!dbInstance) {
    const dbPath = getDatabasePath();
    dbInstance = new DatabaseSync(dbPath);
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        sections TEXT NOT NULL,
        tasks TEXT DEFAULT ''
      );
    `);

    // Safely migrate existing databases if tasks column does not exist yet
    try {
      dbInstance.exec(`ALTER TABLE projects ADD COLUMN tasks TEXT DEFAULT '';`);
    } catch {
      // Column already exists
    }

    // Clean up any legacy V3C records if present
    dbInstance.exec(`
      DELETE FROM projects WHERE id = 'default-v3c' OR name = 'V3C';
    `);
  }
  return dbInstance;
}

export function getAllProjects(): Project[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      "SELECT id, name, createdAt, sections, tasks FROM projects ORDER BY createdAt DESC"
    )
    .all() as Array<{
    id: string;
    name: string;
    createdAt: number;
    sections: string;
    tasks?: string | null;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt,
    sections: JSON.parse(row.sections || "[]"),
    tasks: row.tasks ?? "",
  }));
}

export function saveProject(project: Project): void {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO projects (id, name, createdAt, sections, tasks)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      sections = excluded.sections,
      tasks = excluded.tasks
  `);
  stmt.run(
    project.id,
    project.name,
    project.createdAt,
    JSON.stringify(project.sections),
    project.tasks || ""
  );
}

export function deleteProject(id: string): void {
  const db = getDatabase();
  const stmt = db.prepare("DELETE FROM projects WHERE id = ?");
  stmt.run(id);
}
