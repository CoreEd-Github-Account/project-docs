import { NextResponse } from "next/server";
import { getCommands, saveCommand, deleteCommand } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import type { SavedCommand } from "@/lib/types";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const commands = await getCommands(auth.user.id);
    return NextResponse.json(commands);
  } catch (error) {
    console.error("GET /api/commands error:", error);
    return NextResponse.json(
      { error: "Failed to fetch commands" },
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
    const data: Partial<SavedCommand> = await request.json();
    if (!data || !data.command?.trim()) {
      return NextResponse.json(
        { error: "Command is required" },
        { status: 400 }
      );
    }

    const item = await saveCommand(
      {
        id: data.id || `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: data.title?.trim() || "",
        command: data.command.trim(),
        category: data.category?.trim() || "github",
        isPinned: Boolean(data.isPinned),
        createdAt: data.createdAt,
      },
      auth.user.id
    );

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("POST /api/commands error:", error);
    return NextResponse.json(
      { error: "Failed to save command" },
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
        { error: "Missing command id" },
        { status: 400 }
      );
    }

    await deleteCommand(id, auth.user.id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("DELETE /api/commands error:", error);
    return NextResponse.json(
      { error: "Failed to delete command" },
      { status: 500 }
    );
  }
}

