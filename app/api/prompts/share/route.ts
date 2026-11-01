import { NextResponse } from "next/server";
import { getPromptById, getPrompts, savePrompt } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

// Public GET: Retrieve a shared prompt by ID without requiring auth
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing prompt id" }, { status: 400 });
    }

    const item = await getPromptById(id);
    if (!item) {
      return NextResponse.json({ error: "Shared prompt not found" }, { status: 404 });
    }

    return NextResponse.json({
      prompt: {
        id: item.id,
        heading: item.heading,
        description: item.description,
        prompt: item.prompt,
        createdAt: item.createdAt,
      },
    });
  } catch (error) {
    console.error("GET /api/prompts/share error:", error);
    return NextResponse.json({ error: "Failed to fetch shared prompt" }, { status: 500 });
  }
}

// Authenticated POST: Automatically clones/saves the shared prompt into the current user's collection
export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: "Please login with your account to save this prompt", needLogin: true },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const promptId = body?.promptId;

    if (!promptId) {
      return NextResponse.json({ error: "Missing promptId" }, { status: 400 });
    }

    const sourcePrompt = await getPromptById(promptId);
    if (!sourcePrompt) {
      return NextResponse.json({ error: "Shared prompt not found" }, { status: 404 });
    }

    // Check if the user already has this prompt saved to prevent accidental duplicates
    const userPrompts = await getPrompts(auth.user.id);
    const existing = userPrompts.find(
      (p) =>
        p.id === sourcePrompt.id ||
        (p.heading === sourcePrompt.heading && p.prompt === sourcePrompt.prompt)
    );

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadySaved: true,
        item: existing,
        message: "Prompt is already in your collection",
      });
    }

    // Clone into user's account
    const newId = `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const saved = await savePrompt(
      {
        id: newId,
        heading: sourcePrompt.heading,
        description: sourcePrompt.description,
        prompt: sourcePrompt.prompt,
      },
      auth.user.id
    );

    return NextResponse.json({
      success: true,
      alreadySaved: false,
      item: saved,
      message: "Prompt saved to your collection",
    });
  } catch (error) {
    console.error("POST /api/prompts/share error:", error);
    return NextResponse.json({ error: "Failed to save shared prompt" }, { status: 500 });
  }
}

