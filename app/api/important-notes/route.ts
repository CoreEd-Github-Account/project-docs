import { NextResponse } from "next/server";
import {
  getImportantNotes,
  saveImportantNote,
  deleteImportantNote,
} from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import type { ImportantNote } from "@/lib/types";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const notes = await getImportantNotes(auth.user.id);
    return NextResponse.json({ success: true, notes });
  } catch (error) {
    console.error("GET /api/important-notes error:", error);
    return NextResponse.json(
      { error: "Failed to fetch important notes" },
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
    const data: Partial<ImportantNote> = await request.json();
    if (!data || !data.heading?.trim() || !data.text?.trim()) {
      return NextResponse.json(
        { error: "Heading and text are required" },
        { status: 400 }
      );
    }

    const item = await saveImportantNote(
      {
        id:
          data.id ||
          `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        heading: data.heading.trim(),
        description: data.description?.trim() || "",
        text: data.text.trim(),
        createdAt: data.createdAt,
      },
      auth.user.id
    );

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("POST /api/important-notes error:", error);
    return NextResponse.json(
      { error: "Failed to save important note" },
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
        { error: "Note ID is required" },
        { status: 400 }
      );
    }

    await deleteImportantNote(id, auth.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/important-notes error:", error);
    return NextResponse.json(
      { error: "Failed to delete important note" },
      { status: 500 }
    );
  }
}

