import { NextResponse } from "next/server";
import {
  getSnippetCategories,
  createSnippetCategory,
  deleteSnippetCategory,
} from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const categories = await getSnippetCategories(auth.user.id);
    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error("GET /api/snippets/categories error:", error);
    return NextResponse.json(
      { error: "Failed to fetch snippet categories" },
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
    const name = (body?.name || "").trim();
    const icon = (body?.icon || "🏷️").trim();
    const color = (body?.color || "rose").trim();

    if (!name) {
      return NextResponse.json(
        { error: "Category name is required" },
        { status: 400 }
      );
    }

    const category = await createSnippetCategory(name, auth.user.id, icon, color);
    return NextResponse.json({ success: true, category });
  } catch (error) {
    console.error("POST /api/snippets/categories error:", error);
    return NextResponse.json(
      { error: "Failed to create category" },
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
        { error: "Category ID is required" },
        { status: 400 }
      );
    }

    await deleteSnippetCategory(id, auth.user.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/snippets/categories error:", error);
    return NextResponse.json(
      { error: "Failed to delete category" },
      { status: 500 }
    );
  }
}

