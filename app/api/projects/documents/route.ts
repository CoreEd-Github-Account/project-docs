import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getProjectPermission,
  getProjectDocuments,
  getProjectDocumentFolders,
  createProjectDocumentFolder,
  deleteProjectDocumentFolder,
  createProjectDocument,
  updateProjectDocument,
  deleteProjectDocument,
  getProjectDocumentById,
} from "@/lib/db";
import { imagekit, isImageKitConfigured } from "@/lib/imagekit";
import type { DocumentType } from "@/lib/types";

// Maximum upload file size: 25MB
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

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

    const [documents, folders] = await Promise.all([
      getProjectDocuments(projectId),
      getProjectDocumentFolders(projectId),
    ]);

    return NextResponse.json({ success: true, documents, folders });
  } catch (error: any) {
    console.error("GET /api/projects/documents error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to load project documents" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      // 1. File Upload Mode
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const projectId = formData.get("projectId") as string | null;
      const folderId = (formData.get("folderId") as string | null)?.trim() || null;
      const customName = (formData.get("name") as string | null)?.trim();
      const description = (formData.get("description") as string | null)?.trim() || "";

      if (!file || !projectId) {
        return NextResponse.json(
          { error: "Missing required fields: file and projectId" },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: "File exceeds 25MB maximum upload limit." },
          { status: 400 }
        );
      }

      const perm = await getProjectPermission(projectId, auth.user.id);
      if (!perm) {
        return NextResponse.json({ error: "Access denied to project" }, { status: 403 });
      }
      if (perm === "read") {
        return NextResponse.json(
          { error: "Read-only permission. Cannot upload documents." },
          { status: 403 }
        );
      }

      const fileName = customName || file.name;
      const ext = (fileName.split(".").pop() || "").toLowerCase();
      const mime = file.type || "application/octet-stream";

      let docType: DocumentType = "file";
      if (
        mime.startsWith("image/") ||
        /\.(png|jpe?g|webp|gif|svg|bmp|ico|avif)$/i.test(fileName)
      ) {
        docType = "image";
      } else if (
        mime.includes("markdown") ||
        /\.(md|markdown|mdown|mkdn|mkd)$/i.test(fileName)
      ) {
        docType = "markdown";
      } else if (
        mime.startsWith("text/") ||
        /\.(txt|json|csv|tsv|yaml|yml|xml|html|css|js|ts|tsx|jsx|env|ini|log|sql|sh|py|java|c|cpp|rs|go)$/i.test(
          fileName
        )
      ) {
        docType = "text";
      }

      let fileUrl = "";
      let fileId = "";
      let content = "";

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (docType === "markdown" || docType === "text") {
        // Read text content directly for inline viewing & editing
        content = buffer.toString("utf-8");
      }

      // Upload file directly to ImageKit.io
      if (isImageKitConfigured()) {
        try {
          const sanitizedFileName = fileName
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .substring(0, 100);

          const uploadRes = await imagekit.upload({
            file: buffer.toString("base64"),
            fileName: sanitizedFileName || `doc-${Date.now()}.${ext || "bin"}`,
            folder: `/projects/${projectId}/documents`,
            useUniqueFileName: true,
            tags: ["project-document", projectId, docType],
          });
          fileUrl = uploadRes.url;
          fileId = uploadRes.fileId;
        } catch (ikErr) {
          console.warn("ImageKit upload error, falling back to data URI:", ikErr);
          if (docType === "image" || !content) {
            fileUrl = `data:${mime};base64,${buffer.toString("base64")}`;
          }
        }
      } else {
        // If ImageKit is not configured, fallback to data URI for media
        if (docType === "image" || !content) {
          fileUrl = `data:${mime};base64,${buffer.toString("base64")}`;
        }
      }

      const newDoc = await createProjectDocument({
        projectId,
        userId: auth.user.id,
        folderId: folderId || null,
        name: fileName,
        fileType: docType,
        mimeType: mime,
        fileExtension: ext,
        fileSize: file.size,
        fileId: fileId || undefined,
        fileUrl,
        content,
        description,
      });

      return NextResponse.json({ success: true, document: newDoc });
    } else {
      // 2. JSON Mode: Create Folder OR Write .txt File directly in Database
      const body = await request.json();
      const projectId = typeof body?.projectId === "string" ? body.projectId.trim() : "";

      if (!projectId) {
        return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
      }

      const perm = await getProjectPermission(projectId, auth.user.id);
      if (!perm) {
        return NextResponse.json({ error: "Access denied to project" }, { status: 403 });
      }
      if (perm === "read") {
        return NextResponse.json(
          { error: "Read-only permission. Cannot create folders or documents." },
          { status: 403 }
        );
      }

      // 2a. Create Folder
      if (body?.action === "create_folder") {
        const folderName = typeof body?.name === "string" ? body.name.trim() : "";
        if (!folderName) {
          return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
        }

        const folder = await createProjectDocumentFolder(projectId, auth.user.id, folderName);
        return NextResponse.json({ success: true, folder });
      }

      // 2b. Write .txt file: upload to ImageKit.io AND save metadata/content in database
      if (body?.action === "create_txt" || body?.content !== undefined) {
        const rawName = typeof body?.name === "string" ? body.name.trim() : "";
        if (!rawName) {
          return NextResponse.json({ error: "File name is required" }, { status: 400 });
        }

        const finalName = rawName.toLowerCase().endsWith(".txt") ? rawName : `${rawName}.txt`;
        const textContent = typeof body?.content === "string" ? body.content : "";
        const folderId = typeof body?.folderId === "string" && body.folderId.trim() ? body.folderId.trim() : null;
        const description = typeof body?.description === "string" ? body.description.trim() : "";
        const buffer = Buffer.from(textContent, "utf8");
        const byteSize = buffer.byteLength;

        let fileUrl = "";
        let fileId = "";

        if (isImageKitConfigured()) {
          try {
            const sanitizedFileName = finalName
              .replace(/[^a-zA-Z0-9._-]/g, "_")
              .substring(0, 100);

            const uploadRes = await imagekit.upload({
              file: buffer.toString("base64"),
              fileName: sanitizedFileName || `note-${Date.now()}.txt`,
              folder: `/projects/${projectId}/documents`,
              useUniqueFileName: true,
              tags: ["project-document", projectId, "text"],
            });
            fileUrl = uploadRes.url;
            fileId = uploadRes.fileId;
          } catch (ikErr) {
            console.warn("ImageKit upload error for .txt file:", ikErr);
          }
        }

        const newDoc = await createProjectDocument({
          projectId,
          userId: auth.user.id,
          folderId,
          name: finalName,
          fileType: "text",
          mimeType: "text/plain",
          fileExtension: "txt",
          fileSize: byteSize,
          fileId: fileId || undefined,
          fileUrl: fileUrl || undefined,
          content: textContent,
          description,
        });

        return NextResponse.json({ success: true, document: newDoc });
      }

      return NextResponse.json(
        { error: "Unsupported request action." },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("POST /api/projects/documents error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create document or folder" },
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
    const { id, projectId, name, content, description, folderId } = body;

    if (!id || !projectId) {
      return NextResponse.json(
        { error: "Missing required fields: id and projectId" },
        { status: 400 }
      );
    }

    const perm = await getProjectPermission(projectId, auth.user.id);
    if (!perm) {
      return NextResponse.json({ error: "Access denied to project" }, { status: 403 });
    }
    if (perm === "read") {
      return NextResponse.json(
        { error: "Read-only permission. Cannot update documents." },
        { status: 403 }
      );
    }

    const existing = await getProjectDocumentById(id, projectId);
    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const updates: {
      name?: string;
      content?: string;
      description?: string;
      folderId?: string | null;
      fileId?: string;
      fileUrl?: string;
      fileSize?: number;
    } = {};

    if (name !== undefined) {
      updates.name = name.trim();
    }
    if (description !== undefined) {
      updates.description = description.trim();
    }
    if (folderId !== undefined) {
      updates.folderId = folderId || null;
    }
    if (content !== undefined) {
      updates.content = content;
      const buffer = Buffer.from(content, "utf8");
      updates.fileSize = buffer.byteLength;

      if (isImageKitConfigured()) {
        try {
          if (existing.fileId) {
            await imagekit.deleteFile(existing.fileId).catch(() => {});
          }
          const targetName = (updates.name || existing.name || `note-${Date.now()}.txt`)
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .substring(0, 100);
          const uploadRes = await imagekit.upload({
            file: buffer.toString("base64"),
            fileName: targetName,
            folder: `/projects/${projectId}/documents`,
            useUniqueFileName: true,
            tags: ["project-document", projectId, existing.fileType || "text"],
          });
          updates.fileId = uploadRes.fileId;
          updates.fileUrl = uploadRes.url;
        } catch (ikErr) {
          console.warn("ImageKit re-upload error on PUT:", ikErr);
        }
      }
    }

    const updated = await updateProjectDocument(id, projectId, updates);
    return NextResponse.json({ success: true, document: updated });
  } catch (error: any) {
    console.error("PUT /api/projects/documents error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update document" },
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
  const id = searchParams.get("id");
  const folderId = searchParams.get("folderId");
  const projectId = searchParams.get("projectId");

  if (!projectId || (!id && !folderId)) {
    return NextResponse.json(
      { error: "Missing required query parameters: projectId and id or folderId" },
      { status: 400 }
    );
  }

  try {
    const perm = await getProjectPermission(projectId, auth.user.id);
    if (!perm) {
      return NextResponse.json({ error: "Access denied to project" }, { status: 403 });
    }
    if (perm === "read") {
      return NextResponse.json(
        { error: "Read-only permission. Cannot delete documents or folders." },
        { status: 403 }
      );
    }

    // Delete Folder
    if (folderId) {
      if (perm === "edit_no_delete") {
        return NextResponse.json(
          { error: "Your permission does not allow deleting folders." },
          { status: 403 }
        );
      }
      await deleteProjectDocumentFolder(folderId, projectId);
      return NextResponse.json({ success: true, folderId });
    }

    // Delete Document
    const existing = await getProjectDocumentById(id!, projectId);
    if (!existing) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // If member has edit_no_delete, they can only delete files they themselves created
    if (perm === "edit_no_delete" && existing.userId !== auth.user.id) {
      return NextResponse.json(
        { error: "Your permission does not allow deleting documents created by others." },
        { status: 403 }
      );
    }

    // Delete from ImageKit if it was stored there
    if (existing.fileId && isImageKitConfigured()) {
      try {
        await imagekit.deleteFile(existing.fileId);
      } catch (ikDelErr) {
        console.warn("Failed to delete file from ImageKit:", ikDelErr);
      }
    }

    await deleteProjectDocument(id!, projectId);
    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    console.error("DELETE /api/projects/documents error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to delete document" },
      { status: 500 }
    );
  }
}
