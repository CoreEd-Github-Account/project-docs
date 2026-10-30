"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { NotificationBell } from "@/components/NotificationBell";
import type { MonthlyExpense } from "@/lib/types";

export default function MonthlyExpensesPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [filter, setFilter] = useState<"all" | "reminder">("all");
  const [currentTimestamp, setCurrentTimestamp] = useState<number | null>(null);

  useEffect(() => {
    setCurrentTimestamp(Date.now());
  }, []);

  // Check auth
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();
      setIsAuthenticated(Boolean(data.authenticated));
    } catch {
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch (e) {
      console.error(e);
    } finally {
      setIsAuthenticated(false);
      window.location.href = "/";
    }
  };

  // On-demand calculated time remaining state (same as Subscriptions)
  const [calculatedTimes, setCalculatedTimes] = useState<
    Record<
      string,
      { text: string; isUrgent: boolean; isExpired: boolean; daysLeft: number }
    >
  >({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("anonymous");
  const [formAmount, setFormAmount] = useState("");
  const [formDueDate, setFormDueDate] = useState("");

  // Custom Category Creation State
  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved"
  );

  // All available categories: only "anonymous" by default + user's DB-synced custom categories
  const availableCategories = useMemo(() => {
    const set = new Set<string>(["anonymous"]);
    customCategories.forEach((cat) => {
      if (cat && cat.trim()) set.add(cat.trim());
    });
    expenses.forEach((exp) => {
      if (exp.category && exp.category.trim()) set.add(exp.category.trim());
    });
    return Array.from(set);
  }, [customCategories, expenses]);

  const getRelativeDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Helper: Calculate remaining time until due date (with 3-day reminder detection)
  const calculateRemaining = useCallback((dateStr: string) => {
    if (!dateStr)
      return {
        text: "No due date",
        isUrgent: false,
        isExpired: false,
        daysLeft: 999,
      };
    const parts = dateStr.split("-").map(Number);
    if (parts.length < 3)
      return {
        text: "Invalid date",
        isUrgent: false,
        isExpired: false,
        daysLeft: 999,
      };

    const now = new Date();
    const target = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
    const diffMs = target.getTime() - now.getTime();

    if (diffMs <= 0) {
      const endOfDay = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);
      if (now.getTime() <= endOfDay.getTime()) {
        return {
          text: "Due Today",
          isUrgent: true,
          isExpired: true,
          daysLeft: 0,
        };
      }
      const daysAgo = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
      return {
        text: daysAgo > 0 ? `Overdue (${daysAgo}d ago)` : "Overdue / Due",
        isUrgent: true,
        isExpired: true,
        daysLeft: -daysAgo,
      };
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);

    let text = "";
    if (days > 0) text += `${days}d `;
    text += `${hours}h ${minutes}m left`;

    // Remind 3 days before due date
    const isUrgent = days <= 3;
    return { text, isUrgent, isExpired: false, daysLeft: days };
  }, []);

  // Fetch monthly expenses & custom categories from database API (with live sync)
  const fetchExpenses = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      const res = await fetch("/api/expenses", { cache: "no-store" });
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch monthly expenses");
      const data = await res.json();
      if (Array.isArray(data)) {
        setExpenses(data);
      } else {
        setExpenses(Array.isArray(data.expenses) ? data.expenses : []);
        if (Array.isArray(data.categories)) {
          setCustomCategories(data.categories);
        }
      }
      setSaveStatus("saved");
    } catch (err) {
      console.error("Error loading monthly expenses:", err);
      setSaveStatus("error");
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchExpenses(false);

    // Live sync on window focus & every 20s
    const interval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchExpenses(true);
      }
    }, 20000);
    const handleFocus = () => fetchExpenses(true);
    window.addEventListener("focus", handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [isAuthenticated, fetchExpenses]);

  // Live-sync custom category creation with database
  const handleCreateCustomCategory = async () => {
    const clean = newCategoryInput.trim();
    if (!clean) return;

    setFormCategory(clean);
    setNewCategoryInput("");
    setIsAddingCustomCategory(false);
    setCustomCategories((prev) =>
      prev.includes(clean) ? prev : [...prev, clean]
    );

    setSaveStatus("saving");
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_category",
          categoryName: clean,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.categories)) {
          setCustomCategories(data.categories);
        }
        setSaveStatus("saved");
      } else {
        setSaveStatus("error");
      }
    } catch (err) {
      console.error("Custom category sync error:", err);
      setSaveStatus("error");
    }
  };

  // Button Action: Calculate time remaining for single payable
  const handleCalculateSingle = (exp: MonthlyExpense) => {
    const res = calculateRemaining(exp.dueDate);
    setCalculatedTimes((prev) => ({ ...prev, [exp.id]: res }));
  };

  // Button Action: Calculate time remaining for ALL payables
  const handleCalculateAll = () => {
    const nextMap: Record<
      string,
      { text: string; isUrgent: boolean; isExpired: boolean; daysLeft: number }
    > = {};
    expenses.forEach((exp) => {
      nextMap[exp.id] = calculateRemaining(exp.dueDate);
    });
    setCalculatedTimes(nextMap);
  };

  // Open modal to add new payable
  const handleOpenAdd = () => {
    setEditingId(null);
    setFormName("");
    setFormCategory("anonymous");
    setFormAmount("");
    setFormDueDate(getRelativeDate(5));
    setIsAddingCustomCategory(false);
    setNewCategoryInput("");
    setIsModalOpen(true);
  };

  // Open modal to edit payable
  const handleOpenEdit = (exp: MonthlyExpense) => {
    setEditingId(exp.id);
    setFormName(exp.name);
    setFormCategory(exp.category || "anonymous");
    setFormAmount(exp.amount.toString());
    setFormDueDate(exp.dueDate);
    setIsAddingCustomCategory(false);
    setNewCategoryInput("");
    setIsModalOpen(true);
  };

  // Save (Add or Update) via API
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formDueDate) return;

    const amountNum = parseFloat(formAmount) || 0;
    const idToUse = editingId || `exp-${Date.now()}`;
    const existing = expenses.find((item) => item.id === editingId);
    const chosenCategory = formCategory.trim() || "anonymous";

    const expItem: MonthlyExpense = {
      id: idToUse,
      name: formName.trim(),
      category: chosenCategory,
      amount: amountNum,
      dueDate: formDueDate,
      isPaid: existing ? Boolean(existing.isPaid) : false,
    };

    setSaveStatus("saving");
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(expItem),
      });

      if (!res.ok) throw new Error("Failed to save monthly expense");

      if (editingId) {
        setExpenses((prev) =>
          prev.map((item) => (item.id === editingId ? expItem : item))
        );
        setCalculatedTimes((prev) => ({
          ...prev,
          [editingId]: calculateRemaining(formDueDate),
        }));
      } else {
        setExpenses((prev) => [expItem, ...prev]);
      }

      setSaveStatus("saved");
      setIsModalOpen(false);
    } catch (err) {
      console.error("Save monthly expense error:", err);
      setSaveStatus("error");
      alert("Failed to save monthly expense to database.");
    }
  };

  // Mark paid for current cycle & roll due date forward by +1 month
  const handleMarkPaidNextMonth = async (exp: MonthlyExpense) => {
    const parts = exp.dueDate.split("-").map(Number);
    let nextDueDate = exp.dueDate;
    if (parts.length === 3) {
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      d.setMonth(d.getMonth() + 1);
      const pad = (n: number) => String(n).padStart(2, "0");
      nextDueDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate()
      )}`;
    }

    const updated: MonthlyExpense = {
      ...exp,
      dueDate: nextDueDate,
      isPaid: false,
    };

    setSaveStatus("saving");
    try {
      const res = await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error("Failed to update due date");

      setExpenses((prev) =>
        prev.map((item) => (item.id === exp.id ? updated : item))
      );
      setCalculatedTimes((prev) => ({
        ...prev,
        [exp.id]: calculateRemaining(nextDueDate),
      }));
      setSaveStatus("saved");
    } catch (err) {
      console.error("Error advancing due date:", err);
      setSaveStatus("error");
    }
  };

  // Delete via API
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this monthly expense from database?")) return;

    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/expenses?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete monthly expense");

      setExpenses((prev) => prev.filter((item) => item.id !== id));
      setCalculatedTimes((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setSaveStatus("saved");
    } catch (err) {
      console.error("Delete monthly expense error:", err);
      setSaveStatus("error");
      alert("Failed to delete monthly expense from database.");
    }
  };

  // Format date display (e.g. Nov 25, 2026)
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr) return "-";
    const parts = dateStr.split("-").map(Number);
    if (parts.length < 3) return dateStr;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Check if an expense is within the 3-day reminder window
  const isWithinThreeDays = useCallback(
    (dueDateStr: string) => {
      if (!currentTimestamp || !dueDateStr) return false;
      const parts = dueDateStr.split("-").map(Number);
      if (parts.length !== 3) return false;
      const target = new Date(
        parts[0],
        parts[1] - 1,
        parts[2],
        23,
        59,
        59
      ).getTime();
      const diffDays = (target - currentTimestamp) / (1000 * 60 * 60 * 24);
      return diffDays <= 3;
    },
    [currentTimestamp]
  );

  // Statistics & 3-Day Reminder items
  const stats = useMemo(() => {
    let totalMonthly = 0;
    const reminderItems: MonthlyExpense[] = [];

    expenses.forEach((exp) => {
      totalMonthly += exp.amount;
      if (!exp.isPaid && isWithinThreeDays(exp.dueDate)) {
        reminderItems.push(exp);
      }
    });

    return {
      totalMonthly,
      reminderCount: reminderItems.length,
      reminderItems,
    };
  }, [expenses, isWithinThreeDays]);

  // Filtered List
  const displayedExpenses = useMemo(() => {
    return [...expenses]
      .filter((exp) => {
        if (filter === "reminder") {
          return !exp.isPaid && isWithinThreeDays(exp.dueDate);
        }
        return true;
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [expenses, filter, isWithinThreeDays]);

  // Auth loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Verifying access...</p>
      </div>
    );
  }

  // Unauthenticated -> Show Login Form
  if (!isAuthenticated) {
    return (
      <LoginForm
        onLoginSuccess={() => {
          setIsAuthenticated(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col">
      {/* Top Header */}
      <header className="bg-slate-900/90 border-b border-slate-800 sticky top-0 z-10 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-teal-600/20">
              🧾
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">
                Monthly Expense
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span className="text-[11px] text-slate-400">
                  Supabase PG:{" "}
                  {saveStatus === "saving"
                    ? "Saving..."
                    : saveStatus === "error"
                      ? "Sync Error"
                      : "Synced"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href="/"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 transition"
            >
              ← Hub
            </Link>
            <Link
              href="/subscriptions"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 transition"
            >
              Subscriptions
            </Link>
            <Link
              href="/commands"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 transition"
            >
              Commands
            </Link>
            <button
              onClick={handleOpenAdd}
              className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-xs font-medium transition cursor-pointer shadow-sm shadow-teal-600/30"
            >
              + Add Payable
            </button>
            <NotificationBell />
            <button
              onClick={handleLogout}
              className="text-xs text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/60 px-2.5 py-1.5 rounded-lg border border-red-500/30 transition cursor-pointer"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* 3-Day Automatic Reminder Banner */}
        {stats.reminderItems.length > 0 && (
          <div className="rounded-xl bg-amber-950/40 border border-amber-500/40 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
            <div className="flex items-start sm:items-center gap-3">
              <span className="text-xl">🔔</span>
              <div>
                <p className="text-xs font-bold text-amber-300">
                  3-Day Payable Reminder ({stats.reminderItems.length}{" "}
                  {stats.reminderItems.length === 1 ? "bill" : "bills"} due soon)
                </p>
                <p className="text-xs text-slate-300 mt-0.5">
                  {stats.reminderItems
                    .map(
                      (item) =>
                        `${item.name} (PKR ${item.amount.toLocaleString()} • Due ${formatDateDisplay(
                          item.dueDate
                        )})`
                    )
                    .join("  |  ")}
                </p>
              </div>
            </div>
            <button
              onClick={() => setFilter("reminder")}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold transition cursor-pointer shrink-0"
            >
              View Due Bills
            </button>
          </div>
        )}

        {/* Simple Summary Bar */}
        <div className="grid grid-cols-3 gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md text-center">
          <div>
            <span className="text-xs text-slate-400 block">
              Total Monthly Bills
            </span>
            <span className="text-lg font-bold text-white">
              {expenses.length}
            </span>
          </div>
          <div className="border-l border-slate-800">
            <span className="text-xs text-slate-400 block">
              Due in &le; 3 Days
            </span>
            <span
              className={`text-lg font-bold ${
                stats.reminderCount > 0 ? "text-amber-400" : "text-emerald-400"
              }`}
            >
              {stats.reminderCount}
            </span>
          </div>
          <div className="border-l border-slate-800">
            <span className="text-xs text-slate-400 block">
              Total Monthly Payable
            </span>
            <span className="text-lg font-bold text-white font-mono">
              PKR {stats.totalMonthly.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Toolbar: Filters and Calculate Remaining Time button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                filter === "all"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
              }`}
            >
              All Payables ({expenses.length})
            </button>
            <button
              onClick={() => setFilter("reminder")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                filter === "reminder"
                  ? "bg-teal-600 text-white shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
              }`}
            >
              3-Day Reminder ({stats.reminderCount})
            </button>
          </div>

          {/* Button to calculate remaining time for all monthly payables */}
          <button
            onClick={handleCalculateAll}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-teal-400 hover:text-teal-300 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            title="Calculate and show remaining time for all monthly bills"
          >
            <span>⏱️</span>
            <span>Check All Remaining Times</span>
          </button>
        </div>

        {/* Monthly Expenses List */}
        {isLoading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm font-medium">
              Loading monthly expenses from Supabase PG...
            </p>
          </div>
        ) : displayedExpenses.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
            <p className="text-sm font-medium">
              No monthly expenses found. Add your monthly payables here.
            </p>
            <button
              onClick={handleOpenAdd}
              className="mt-3 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium rounded-lg cursor-pointer shadow-sm shadow-teal-600/30"
            >
              + Add Monthly Expense
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedExpenses.map((exp) => {
              const calc = calculatedTimes[exp.id];
              const dueSoon = isWithinThreeDays(exp.dueDate);

              return (
                <div
                  key={exp.id}
                  className={`bg-slate-900 border rounded-xl p-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 transition ${
                    dueSoon
                      ? "border-amber-500/45 hover:border-amber-500/70"
                      : "border-slate-800 hover:border-slate-700"
                  }`}
                >
                  {/* Left: Icon, Name, Category, Amount, Due Date & 3-Day Reminder Badge */}
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-lg shrink-0 mt-0.5">
                      🧾
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-white text-base">
                          {exp.name}
                        </h3>
                        <span className="text-[11px] font-medium text-teal-300 bg-teal-950/60 px-2 py-0.5 rounded border border-teal-500/30">
                          {exp.category || "anonymous"}
                        </span>
                        <span className="text-xs font-semibold text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 font-mono">
                          PKR {exp.amount.toLocaleString()}/mo
                        </span>
                        {dueSoon && (
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                            🔔 Reminder (&le; 3d)
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                        <span>
                          Due Date:{" "}
                          <strong className="text-slate-200 font-medium">
                            {formatDateDisplay(exp.dueDate)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: On-demand Calculate Time Remaining (same as Subscription) */}
                  <div className="flex items-center gap-2">
                    {calc ? (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono text-xs font-bold px-2.5 py-1 rounded-md border ${
                            calc.isExpired
                              ? "bg-red-950/60 text-red-400 border-red-500/40"
                              : calc.isUrgent
                                ? "bg-amber-950/60 text-amber-400 border-amber-500/40"
                                : "bg-slate-800 text-slate-200 border-slate-700"
                          }`}
                        >
                          {calc.text}
                        </span>
                        <button
                          onClick={() => handleCalculateSingle(exp)}
                          title="Recalculate remaining time"
                          className="text-xs text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition cursor-pointer"
                        >
                          ↻
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCalculateSingle(exp)}
                        className="text-xs text-teal-400 hover:text-teal-300 bg-teal-950/50 hover:bg-teal-950/80 border border-teal-500/30 px-2.5 py-1 rounded-md font-medium transition cursor-pointer"
                      >
                        ⏱️ Check Time Left
                      </button>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800 justify-end">
                    <button
                      onClick={() => handleMarkPaidNextMonth(exp)}
                      title="Mark this month's bill paid and advance due date by 1 month"
                      className="text-xs text-emerald-300 hover:text-white bg-emerald-950/40 hover:bg-emerald-600/30 px-2.5 py-1 rounded-md border border-emerald-500/30 transition cursor-pointer"
                    >
                      ✓ Paid (+1 Mo)
                    </button>
                    <button
                      onClick={() => handleOpenEdit(exp)}
                      className="text-xs text-slate-300 hover:text-white hover:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700 transition cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(exp.id)}
                      className="text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 px-2.5 py-1 rounded-md border border-red-500/20 transition cursor-pointer"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add / Edit Monthly Payable Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-30 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-800 w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">
                {editingId ? "Edit Monthly Payable" : "Add Monthly Payable"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              {/* 1. expance name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  expance name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Internet Bill, Water Bill"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                />
              </div>

              {/* 2. Category ("anonymous" badge + custom category creator) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Category
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setIsAddingCustomCategory(!isAddingCustomCategory)
                    }
                    className="text-[11px] font-semibold text-teal-400 hover:text-teal-300 transition cursor-pointer"
                  >
                    {isAddingCustomCategory ? "Cancel" : "+ Create custom"}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition cursor-pointer ${
                        formCategory === cat
                          ? "bg-teal-600/25 border-teal-500 text-teal-200 shadow-sm"
                          : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
                      <span>{cat}</span>
                    </button>
                  ))}
                </div>

                {isAddingCustomCategory && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="New category name..."
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateCustomCategory();
                        }
                      }}
                      className="flex-1 px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
                    />
                    <button
                      type="button"
                      onClick={handleCreateCustomCategory}
                      className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold transition cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Amount (PKR / month) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Amount (PKR / month)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  placeholder="4500"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition"
                />
              </div>

              {/* 4. Monthly Due Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Due Date (Reminds 3 days before)
                </label>
                <input
                  type="date"
                  required
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition [color-scheme:dark]"
                />
              </div>

              {/* Modal Buttons */}
              <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg shadow-sm shadow-teal-600/30 transition cursor-pointer"
                >
                  {editingId ? "Save Changes" : "Add Payable"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
