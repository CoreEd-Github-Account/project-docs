import { NextResponse } from "next/server";
import {
  getAllMonthlyExpenses,
  saveMonthlyExpense,
  deleteMonthlyExpense,
  getMonthlyExpenseCategories,
  saveMonthlyExpenseCategory,
} from "@/lib/db";
import { getAuthenticatedUser } from "@/lib/auth";
import type { MonthlyExpense } from "@/lib/types";

export async function GET() {
  const auth = await getAuthenticatedUser();
  if (!auth.authenticated || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [expenses, categories] = await Promise.all([
      getAllMonthlyExpenses(auth.user.id),
      getMonthlyExpenseCategories(auth.user.id),
    ]);
    return NextResponse.json({ expenses, categories });
  } catch (error) {
    console.error("GET /api/expenses error:", error);
    return NextResponse.json(
      { error: "Failed to fetch monthly expenses" },
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
    const data = await request.json();

    // Live sync custom category creation directly to database table
    if (data?.action === "add_category") {
      const catName = String(data.categoryName || "").trim();
      if (!catName) {
        return NextResponse.json(
          { error: "Category name is required" },
          { status: 400 }
        );
      }
      await saveMonthlyExpenseCategory(catName, auth.user.id);
      const categories = await getMonthlyExpenseCategories(auth.user.id);
      return NextResponse.json({ success: true, category: catName, categories });
    }

    if (!data || !data.name?.trim() || !data.dueDate) {
      return NextResponse.json(
        { error: "Expance name and due date are required" },
        { status: 400 }
      );
    }

    const expense: MonthlyExpense = {
      id: data.id || `exp-${Date.now()}`,
      name: data.name.trim(),
      category: data.category?.trim() || "anonymous",
      amount: Number(data.amount) || 0,
      dueDate: data.dueDate.slice(0, 10),
      isPaid: Boolean(data.isPaid),
      paidMonth:
        data.paidMonth !== undefined
          ? data.paidMonth
          : data.isPaid
          ? data.dueDate.slice(0, 7)
          : null,
      createdAt: data.createdAt || Date.now(),
      userId: auth.user.id,
    };

    await saveMonthlyExpense(expense, auth.user.id);
    return NextResponse.json({ success: true, expense });
  } catch (error) {
    console.error("POST /api/expenses error:", error);
    return NextResponse.json(
      { error: "Failed to save monthly expense" },
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
        { error: "Missing monthly expense id" },
        { status: 400 }
      );
    }

    await deleteMonthlyExpense(id, auth.user.id);
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("DELETE /api/expenses error:", error);
    return NextResponse.json(
      { error: "Failed to delete monthly expense" },
      { status: 500 }
    );
  }
}
