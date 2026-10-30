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
  getAllMonthlyExpenses,
} from "@/lib/db";
import type { TaskNotification } from "@/lib/types";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [notifications, unreadCount, monthlyExpenses] = await Promise.all([
      getNotificationsByUser(auth.user.id),
      getUnreadNotificationCount(auth.user.id),
      getAllMonthlyExpenses(auth.user.id),
    ]);

    // Synthesize 3-day reminders for unpaid monthly payables due within <= 3 days
    const nowMs = Date.now();
    const expenseReminders: TaskNotification[] = [];
    for (const exp of monthlyExpenses) {
      if (exp.isPaid || !exp.dueDate) continue;
      const parts = exp.dueDate.split("-").map(Number);
      if (parts.length !== 3) continue;
      const targetMs = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59).getTime();
      const diffDays = (targetMs - nowMs) / (1000 * 60 * 60 * 24);
      if (diffDays <= 3) {
        const daysInt = Math.max(0, Math.floor((targetMs - nowMs) / (1000 * 60 * 60 * 24)));
        const dueLabel =
          targetMs < nowMs
            ? "is overdue"
            : daysInt === 0
              ? "is due today"
              : `is due in ${daysInt} day${daysInt === 1 ? "" : "s"}`;
        expenseReminders.push({
          id: `expense-reminder-${exp.id}-${exp.dueDate}`,
          userId: auth.user.id,
          projectId: "expenses",
          projectName: "Monthly Expense",
          actorId: auth.user.id,
          actorName: "Reminder",
          actorFullName: "Monthly Expense",
          actorAvatar: "🧾",
          type: "expense_reminder",
          title: `3-Day Bill Reminder: ${exp.name}`,
          message: `${exp.name} (PKR ${exp.amount.toLocaleString()}) ${dueLabel} (${exp.dueDate}).`,
          isRead: false,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return NextResponse.json({
      notifications: [...expenseReminders, ...notifications],
      unreadCount: unreadCount + expenseReminders.length,
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
