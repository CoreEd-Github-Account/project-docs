import { NextResponse } from "next/server";
import { getPrompts, savePrompt, deletePrompt } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import type { SavedPrompt } from "@/lib/types";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prompts = await getPrompts(auth.user.id);
    return NextResponse.json(prompts);
  } catch (error) {
    console.error("GET /api/prompts error:", error);
    return NextResponse.json(
      { error: "Failed to fetch prompts" },
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
    const data: Partial<SavedPrompt> = await request.json();
    if (!data || !data.heading?.trim() || !data.prompt?.trim()) {
      return NextResponse.json(
        { error: "Heading and prompt are required" },
        { status: 400 }
      );
    }

    const item = await savePrompt(
      {
        id: data.id || `prompt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        heading: data.heading.trim(),
        description: data.description?.trim() || "",
        prompt: data.prompt.trim(),
        createdAt: data.createdAt,
      },
      auth.user.id
    );

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("POST /api/prompts error:", error);
    return NextResponse.json(
      { error: "Failed to save prompt" },
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
        { error: "Missing prompt id" },
        { status: 400 }
      );
    }

    await deletePrompt(id, auth.user.id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("DELETE /api/prompts error:", error);
    return NextResponse.json(
      { error: "Failed to delete prompt" },
      { status: 500 }
    );
  }
}
