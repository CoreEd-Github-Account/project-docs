import { NextResponse } from "next/server";
import { getTaskMessages, createTaskMessage, getProjectPermission } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");
    const projectId = searchParams.get("projectId");

    if (!taskId || !projectId) {
      return NextResponse.json(
        { error: "Missing taskId or projectId query parameter" },
        { status: 400 }
      );
    }

    const perm = await getProjectPermission(projectId, auth.user.id);
    if (!perm) {
      return NextResponse.json(
        { error: "Access denied. Only project members can view task chats." },
        { status: 403 }
      );
    }

    const result = await getTaskMessages(taskId, projectId, auth.user.id);
    if (!result) {
      return NextResponse.json(
        { error: "Access denied to this project's chat" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      messages: result.messages,
      permission: result.permission,
      currentUser: {
        id: auth.user.id,
        username: auth.user.username,
      },
    });
  } catch (error) {
    console.error("GET /api/tasks/chat error:", error);
    return NextResponse.json(
      { error: "Failed to fetch task messages" },
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
    const { taskId, projectId, message } = body;

    if (!taskId || !projectId || typeof message !== "string" || !message.trim()) {
      return NextResponse.json(
        { error: "taskId, projectId, and message are required" },
        { status: 400 }
      );
    }

    const perm = await getProjectPermission(projectId, auth.user.id);
    if (!perm) {
      return NextResponse.json(
        { error: "Access denied. Only project members can post in task chats." },
        { status: 403 }
      );
    }

    const created = await createTaskMessage(taskId, projectId, auth.user.id, message.trim());
    if (!created) {
      return NextResponse.json(
        { error: "Failed to create task message or permission denied" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: created,
    });
  } catch (error) {
    console.error("POST /api/tasks/chat error:", error);
    return NextResponse.json(
      { error: "Failed to post task message" },
      { status: 500 }
    );
  }
}
