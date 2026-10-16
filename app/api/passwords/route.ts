import { NextResponse } from "next/server";
import {
  getAllPasswords,
  savePassword,
  deletePassword,
} from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import type { PasswordItem } from "@/lib/types";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const passwords = await getAllPasswords(auth.user.id);
    return NextResponse.json(passwords);
  } catch (error) {
    console.error("GET /api/passwords error:", error);
    return NextResponse.json(
      { error: "Failed to fetch passwords" },
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
    const data: Partial<PasswordItem> = await request.json();
    if (!data || !data.projectName?.trim() || !data.identifier?.trim() || !data.password) {
      return NextResponse.json(
        { error: "Project name, identifier, and password are required" },
        { status: 400 }
      );
    }

    const item: PasswordItem = {
      id: data.id || `pwd-${Date.now()}`,
      projectName: data.projectName.trim(),
      url: data.url?.trim() || "",
      identifier: data.identifier.trim(),
      password: data.password,
      createdAt: data.createdAt || new Date().toISOString(),
      userId: auth.user.id,
    };

    await savePassword(item, auth.user.id);
    return NextResponse.json({ success: true, item });
  } catch (error) {
    console.error("POST /api/passwords error:", error);
    return NextResponse.json(
      { error: "Failed to save password" },
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
        { error: "Missing password id" },
        { status: 400 }
      );
    }

    await deletePassword(id, auth.user.id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("DELETE /api/passwords error:", error);
    return NextResponse.json(
      { error: "Failed to delete password" },
      { status: 500 }
    );
  }
}
