import { NextResponse } from "next/server";
import { getAllProjects, saveProject, deleteProject } from "@/lib/db";
import { isServerAuthenticated } from "@/lib/auth";
import type { Project } from "@/lib/types";

export async function GET() {
  const authenticated = await isServerAuthenticated();
  if (!authenticated) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const projects = getAllProjects();
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
  const authenticated = await isServerAuthenticated();
  if (!authenticated) {
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
    saveProject(project);
    return NextResponse.json({ success: true, project });
  } catch (error) {
    console.error("POST /api/projects error:", error);
    return NextResponse.json(
      { error: "Failed to save project" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const authenticated = await isServerAuthenticated();
  if (!authenticated) {
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
    deleteProject(id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("DELETE /api/projects error:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
