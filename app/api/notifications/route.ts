import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getNotificationsByUser,
  getUnreadNotificationCount,
  markNotificationRead,
  markNotificationUnread,
  markAllNotificationsRead,
  deleteNotification,
  clearAllNotifications,
} from "@/lib/db";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [notifications, unreadCount] = await Promise.all([
      getNotificationsByUser(auth.user.id),
      getUnreadNotificationCount(auth.user.id),
    ]);

    return NextResponse.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { error: "Failed to fetch notifications" },
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
    const { action, id } = body;

    if (action === "mark_read") {
      if (!id) {
        return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
      }
      await markNotificationRead(id, auth.user.id);
      return NextResponse.json({ success: true, id, isRead: true });
    }

    if (action === "mark_unread") {
      if (!id) {
        return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
      }
      await markNotificationUnread(id, auth.user.id);
      return NextResponse.json({ success: true, id, isRead: false });
    }

    if (action === "mark_all_read") {
      await markAllNotificationsRead(auth.user.id);
      return NextResponse.json({ success: true, allRead: true });
    }

    if (action === "delete") {
      if (!id) {
        return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
      }
      await deleteNotification(id, auth.user.id);
      return NextResponse.json({ success: true, id, deleted: true });
    }

    if (action === "clear_all") {
      await clearAllNotifications(auth.user.id);
      return NextResponse.json({ success: true, clearedAll: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/notifications error:", error);
    return NextResponse.json(
      { error: "Failed to process notification request" },
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
    const clearAll = searchParams.get("clearAll") === "true";

    if (clearAll) {
      await clearAllNotifications(auth.user.id);
      return NextResponse.json({ success: true, clearedAll: true });
    }

    if (!id) {
      return NextResponse.json({ error: "Missing notification id" }, { status: 400 });
    }

    await deleteNotification(id, auth.user.id);
    return NextResponse.json({ success: true, id, deleted: true });
  } catch (error) {
    console.error("DELETE /api/notifications error:", error);
    return NextResponse.json(
      { error: "Failed to delete notification" },
      { status: 500 }
    );
  }
}
