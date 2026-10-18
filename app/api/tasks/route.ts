import { NextResponse } from "next/server";
import {
  getTasksByProject,
  saveTask,
  deleteTask,
  getProjectPermission,
  notifyProjectMembersOnTaskCreated,
  notifyProjectMembers,
  getPool,
} from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import type { TaskItem, TaskStage } from "@/lib/types";

export async function GET(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json(
        { error: "Missing projectId parameter" },
        { status: 400 }
      );
    }

    const perm = await getProjectPermission(projectId, auth.user.id);
    if (!perm) {
      return NextResponse.json({ error: "Access denied to this project." }, { status: 403 });
    }

    const tasks = await getTasksByProject(projectId, auth.user.id);
    return NextResponse.json(tasks);
  } catch (error: any) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch tasks" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      projectId,
      title,
      heading,
      description,
      comments,
      stage,
      status,
      startDate,
      start_date,
      endDate,
      end_date,
      id,
      folder,
    } = body;
    const taskHeading = (heading || title || "").trim();

    if (!projectId || !taskHeading) {
      return NextResponse.json(
        { error: "Missing required fields: projectId and heading" },
        { status: 400 }
      );
    }

    const perm = await getProjectPermission(projectId, auth.user.id);
    if (!perm) {
      return NextResponse.json({ error: "Access denied to this project." }, { status: 403 });
    }
    if (perm === "read") {
      return NextResponse.json(
        { error: "You have Read-Only permission and cannot create tasks in this project." },
        { status: 403 }
      );
    }

    const stageValue = stage || status;
    const validStage: TaskStage = ["inprogress", "completed", "stopped"].includes(
      stageValue
    )
      ? stageValue
      : "inprogress";

    const newTask: TaskItem = {
      id:
        id ||
        `task-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      projectId,
      userId: auth.user.id,
      title: taskHeading,
      heading: taskHeading,
      description: (description || "").trim(),
      comments:
        typeof comments === "object" && comments !== null
          ? JSON.stringify(comments)
          : String(comments || "").trim(),
      stage: validStage,
      startDate: String(startDate || start_date || "").trim(),
      endDate: String(endDate || end_date || "").trim(),
      createdAt: Number(body.createdAt) || Date.now(),
      folder: folder !== undefined ? String(folder).trim() : "",
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
    };

    await saveTask(newTask, projectId, auth.user.id);

    // Live Sync Notification: Notify only members of this project (excluding the creator)
    try {
      await notifyProjectMembersOnTaskCreated({
        projectId,
        taskId: newTask.id,
        taskHeading: taskHeading,
        actorUserId: auth.user.id,
      });
    } catch (notifErr) {
      console.error("Failed to notify project members on task creation:", notifErr);
    }

    return NextResponse.json({ success: true, task: newTask }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create task" },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      id,
      projectId,
      title,
      heading,
      description,
      comments,
      stage,
      status,
      startDate,
      start_date,
      endDate,
      end_date,
      createdAt,
      folder,
    } = body;
    let taskHeading = (heading || title || "").trim();
    let taskDescription = description !== undefined ? String(description).trim() : undefined;
    let taskComments =
      typeof comments === "object" && comments !== null
        ? JSON.stringify(comments)
        : comments !== undefined
        ? String(comments).trim()
        : undefined;
    let taskStartDate = startDate || start_date;
    let taskEndDate = endDate || end_date;
    let taskCreatedAt = createdAt ? Number(createdAt) : undefined;
    let taskFolder = folder !== undefined ? String(folder).trim() : undefined;

    if (!id || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: id and projectId" },
        { status: 400 }
      );
    }

    // Query existing task to compare changes and backfill missing fields
    const pool = getPool();
    const { rows: existingRows } = await pool.query<{
      heading: string;
      title: string;
      description: string;
      comments: string;
      attachments: string | null;
      start_date: string;
      end_date: string;
      created_at: string | number;
      stage: TaskStage;
      folder: string | null;
    }>(
      "SELECT heading, title, description, comments, COALESCE(attachments, '[]') as attachments, start_date, end_date, created_at, stage, folder FROM tasks WHERE id = $1 LIMIT 1",
      [id]
    );

    let previousStage: TaskStage | undefined = undefined;
    let previousComments: string | undefined = undefined;
    let taskAttachments = Array.isArray(body.attachments) ? body.attachments : undefined;

    if (existingRows.length > 0) {
      previousStage = existingRows[0].stage;
      previousComments = existingRows[0].comments || "";
      if (!taskHeading) taskHeading = (existingRows[0].heading || existingRows[0].title || "").trim();
      if (taskDescription === undefined) taskDescription = existingRows[0].description || "";
      if (taskComments === undefined) taskComments = existingRows[0].comments || "";
      if (!taskStartDate) taskStartDate = existingRows[0].start_date || "";
      if (!taskEndDate) taskEndDate = existingRows[0].end_date || "";
      if (!taskCreatedAt) taskCreatedAt = Number(existingRows[0].created_at) || Date.now();
      if (taskFolder === undefined) taskFolder = existingRows[0].folder || "";
      if (taskAttachments === undefined) {
        try {
          taskAttachments = JSON.parse(existingRows[0].attachments || "[]");
        } catch {
          taskAttachments = [];
        }
      }
    }

    if (!taskHeading) {
      return NextResponse.json(
        { error: "Missing required field: heading or title" },
        { status: 400 }
      );
    }

    const perm = await getProjectPermission(projectId, auth.user.id);
    if (!perm) {
      return NextResponse.json({ error: "Access denied to this project." }, { status: 403 });
    }
    if (perm === "read") {
      return NextResponse.json(
        { error: "You have Read-Only permission and cannot modify tasks in this project." },
        { status: 403 }
      );
    }

    const stageValue = stage || status;
    const validStage: TaskStage = ["inprogress", "completed", "stopped"].includes(
      stageValue
    )
      ? stageValue
      : "inprogress";

    const updatedTask: TaskItem = {
      id,
      projectId,
      userId: auth.user.id,
      title: taskHeading,
      heading: taskHeading,
      description: taskDescription || "",
      comments: taskComments || "",
      attachments: Array.isArray(taskAttachments) ? taskAttachments : [],
      stage: validStage,
      startDate: String(taskStartDate || "").trim(),
      endDate: String(taskEndDate || "").trim(),
      createdAt: Number(taskCreatedAt) || Date.now(),
      folder: String(taskFolder || "").trim(),
    };

    await saveTask(updatedTask, projectId, auth.user.id);

    // Notify all members of this project about the task change
    try {
      if (previousStage && previousStage !== validStage) {
        await notifyProjectMembers({
          projectId,
          taskId: id,
          taskHeading,
          actorUserId: auth.user.id,
          type: "task_status_changed",
          title: "Task Status Updated",
          message: `changed status of "${taskHeading}" to ${validStage}`,
        });
      } else if (previousComments !== undefined && previousComments !== (taskComments || "")) {
        await notifyProjectMembers({
          projectId,
          taskId: id,
          taskHeading,
          actorUserId: auth.user.id,
          type: "task_comment",
          title: "New Task Comment",
          message: `updated comments on task "${taskHeading}"`,
        });
      } else {
        await notifyProjectMembers({
          projectId,
          taskId: id,
          taskHeading,
          actorUserId: auth.user.id,
          type: "task_updated",
          title: "Task Updated",
          message: `updated task "${taskHeading}"`,
        });
      }
    } catch (notifErr) {
      console.error("Failed to notify project members on task update:", notifErr);
    }

    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error: any) {
    console.error("PUT /api/tasks error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update task" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "Missing task id" },
        { status: 400 }
      );
    }

    const pool = getPool();
    const { rows: taskRows } = await pool.query<{ project_id: string; heading: string; title: string }>(
      "SELECT project_id, heading, title FROM tasks WHERE id = $1 LIMIT 1",
      [id]
    );

    const deleted = await deleteTask(id, auth.user.id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Task not found or you do not have permission to delete tasks (Full Access required)." },
        { status: 403 }
      );
    }

    if (taskRows.length > 0) {
      const taskHeading = taskRows[0].heading || taskRows[0].title || "Task";
      const taskProjectId = taskRows[0].project_id;
      try {
        await notifyProjectMembers({
          projectId: taskProjectId,
          taskId: id,
          taskHeading,
          actorUserId: auth.user.id,
          type: "task_deleted",
          title: "Task Deleted",
          message: `deleted task "${taskHeading}"`,
        });
      } catch (notifErr) {
        console.error("Failed to notify project members on task deletion:", notifErr);
      }
    }

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("DELETE /api/tasks error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete task" },
      { status: 500 }
    );
  }
}
