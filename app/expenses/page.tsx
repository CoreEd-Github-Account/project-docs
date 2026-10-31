"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { LoginForm } from "@/components/LoginForm";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
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

  const [calculatedTimes, setCalculatedTimes] = useState<
    Record<
      string,
      { text: string; isUrgent: boolean; isExpired: boolean; daysLeft: number }
    >
  >({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("anonymous");
  const [formAmount, setFormAmount] = useState("");
  const [formDueDate, setFormDueDate] = useState("");

  const [isAddingCustomCategory, setIsAddingCustomCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved"
  );

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

  const calculateRemaining = useCallback((dateStr: string) => {
    if (!dateStr)
      return {
        text: "No date",
        isUrgent: false,
        isExpired: false,
        daysLeft: 999,
      };
    const parts = dateStr.split("-").map(Number);
    if (parts.length < 3)
      return {
        text: "Invalid",
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
          text: "Due today",
          isUrgent: true,
          isExpired: true,
          daysLeft: 0,
        };
      }
      const daysAgo = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
      return {
        text: daysAgo > 0 ? `${daysAgo}d overdue` : "Overdue",
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
    text += `${hours}h ${minutes}m`;

    const isUrgent = days <= 3;
    return { text, isUrgent, isExpired: false, daysLeft: days };
  }, []);

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

  const handleCalculateSingle = (exp: MonthlyExpense) => {
    const res = calculateRemaining(exp.dueDate);
    setCalculatedTimes((prev) => ({ ...prev, [exp.id]: res }));
  };

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

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center text-slate-400">
        <div className="w-7 h-7 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

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
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans flex flex-col">
      <WorkspaceHeader
        title="Monthly Expense"
        icon="🧾"
        saveStatus={saveStatus}
        primaryAction={{
          label: "Add Payable",
          onClick: handleOpenAdd,
          icon: "+",
        }}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-5">
        {/* 3-Day Urgent Strip (only visible when bills are due within 3 days) */}
        {stats.reminderItems.length > 0 && (
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 text-xs">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <span className="font-semibold text-amber-200 truncate">
                Due within 3 days:{" "}
                {stats.reminderItems
                  .map((i) => `${i.name} (PKR ${i.amount.toLocaleString()})`)
                  .join(" • ")}
              </span>
            </div>
            <button
              onClick={() => setFilter("reminder")}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-semibold transition cursor-pointer shrink-0"
            >
              Filter
            </button>
          </div>
        )}

        {/* Minimal Single-Row Header: Title + Filters on Left, Total + Countdown on Right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Monthly Expenses
            </h1>
            <div className="flex items-center gap-1 bg-[#10131c] p-1 rounded-xl border border-white/[0.07]">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
                  filter === "all"
                    ? "bg-white/[0.1] text-white shadow-xs"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                All ({expenses.length})
              </button>
              <button
                onClick={() => setFilter("reminder")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  filter === "reminder"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>Due &le; 3d</span>
                <span className="font-mono text-[11px] opacity-80">
                  {stats.reminderCount}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3">
            <div className="flex items-baseline gap-1.5 px-3 py-1.5 rounded-xl bg-[#10131c] border border-white/[0.07]">
              <span className="text-[11px] text-slate-400">Total</span>
              <span className="text-sm font-bold font-mono text-white tabular-nums">
                PKR {stats.totalMonthly.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">/mo</span>
            </div>

            <button
              onClick={handleCalculateAll}
              className="px-3 py-1.5 rounded-xl bg-[#10131c] hover:bg-white/[0.06] text-slate-300 hover:text-white border border-white/[0.07] text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
              title="Calculate remaining time for all bills"
            >
              <span>⏱️</span>
              <span>Time Left</span>
            </button>
          </div>
        </div>

        {/* Unified Minimal Ledger */}
        {isLoading ? (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] p-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5" />
            <p className="text-xs">Loading payables...</p>
          </div>
        ) : displayedExpenses.length === 0 ? (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] p-12 text-center space-y-3">
            <p className="text-sm text-slate-400">No monthly expenses found.</p>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              + Add Payable
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] divide-y divide-white/[0.06] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            {displayedExpenses.map((exp) => {
              const calc = calculatedTimes[exp.id];
              const dueSoon = isWithinThreeDays(exp.dueDate);

              return (
                <div
                  key={exp.id}
                  className={`group px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors ${
                    dueSoon
                      ? "bg-amber-500/[0.03] hover:bg-amber-500/[0.06]"
                      : "hover:bg-white/[0.02]"
                  }`}
                >
                  {/* Left: Avatar + Name + Category + Due Date */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-bold uppercase shrink-0 border ${
                        dueSoon
                          ? "bg-amber-500/15 border-amber-500/35 text-amber-300"
                          : "bg-[#151926] border-white/[0.08] text-slate-300"
                      }`}
                    >
                      {exp.name.slice(0, 2)}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-white text-sm truncate">
                          {exp.name}
                        </h3>
                        <span className="text-[11px] font-medium text-slate-400 bg-white/[0.04] px-2 py-0.5 rounded-md border border-white/[0.07]">
                          {exp.category || "anonymous"}
                        </span>
                        {dueSoon && (
                          <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-md">
                            Due soon
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Due {formatDateDisplay(exp.dueDate)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Time Left + Price + Compact Actions */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.05]">
                    {/* Time Left Pill */}
                    {calc ? (
                      <button
                        onClick={() => handleCalculateSingle(exp)}
                        title="Click to refresh time remaining"
                        className={`font-mono text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                          calc.isExpired
                            ? "bg-rose-500/15 text-rose-300 border-rose-500/30"
                            : calc.isUrgent
                              ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                              : "bg-white/[0.04] text-slate-300 border-white/[0.08]"
                        }`}
                      >
                        {calc.text}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCalculateSingle(exp)}
                        className="text-[11px] text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] px-2.5 py-1 rounded-lg font-medium transition cursor-pointer"
                      >
                        ⏱️ Time left
                      </button>
                    )}

                    {/* Prominent Amount */}
                    <div className="text-right min-w-[96px]">
                      <span className="text-sm font-bold font-mono text-white tabular-nums">
                        PKR {exp.amount.toLocaleString()}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleMarkPaidNextMonth(exp)}
                        title="Mark paid and advance due date by 1 month"
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/25 transition cursor-pointer"
                      >
                        ✓ Paid
                      </button>
                      <button
                        onClick={() => handleOpenEdit(exp)}
                        title="Edit"
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] flex items-center justify-center transition cursor-pointer"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        title="Delete"
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition cursor-pointer"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add / Edit Monthly Payable Modal */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-[#10131c] rounded-2xl shadow-2xl border border-white/[0.08] w-full max-w-sm p-5 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
              <h2 className="text-sm font-bold text-white">
                {editingId ? "Edit Payable" : "Add Payable"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              {/* 1. expance name */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  expance name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Internet, Kameti, Electricity"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#07090e] border border-white/[0.09] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
                />
              </div>

              {/* 2. Category ("anonymous" badge + custom category creator) */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-medium text-slate-300">
                    Category
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setIsAddingCustomCategory(!isAddingCustomCategory)
                    }
                    className="text-[11px] font-semibold text-orange-400 hover:text-orange-300 transition cursor-pointer"
                  >
                    {isAddingCustomCategory ? "Cancel" : "+ Custom"}
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {availableCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setFormCategory(cat)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition cursor-pointer ${
                        formCategory === cat
                          ? "bg-orange-500/20 border-orange-500/50 text-orange-200"
                          : "bg-[#07090e] border-white/[0.08] text-slate-400 hover:text-white"
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                      <span>{cat}</span>
                    </button>
                  ))}
                </div>

                {isAddingCustomCategory && (
                  <div className="mt-2 flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Category name..."
                      value={newCategoryInput}
                      onChange={(e) => setNewCategoryInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleCreateCustomCategory();
                        }
                      }}
                      className="flex-1 px-2.5 py-1.5 text-xs bg-[#07090e] border border-white/[0.1] rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={handleCreateCustomCategory}
                      className="px-3 py-1.5 text-xs font-semibold bg-orange-500 hover:bg-orange-400 text-white rounded-lg transition cursor-pointer"
                    >
                      Add
                    </button>
                  </div>
                )}
              </div>

              {/* 3. Amount (PKR / month) */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Amount (PKR)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  placeholder="2500"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#07090e] border border-white/[0.09] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition font-mono"
                />
              </div>

              {/* 4. Due Date */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  required
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#07090e] border border-white/[0.09] rounded-xl text-white focus:outline-none focus:border-orange-500 transition [color-scheme:dark]"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2 border-t border-white/[0.07]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-400 rounded-lg transition cursor-pointer"
                >
                  {editingId ? "Save" : "Add Payable"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
