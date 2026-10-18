import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import { getProjectPermission } from "@/lib/db";
import { imagekit, isImageKitConfigured } from "@/lib/imagekit";
import type { TaskAttachment } from "@/lib/types";

// Maximum upload size: 15MB
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isImageKitConfigured()) {
    return NextResponse.json(
      {
        error:
          "ImageKit is not fully configured. Please ensure NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, and IMAGEKIT_URL_ENDPOINT are set in your .env file.",
      },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const projectId = formData.get("projectId") as string | null;
    const taskId = formData.get("taskId") as string | null;

    if (!file || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: file and projectId" },
        { status: 400 }
      );
    }

    // Permission check
    const perm = await getProjectPermission(projectId, auth.user.id);
    if (!perm) {
      return NextResponse.json({ error: "Access denied to project" }, { status: 403 });
    }
    if (perm === "read") {
      return NextResponse.json(
        { error: "Read-only permission. Cannot upload files." },
        { status: 403 }
      );
    }

    // Validate mime type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Only image files (JPEG, PNG, WebP, GIF, SVG) are allowed." },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json(
        { error: "File exceeds maximum size limit of 15MB." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64File = buffer.toString("base64");

    const sanitizedFileName = file.name
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .substring(0, 100);

    const uploadResponse = await imagekit.upload({
      file: base64File,
      fileName: sanitizedFileName || `task-image-${Date.now()}`,
      folder: `/projects/${projectId}/tasks`,
      useUniqueFileName: true,
      tags: ["task-attachment", projectId, taskId || "general"],
    });

    const attachment: TaskAttachment = {
      fileId: uploadResponse.fileId,
      name: file.name,
      url: uploadResponse.url,
      thumbnailUrl:
        uploadResponse.thumbnailUrl ||
        `${uploadResponse.url}?tr=w-400,h-400,c-at_max,q-80`,
      size: uploadResponse.size,
      filePath: uploadResponse.filePath,
      createdAt: Date.now(),
    };

    return NextResponse.json({
      success: true,
      attachment,
    });
  } catch (error: any) {
    console.error("POST /api/tasks/upload error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to upload image to ImageKit" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isImageKitConfigured()) {
    return NextResponse.json(
      { error: "ImageKit is not configured" },
      { status: 500 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get("fileId");
    const projectId = searchParams.get("projectId");

    if (!fileId || !projectId) {
      return NextResponse.json(
        { error: "Missing fileId or projectId" },
        { status: 400 }
      );
    }

    const perm = await getProjectPermission(projectId, auth.user.id);
    if (!perm || perm === "read") {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    await imagekit.deleteFile(fileId);

    return NextResponse.json({ success: true, message: "File deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /api/tasks/upload error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete image from ImageKit" },
      { status: 500 }
    );
  }
}
