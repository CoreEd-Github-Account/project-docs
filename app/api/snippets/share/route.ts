import { NextResponse } from "next/server";
import { getSnippetById, getSnippets, saveSnippet } from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

// Public GET: Retrieve a shared snippet by ID without requiring auth
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing snippet id" }, { status: 400 });
    }

    const item = await getSnippetById(id);
    if (!item) {
      return NextResponse.json({ error: "Shared snippet not found" }, { status: 404 });
    }

    return NextResponse.json({
      snippet: {
        id: item.id,
        title: item.title,
        description: item.description,
        content: item.content,
        category: item.category,
        createdAt: item.createdAt,
      },
    });
  } catch (error) {
    console.error("GET /api/snippets/share error:", error);
    return NextResponse.json({ error: "Failed to fetch shared snippet" }, { status: 500 });
  }
}

// Authenticated POST: Clones/saves the shared snippet into the current user's collection
export async function POST(request: Request) {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json(
      { error: "Please login with your account to save this snippet", needLogin: true },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const snippetId = body?.snippetId;

    if (!snippetId) {
      return NextResponse.json({ error: "Missing snippetId" }, { status: 400 });
    }

    const source = await getSnippetById(snippetId);
    if (!source) {
      return NextResponse.json({ error: "Shared snippet not found" }, { status: 404 });
    }

    const userSnippets = await getSnippets(auth.user.id);
    const existing = userSnippets.find(
      (s) => s.title === source.title && s.content === source.content
    );

    if (existing) {
      return NextResponse.json({
        success: true,
        alreadySaved: true,
        item: existing,
        message: "You already have this snippet in your collection",
      });
    }

    const newSnippet = await saveSnippet(
      {
        id: `snip-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: source.title,
        description: source.description || "",
        content: source.content,
        category: source.category || "general",
        isPinned: false,
      },
      auth.user.id
    );

    return NextResponse.json({
      success: true,
      item: newSnippet,
      message: "Snippet successfully added to your collection",
    });
  } catch (error) {
    console.error("POST /api/snippets/share error:", error);
    return NextResponse.json({ error: "Failed to save shared snippet" }, { status: 500 });
  }
}

