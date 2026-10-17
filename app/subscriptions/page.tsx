"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

import type { Subscription } from "@/lib/types";
export type { Subscription };

export default function SubscriptionsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [filter, setFilter] = useState<"all" | "urgent">("all");
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

  // On-demand calculated time remaining state (no continuous ticker)
  const [calculatedTimes, setCalculatedTimes] = useState<
    Record<string, { text: string; isUrgent: boolean; isExpired: boolean }>
  >({});

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form Fields
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formPurchaseDate, setFormPurchaseDate] = useState("");
  const [formRenewalDate, setFormRenewalDate] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "error">(
    "saved"
  );

  const getTodayDate = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const getRelativeDate = (daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  // Fetch subscriptions from database API
  const fetchSubscriptions = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/subscriptions");
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (!res.ok) throw new Error("Failed to fetch subscriptions");
      const data: Subscription[] = await res.json();
      setSubscriptions(data);
      setSaveStatus("saved");
    } catch (err) {
      console.error("Error loading subscriptions from Supabase:", err);
      setSaveStatus("error");
    } finally {
      setIsLoading(false);
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSubscriptions();
    }
  }, [isAuthenticated, fetchSubscriptions]);

  // Helper: Calculate remaining time on-demand from current moment
  const calculateRemaining = (dateStr: string) => {
    if (!dateStr) return { text: "No date set", isUrgent: false, isExpired: false };
    const parts = dateStr.split("-").map(Number);
    if (parts.length < 3) return { text: "Invalid date", isUrgent: false, isExpired: false };

    const now = new Date();
    // Target midnight of renewal date
    const target = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
    const diffMs = target.getTime() - now.getTime();

    if (diffMs <= 0) {
      const endOfDay = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);
      if (now.getTime() <= endOfDay.getTime()) {
        return { text: "Renews Today", isUrgent: true, isExpired: true };
      }
      const daysAgo = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
      return {
        text: daysAgo > 0 ? `Expired (${daysAgo}d ago)` : "Expired / Due",
        isUrgent: true,
        isExpired: true,
      };
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);

    let text = "";
    if (days > 0) text += `${days}d `;
    text += `${hours}h ${minutes}m left`;

    const isUrgent = days <= 3;
    return { text, isUrgent, isExpired: false };
  };

  // Button Action: Calculate time remaining for single subscription
  const handleCalculateSingle = (sub: Subscription) => {
    const res = calculateRemaining(sub.renewalDate);
    setCalculatedTimes((prev) => ({ ...prev, [sub.id]: res }));
  };

  // Button Action: Calculate time remaining for ALL subscriptions
  const handleCalculateAll = () => {
    const nextMap: Record<string, { text: string; isUrgent: boolean; isExpired: boolean }> = {};
    subscriptions.forEach((sub) => {
      nextMap[sub.id] = calculateRemaining(sub.renewalDate);
    });
    setCalculatedTimes(nextMap);
  };

  // Open modal to add
  const handleOpenAdd = () => {
    const today = getTodayDate();
    setEditingId(null);
    setFormName("");
    setFormAmount("");
    setFormPurchaseDate(today);
    setFormRenewalDate(getRelativeDate(30));
    setIsModalOpen(true);
  };

  // When purchase date changes, auto-suggest renewal date 1 month later
  const handlePurchaseDateChange = (newPurchaseDate: string) => {
    setFormPurchaseDate(newPurchaseDate);
    if (newPurchaseDate) {
      const parts = newPurchaseDate.split("-").map(Number);
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        d.setMonth(d.getMonth() + 1);
        const pad = (n: number) => String(n).padStart(2, "0");
        setFormRenewalDate(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
      }
    }
  };

  // Open modal to edit
  const handleOpenEdit = (sub: Subscription) => {
    setEditingId(sub.id);
    setFormName(sub.name);
    setFormAmount(sub.amount.toString());
    setFormPurchaseDate(sub.purchaseDate || getTodayDate());
    setFormRenewalDate(sub.renewalDate);
    setIsModalOpen(true);
  };

  // Save (Add or Update)
  // Save (Add or Update) via API
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formRenewalDate) return;

    const amountNum = parseFloat(formAmount) || 0;
    const finalPurchaseDate = formPurchaseDate || getTodayDate();
    const idToUse = editingId || `sub-${Date.now()}`;

    const subItem: Subscription = {
      id: idToUse,
      name: formName.trim(),
      amount: amountNum,
      purchaseDate: finalPurchaseDate,
      renewalDate: formRenewalDate,
    };

    setSaveStatus("saving");
    try {
      const res = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subItem),
      });

      if (!res.ok) throw new Error("Failed to save subscription");

      if (editingId) {
        setSubscriptions((prev) =>
          prev.map((s) => (s.id === editingId ? subItem : s))
        );
        setCalculatedTimes((prev) => ({
          ...prev,
          [editingId]: calculateRemaining(formRenewalDate),
        }));
      } else {
        setSubscriptions((prev) => [subItem, ...prev]);
      }

      setSaveStatus("saved");
      setIsModalOpen(false);
    } catch (err) {
      console.error("Save subscription error:", err);
      setSaveStatus("error");
      alert("Failed to save subscription to database.");
    }
  };

  // Delete via API
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this subscription from database?")) return;

    setSaveStatus("saving");
    try {
      const res = await fetch(`/api/subscriptions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete subscription");

      setSubscriptions((prev) => prev.filter((s) => s.id !== id));
      setCalculatedTimes((prev) => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setSaveStatus("saved");
    } catch (err) {
      console.error("Delete subscription error:", err);
      setSaveStatus("error");
      alert("Failed to delete subscription from database.");
    }
  };

  // Format date display (e.g. Oct 18, 2026)
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

  // Statistics
  const stats = useMemo(() => {
    let urgentCount = 0;
    let urgentTotal = 0;
    let totalMonthly = 0;
    const now = currentTimestamp || 0;

    subscriptions.forEach((sub) => {
      totalMonthly += sub.amount;
      if (currentTimestamp) {
        const parts = sub.renewalDate.split("-").map(Number);
        if (parts.length === 3) {
          const target = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59).getTime();
          const diffDays = (target - now) / (1000 * 60 * 60 * 24);
          if (diffDays <= 3) {
            urgentCount++;
            urgentTotal += sub.amount;
          }
        }
      }
    });

    return { urgentCount, urgentTotal, totalMonthly };
  }, [subscriptions, currentTimestamp]);

  // Filtered List
  const displayedSubs = useMemo(() => {
    const now = currentTimestamp || 0;
    return [...subscriptions]
      .filter((s) => {
        if (filter === "urgent") {
          if (!currentTimestamp) return true;
          const parts = s.renewalDate.split("-").map(Number);
          if (parts.length === 3) {
            const target = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59).getTime();
            return (target - now) / (1000 * 60 * 60 * 24) <= 3;
          }
        }
        return true;
      })
      .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
  }, [subscriptions, filter, currentTimestamp]);

  // Auth loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
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
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-blue-600/20">
              S
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">
                Subscription Manager
              </h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span className="text-[11px] text-slate-400">
                  Supabase PG: {saveStatus === "saving" ? "Saving..." : saveStatus === "error" ? "Sync Error" : "Synced"}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 transition"
              title="Home Hub"
            >
              ← Hub
            </Link>
            <Link
              href="/projects"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 transition"
              title="Projects"
            >
              Projects
            </Link>
            <Link
              href="/passwords"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 transition"
              title="Password Manager"
            >
              Passwords
            </Link>
            <Link
              href="/prompts"
              className="text-xs text-slate-300 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 transition"
              title="Prompt Saver"
            >
              Prompts
            </Link>
            <button
              onClick={handleOpenAdd}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition cursor-pointer shadow-sm shadow-blue-600/30"
            >
              + Add
            </button>
            <Link
              href="/settings"
              className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-800 text-slate-300 hover:text-white transition flex items-center justify-center"
              title="Settings & Theme Selector"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
            <button
              onClick={handleLogout}
              className="text-xs text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/60 px-2.5 py-1.5 rounded-lg border border-red-500/30 transition cursor-pointer"
              title="Log Out"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-4">
        {/* Simple Summary Bar */}
        <div className="grid grid-cols-2 gap-3 bg-slate-900 p-4 rounded-xl border border-slate-800 shadow-md text-center">
          <div>
            <span className="text-xs text-slate-400 block">Total Subscriptions</span>
            <span className="text-lg font-bold text-white">{subscriptions.length}</span>
          </div>
          <div className="border-l border-slate-800">
            <span className="text-xs text-slate-400 block">Total Monthly Cost</span>
            <span className="text-lg font-bold text-white">
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
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
              }`}
            >
              All ({subscriptions.length})
            </button>
            <button
              onClick={() => setFilter("urgent")}
              className={`px-3 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                filter === "urgent"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800"
              }`}
            >
              Due in &lt; 3 Days ({stats.urgentCount})
            </button>
          </div>

          {/* Button to calculate remaining time for all subscriptions */}
          <button
            onClick={handleCalculateAll}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-blue-400 hover:text-blue-300 border border-slate-800 hover:border-slate-700 rounded-lg text-xs font-medium transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
            title="Calculate and show remaining time for all subscriptions"
          >
            <span>⏱️</span>
            <span>Check All Remaining Times</span>
          </button>
        </div>

        {/* Subscriptions List */}
        {isLoading ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center text-slate-400">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            <p className="text-sm font-medium">Loading subscriptions from Supabase PG...</p>
          </div>
        ) : displayedSubs.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center text-slate-400">
            <p className="text-sm font-medium">No subscriptions in database.</p>
            <button
              onClick={handleOpenAdd}
              className="mt-3 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg cursor-pointer shadow-sm shadow-blue-600/30"
            >
              + Add Subscription
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {displayedSubs.map((sub) => {
              const calc = calculatedTimes[sub.id];

              return (
                <div
                  key={sub.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 transition"
                >
                  {/* Left: Name, Cost, Purchase Date & Renewal Date */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-white text-base">{sub.name}</h3>
                      <span className="text-xs font-semibold text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        PKR {sub.amount.toLocaleString()}/mo
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                      <span>
                        Purchased:{" "}
                        <strong className="text-slate-200 font-medium">
                          {formatDateDisplay(sub.purchaseDate)}
                        </strong>
                      </span>
                      <span>•</span>
                      <span>
                        Renews:{" "}
                        <strong className="text-slate-200 font-medium">
                          {formatDateDisplay(sub.renewalDate)}
                        </strong>
                      </span>
                    </div>
                  </div>

                  {/* Middle: On-demand Calculate Time Remaining */}
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
                          onClick={() => handleCalculateSingle(sub)}
                          title="Recalculate remaining time"
                          className="text-xs text-slate-400 hover:text-white p-1 hover:bg-slate-800 rounded transition cursor-pointer"
                        >
                          ↻
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleCalculateSingle(sub)}
                        className="text-xs text-blue-400 hover:text-blue-300 bg-blue-950/50 hover:bg-blue-950/80 border border-blue-500/30 px-2.5 py-1 rounded-md font-medium transition cursor-pointer"
                      >
                        ⏱️ Check Time Left
                      </button>
                    )}
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800 justify-end">
                    <button
                      onClick={() => handleOpenEdit(sub)}
                      className="text-xs text-slate-300 hover:text-white hover:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700 transition cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(sub.id)}
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

      {/* Add / Edit Subscription Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-30 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-xl shadow-2xl border border-slate-800 w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white">
                {editingId ? "Edit Subscription" : "Add Subscription"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              {/* 1. Subscription Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Subscription Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Netflix, ChatGPT, Spotify"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              {/* 2. Cost (PKR / month) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cost (PKR / month)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  placeholder="1500"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                />
              </div>

              {/* 3. Purchase Date (Placed before Renewal Date) */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Purchase Date
                </label>
                <input
                  type="date"
                  required
                  value={formPurchaseDate}
                  onChange={(e) => handlePurchaseDateChange(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition [color-scheme:dark]"
                />
              </div>

              {/* 4. Renewal Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Renewal Date
                </label>
                <input
                  type="date"
                  required
                  value={formRenewalDate}
                  onChange={(e) => setFormRenewalDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition [color-scheme:dark]"
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
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg shadow-sm shadow-blue-600/30 transition cursor-pointer"
                >
                  {editingId ? "Save Changes" : "Add Subscription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
