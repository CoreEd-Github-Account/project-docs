import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { createSharedLink } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const auth = await getAuthenticatedUser();
    if (!auth.authenticated || !auth.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { projectId, projectName, content } = body;

    if (!projectId || !content) {
      return NextResponse.json(
        { error: "projectId and content are required" },
        { status: 400 }
      );
    }

    const { id, expiresAt } = await createSharedLink(
      projectId,
      projectName || "Untitled Project",
      content
    );

    return NextResponse.json({
      success: true,
      shareId: id,
      expiresAt,
    });
  } catch (error) {
    console.error("Error creating shared link:", error);
    return NextResponse.json(
      { error: "Failed to generate share link" },
      { status: 500 }
    );
  }
}
