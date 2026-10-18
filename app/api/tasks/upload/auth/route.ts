import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { imagekit, isImageKitConfigured } from "@/lib/imagekit";

export async function GET(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isImageKitConfigured()) {
    return NextResponse.json(
      { error: "ImageKit credentials not configured" },
      { status: 500 }
    );
  }

  try {
    const authParams = imagekit.getAuthenticationParameters();
    return NextResponse.json(authParams);
  } catch (error: any) {
    console.error("GET /api/tasks/upload/auth error:", error);
    return NextResponse.json(
      { error: "Failed to generate ImageKit auth parameters" },
      { status: 500 }
    );
  }
}
