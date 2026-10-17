import { NextResponse } from "next/server";
import { getAllProjects, saveProject, deleteProject, getProjectPermission } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import type { Project } from "@/lib/types";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = await getAllProjects(auth.user.id);
    return NextResponse.json(projects);
  } catch (error) {
    console.error("GET /api/projects error:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
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
    const project: Project = await request.json();
    if (!project || !project.id || !project.name) {
      return NextResponse.json(
        { error: "Invalid project data" },
        { status: 400 }
      );
    }

    // Check project permissions if project already exists
    const perm = await getProjectPermission(project.id, auth.user.id);
    if (perm === "read") {
      return NextResponse.json(
        { error: "You have Read Only permission and cannot modify this project." },
        { status: 403 }
      );
    }

    await saveProject(project, auth.user.id);
    return NextResponse.json({ success: true, project });
  } catch (error: any) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to save project" },
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
        { error: "Missing project id" },
        { status: 400 }
      );
    }

    const perm = await getProjectPermission(id, auth.user.id);
    if (perm !== "owner" && perm !== "full") {
      return NextResponse.json(
        { error: "You do not have permission to delete this project (Full Access or Owner required)." },
        { status: 403 }
      );
    }

    await deleteProject(id, auth.user.id);
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("DELETE /api/projects error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete project" },
      { status: 500 }
    );
  }
}
