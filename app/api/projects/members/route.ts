import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getProjectMemberDetails,
  updateProjectMember,
  removeProjectMember,
  getProjectPermission,
} from "@/lib/db";
import type { ProjectPermissionLevel, ProjectViewTab } from "@/lib/types";

const VALID_PERMISSIONS: ProjectPermissionLevel[] = ["read", "edit_no_delete", "full"];
const ALL_TABS: ProjectViewTab[] = ["builder", "preview", "tasks"];

export async function GET(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
    }

    const details = await getProjectMemberDetails(projectId, auth.user.id);
    if (!details) {
      return NextResponse.json(
        { error: "Project not found or you do not have permission to view members." },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, ...details });
  } catch (error) {
    console.error("GET /api/projects/members error:", error);
    return NextResponse.json(
      { error: "Failed to load project members." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, targetUserId, permissionLevel, allowedViews } = body;

    if (!projectId || !targetUserId) {
      return NextResponse.json(
        { error: "Project ID and target user ID are required." },
        { status: 400 }
      );
    }

    const perm = await getProjectPermission(projectId, auth.user.id);
    if (perm !== "owner" && perm !== "full") {
      return NextResponse.json(
        { error: "You do not have permission to update member permissions for this project." },
        { status: 403 }
      );
    }

    const updates: { permissionLevel?: ProjectPermissionLevel; allowedViews?: ProjectViewTab[] } = {};
    if (permissionLevel && VALID_PERMISSIONS.includes(permissionLevel as ProjectPermissionLevel)) {
      updates.permissionLevel = permissionLevel as ProjectPermissionLevel;
    }
    if (Array.isArray(allowedViews)) {
      const filtered = allowedViews.filter((v: any): v is ProjectViewTab =>
        ALL_TABS.includes(v)
      );
      if (filtered.length > 0) {
        updates.allowedViews = filtered;
      }
    }

    if (!updates.permissionLevel && !updates.allowedViews) {
      return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
    }

    const result = await updateProjectMember(projectId, targetUserId, auth.user.id, updates);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to update member." }, { status: 400 });
    }

    return NextResponse.json({ success: true, updates });
  } catch (error) {
    console.error("PATCH /api/projects/members error:", error);
    return NextResponse.json(
      { error: "Failed to update project member." },
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
    const projectId = searchParams.get("projectId");
    const targetUserId = searchParams.get("userId");

    if (!projectId || !targetUserId) {
      return NextResponse.json(
        { error: "Project ID and User ID are required." },
        { status: 400 }
      );
    }

    const result = await removeProjectMember(projectId, targetUserId, auth.user.id);
    if (!result.success) {
      return NextResponse.json({ error: result.error || "Failed to remove member." }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Member removed from project." });
  } catch (error) {
    console.error("DELETE /api/projects/members error:", error);
    return NextResponse.json(
      { error: "Failed to remove project member." },
      { status: 500 }
    );
  }
}
