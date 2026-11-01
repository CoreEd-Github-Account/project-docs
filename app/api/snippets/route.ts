import { NextResponse } from "next/server";
import { getSnippets, saveSnippet, deleteSnippet } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import type { SavedSnippet } from "@/lib/types";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const snippets = await getSnippets(auth.user.id);
    return NextResponse.json(snippets);
  } catch (error) {
    console.error("GET /api/snippets error:", error);
    return NextResponse.json(
      { error: "Failed to fetch snippets" },
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
    const body = await request.json();
    const title = (body.title || body.heading || "").trim();
    const content = (body.content || body.text || "").trim();
    const description = (body.description || "").trim();
    const category = (body.category || "general").trim();
    const isPinned = Boolean(body.isPinned);

    if (!title || !content) {
      return NextResponse.json(
        { error: "Heading (title) and text (content) are required" },
        { status: 400 }
      );
    }

    const item = await saveSnippet(
      {
        id:
          body.id ||
          `snip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        description,
        content,
        category,
        isPinned,
        createdAt: body.createdAt,
      },
      auth.user.id
    );

    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("POST /api/snippets error:", error);
    return NextResponse.json(
      { error: "Failed to save snippet" },
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
        { error: "Snippet ID is required" },
        { status: 400 }
      );
    }

    await deleteSnippet(id, auth.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/snippets error:", error);
    return NextResponse.json(
      { error: "Failed to delete snippet" },
      { status: 500 }
    );
  }
}
