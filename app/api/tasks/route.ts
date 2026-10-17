import { NextResponse } from "next/server";
import {
  getTasksByProject,
  saveTask,
  deleteTask,
  getProjectPermission,
  notifyProjectMembersOnTaskCreated,
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
  } catch (error) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
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
  } catch (error) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to create task" },
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
    } = body;
    const taskHeading = (heading || title || "").trim();

    if (!id || !projectId || !taskHeading) {
      return NextResponse.json(
        { error: "Missing required fields: id, projectId, and heading" },
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
      description: description !== undefined ? String(description).trim() : "",
      comments:
        typeof comments === "object" && comments !== null
          ? JSON.stringify(comments)
          : comments !== undefined
          ? String(comments).trim()
          : "",
      stage: validStage,
      startDate: String(startDate || start_date || "").trim(),
      endDate: String(endDate || end_date || "").trim(),
      createdAt: Number(createdAt) || Date.now(),
    };

    await saveTask(updatedTask, projectId, auth.user.id);
    return NextResponse.json({ success: true, task: updatedTask });
  } catch (error) {
    console.error("PUT /api/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to update task" },
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

    const deleted = await deleteTask(id, auth.user.id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Task not found or you do not have permission to delete tasks (Full Access required)." },
        { status: 403 }
      );
    }
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("DELETE /api/tasks error:", error);
    return NextResponse.json(
      { error: "Failed to delete task" },
      { status: 500 }
    );
  }
}
