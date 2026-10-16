import { NextResponse } from "next/server";
import {
  getAllSubscriptions,
  saveSubscription,
  deleteSubscription,
} from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import type { Subscription } from "@/lib/types";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const subscriptions = await getAllSubscriptions(auth.user.id);
    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error("GET /api/subscriptions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
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
    const data: Partial<Subscription> = await request.json();
    if (!data || !data.name?.trim() || !data.renewalDate) {
      return NextResponse.json(
        { error: "Name and renewal date are required" },
        { status: 400 }
      );
    }

    const subscription: Subscription = {
      id: data.id || `sub-${Date.now()}`,
      name: data.name.trim(),
      amount: Number(data.amount) || 0,
      purchaseDate: data.purchaseDate || new Date().toISOString().slice(0, 10),
      renewalDate: data.renewalDate.slice(0, 10),
      createdAt: data.createdAt || Date.now(),
      userId: auth.user.id,
    };

    await saveSubscription(subscription, auth.user.id);
    return NextResponse.json({ success: true, subscription });
  } catch (error) {
    console.error("POST /api/subscriptions error:", error);
    return NextResponse.json(
      { error: "Failed to save subscription" },
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
        { error: "Missing subscription id" },
        { status: 400 }
      );
    }

    await deleteSubscription(id, auth.user.id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("DELETE /api/subscriptions error:", error);
    return NextResponse.json(
      { error: "Failed to delete subscription" },
      { status: 500 }
    );
  }
}
