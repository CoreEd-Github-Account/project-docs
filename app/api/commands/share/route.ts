import { NextResponse } from "next/server";
import { getCommandById, getCommands, saveCommand } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

// Public GET: Retrieve a shared command by ID without requiring auth
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing command id" }, { status: 400 });
    }

    const item = await getCommandById(id);
    if (!item) {
      return NextResponse.json({ error: "Shared command not found" }, { status: 404 });
    }

    return NextResponse.json({
      command: {
        id: item.id,
        title: item.title,
        command: item.command,
        category: item.category,
        createdAt: item.createdAt,
      },
    });
  } catch (error) {
    console.error("GET /api/commands/share error:", error);
    return NextResponse.json({ error: "Failed to fetch shared command" }, { status: 500 });
  }
}

// Authenticated POST: Automatically clones/saves the shared command into the current user's collection
export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: "Please login with your account to save this command", needLogin: true },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const commandId = body?.commandId;

    if (!commandId) {
      return NextResponse.json({ error: "Missing commandId" }, { status: 400 });
    }

    const sourceCommand = await getCommandById(commandId);
    if (!sourceCommand) {
      return NextResponse.json({ error: "Shared command not found" }, { status: 404 });
    }

    // Check if the user already has this command saved to avoid duplicates
    const userCommands = await getCommands(auth.user.id);
    const existing = userCommands.find(
      (c) =>
        c.id === sourceCommand.id ||
        (c.command.trim() === sourceCommand.command.trim() &&
          (c.title || "").trim() === (sourceCommand.title || "").trim())
    );

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadySaved: true,
        item: existing,
        message: "Command is already in your collection",
      });
    }

    // Clone into user's account
    const newId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const saved = await saveCommand(
      {
        id: newId,
        title: sourceCommand.title,
        command: sourceCommand.command,
        category: sourceCommand.category || "github",
        isPinned: false,
      },
      auth.user.id
    );

    return NextResponse.json({
      success: true,
      alreadySaved: false,
      item: saved,
      message: "Command saved to your collection",
    });
  } catch (error) {
    console.error("POST /api/commands/share error:", error);
    return NextResponse.json({ error: "Failed to save shared command" }, { status: 500 });
  }
}

