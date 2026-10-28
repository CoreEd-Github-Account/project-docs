import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getProjectPermission,
  getProjectBulkOpener,
  saveProjectBulkOpener,
  deleteProjectBulkOpener,
} from "@/lib/db";

export async function GET(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId parameter" }, { status: 400 });
  }

  try {
    const perm = await getProjectPermission(projectId, auth.user.id);
    if (!perm) {
      return NextResponse.json({ error: "Access denied to project" }, { status: 403 });
    }

    const data = await getProjectBulkOpener(projectId);
    return NextResponse.json({ success: true, ...data });
  } catch (error: any) {
    console.error("GET /api/projects/bulk-opener error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load bulk opener content" },
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
    const { projectId, content } = body;

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const perm = await getProjectPermission(projectId, auth.user.id);
    if (!perm) {
      return NextResponse.json({ error: "Access denied to project" }, { status: 403 });
    }
    if (perm === "read") {
      return NextResponse.json(
        { error: "Read-only permission. Cannot modify bulk opener." },
        { status: 403 }
      );
    }

    const saved = await saveProjectBulkOpener(projectId, content ?? "", auth.user.id);
    return NextResponse.json({ success: true, ...saved });
  } catch (error: any) {
    console.error("POST /api/projects/bulk-opener error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save bulk opener text" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
  }

  try {
    const perm = await getProjectPermission(projectId, auth.user.id);
    if (!perm) {
      return NextResponse.json({ error: "Access denied to project" }, { status: 403 });
    }
    if (perm === "read" || perm === "edit_no_delete") {
      return NextResponse.json(
        { error: "Permission denied to clear bulk opener text." },
        { status: 403 }
      );
    }

    await deleteProjectBulkOpener(projectId);
    return NextResponse.json({ success: true, content: "" });
  } catch (error: any) {
    console.error("DELETE /api/projects/bulk-opener error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete bulk opener text" },
      { status: 500 }
    );
  }
}
