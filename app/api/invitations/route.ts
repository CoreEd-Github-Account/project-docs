import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  createProjectInvitation,
  getProjectInvitations,
  getProjectPermission,
  updateProjectInvitation,
  updateProjectMember,
} from "@/lib/db";
import type { ProjectPermissionLevel, ProjectViewTab } from "@/lib/types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_PERMISSIONS: ProjectPermissionLevel[] = ["read", "edit_no_delete", "full"];
const ALL_TABS: ProjectViewTab[] = ["builder", "preview", "tasks"];

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { projectId, friendName, friendEmail, permissionLevel, allowedViews, isPublic, expiresInDays } = body;

    if (!projectId || typeof projectId !== "string") {
      return NextResponse.json({ error: "Project ID is required." }, { status: 400 });
    }

    const isPublicLink = Boolean(isPublic);
    const cleanName = (friendName || "").trim() || (isPublicLink ? "Public Link" : "");
    if (!cleanName && !isPublicLink) {
      return NextResponse.json({ error: "Friend name is required." }, { status: 400 });
    }

    const cleanEmail = (friendEmail || "").trim().toLowerCase();
    if (cleanEmail && !EMAIL_REGEX.test(cleanEmail)) {
      return NextResponse.json(
        { error: "A valid email address is required if provided." },
        { status: 400 }
      );
    }

    if (!permissionLevel || !VALID_PERMISSIONS.includes(permissionLevel as ProjectPermissionLevel)) {
      return NextResponse.json(
        { error: "Valid permission level is required (read, edit_no_delete, full)." },
        { status: 400 }
      );
    }

    // Parse and sanitize allowedViews
    let validatedViews: ProjectViewTab[] = ["builder", "preview", "tasks"];
    if (Array.isArray(allowedViews) && allowedViews.length > 0) {
      const filtered = allowedViews.filter((v: any): v is ProjectViewTab =>
        ALL_TABS.includes(v)
      );
      if (filtered.length > 0) {
        validatedViews = filtered;
      }
    }

    // Check inviter's permission on this project: must be owner or full access
    const userRole = await getProjectPermission(projectId, auth.user.id);
    if (userRole !== "owner" && userRole !== "full") {
      return NextResponse.json(
        { error: "You do not have permission to invite members to this project." },
        { status: 403 }
      );
    }

    const daysToExpire = typeof expiresInDays === "number" && expiresInDays > 0 ? expiresInDays : (isPublicLink ? 30 : 7);

    const { invitation, token } = await createProjectInvitation(
      auth.user.id,
      projectId,
      cleanName,
      isPublicLink ? "" : cleanEmail,
      permissionLevel as ProjectPermissionLevel,
      validatedViews,
      isPublicLink,
      daysToExpire
    );

    // Construct full invitation link
    let origin = "";
    try {
      const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
      const proto = request.headers.get("x-forwarded-proto") || "http";
      if (host) {
        origin = `${proto}://${host}`;
      }
    } catch {
      origin = "http://localhost:3000";
    }

    if (!origin) origin = "http://localhost:3000";
    const inviteLink = `${origin}/invite/${token}`;

    return NextResponse.json({
      success: true,
      link: inviteLink,
      inviteUrl: inviteLink,
      token,
      invitation,
    });
  } catch (error) {
    console.error("POST /api/invitations error:", error);
    return NextResponse.json(
      { error: "Failed to create project invitation." },
      { status: 500 }
    );
  }
}

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

    const invitations = await getProjectInvitations(projectId, auth.user.id);
    return NextResponse.json({ success: true, invitations });
  } catch (error) {
    console.error("GET /api/invitations error:", error);
    return NextResponse.json(
      { error: "Failed to fetch project invitations." },
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
    const { invitationId, projectId, targetUserId, permissionLevel, allowedViews } = body;

    // Validate updates
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

    if (invitationId) {
      const result = await updateProjectInvitation(invitationId, auth.user.id, updates);
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Failed to update invitation" }, { status: 400 });
      }
    }

    if (projectId && targetUserId) {
      const result = await updateProjectMember(projectId, targetUserId, auth.user.id, updates);
      if (!result.success) {
        return NextResponse.json({ error: result.error || "Failed to update member" }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, updates });
  } catch (error) {
    console.error("PATCH /api/invitations error:", error);
    return NextResponse.json({ error: "Failed to update permissions/modules." }, { status: 500 });
  }
}
