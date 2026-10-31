"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { LoginForm } from "@/components/LoginForm";
import { WorkspaceHeader } from "@/components/WorkspaceHeader";
import type { Subscription } from "@/lib/types";
export type { Subscription };

export default function SubscriptionsPage() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [filter, setFilter] = useState<"all" | "urgent">("all");
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
    Record<string, { text: string; isUrgent: boolean; isExpired: boolean }>
  >({});

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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
      console.error("Error loading subscriptions:", err);
      setSaveStatus("error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchSubscriptions();
    }
  }, [isAuthenticated, fetchSubscriptions]);

  const calculateRemaining = (dateStr: string) => {
    if (!dateStr)
      return { text: "No date", isUrgent: false, isExpired: false };
    const parts = dateStr.split("-").map(Number);
    if (parts.length < 3)
      return { text: "Invalid", isUrgent: false, isExpired: false };

    const now = new Date();
    const target = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
    const diffMs = target.getTime() - now.getTime();

    if (diffMs <= 0) {
      const endOfDay = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);
      if (now.getTime() <= endOfDay.getTime()) {
        return { text: "Renews today", isUrgent: true, isExpired: true };
      }
      const daysAgo = Math.floor(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
      return {
        text: daysAgo > 0 ? `Expired ${daysAgo}d ago` : "Expired",
        isUrgent: true,
        isExpired: true,
      };
    }

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diffMs / (1000 * 60)) % 60);

    let text = "";
    if (days > 0) text += `${days}d `;
    text += `${hours}h ${minutes}m`;

    const isUrgent = days <= 3;
    return { text, isUrgent, isExpired: false };
  };

  const handleCalculateSingle = (sub: Subscription) => {
    const res = calculateRemaining(sub.renewalDate);
    setCalculatedTimes((prev) => ({ ...prev, [sub.id]: res }));
  };

  const handleCalculateAll = () => {
    const nextMap: Record<
      string,
      { text: string; isUrgent: boolean; isExpired: boolean }
    > = {};
    subscriptions.forEach((sub) => {
      nextMap[sub.id] = calculateRemaining(sub.renewalDate);
    });
    setCalculatedTimes(nextMap);
  };

  const handleOpenAdd = () => {
    const today = getTodayDate();
    setEditingId(null);
    setFormName("");
    setFormAmount("");
    setFormPurchaseDate(today);
    setFormRenewalDate(getRelativeDate(30));
    setIsModalOpen(true);
  };

  const handlePurchaseDateChange = (newPurchaseDate: string) => {
    setFormPurchaseDate(newPurchaseDate);
    if (newPurchaseDate) {
      const parts = newPurchaseDate.split("-").map(Number);
      if (parts.length === 3) {
        const d = new Date(parts[0], parts[1] - 1, parts[2]);
        d.setMonth(d.getMonth() + 1);
        const pad = (n: number) => String(n).padStart(2, "0");
        setFormRenewalDate(
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        );
      }
    }
  };

  const handleOpenEdit = (sub: Subscription) => {
    setEditingId(sub.id);
    setFormName(sub.name);
    setFormAmount(sub.amount.toString());
    setFormPurchaseDate(sub.purchaseDate || getTodayDate());
    setFormRenewalDate(sub.renewalDate);
    setIsModalOpen(true);
  };

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

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this subscription from database?")) return;

    setSaveStatus("saving");
    try {
      const res = await fetch(
        `/api/subscriptions?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
        }
      );

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

  const stats = useMemo(() => {
    let urgentCount = 0;
    let totalMonthly = 0;
    const now = currentTimestamp || 0;

    subscriptions.forEach((sub) => {
      totalMonthly += sub.amount;
      if (currentTimestamp) {
        const parts = sub.renewalDate.split("-").map(Number);
        if (parts.length === 3) {
          const target = new Date(
            parts[0],
            parts[1] - 1,
            parts[2],
            23,
            59,
            59
          ).getTime();
          const diffDays = (target - now) / (1000 * 60 * 60 * 24);
          if (diffDays <= 3) {
            urgentCount++;
          }
        }
      }
    });

    return { urgentCount, totalMonthly };
  }, [subscriptions, currentTimestamp]);

  const displayedSubs = useMemo(() => {
    const now = currentTimestamp || 0;
    return [...subscriptions]
      .filter((s) => {
        if (filter === "urgent") {
          if (!currentTimestamp) return true;
          const parts = s.renewalDate.split("-").map(Number);
          if (parts.length === 3) {
            const target = new Date(
              parts[0],
              parts[1] - 1,
              parts[2],
              23,
              59,
              59
            ).getTime();
            return (target - now) / (1000 * 60 * 60 * 24) <= 3;
          }
        }
        return true;
      })
      .sort((a, b) => a.renewalDate.localeCompare(b.renewalDate));
  }, [subscriptions, filter, currentTimestamp]);

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
        title="Subscriptions"
        icon="⏱️"
        saveStatus={saveStatus}
        primaryAction={{
          label: "Add Subscription",
          onClick: handleOpenAdd,
          icon: "+",
        }}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-8 space-y-5">
        {/* Minimal Single-Row Header: Title + Filters on Left, Total + Countdown on Right */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Subscriptions
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
                All ({subscriptions.length})
              </button>
              <button
                onClick={() => setFilter("urgent")}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
                  filter === "urgent"
                    ? "bg-amber-500/20 text-amber-300"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <span>Due &le; 3d</span>
                <span className="font-mono text-[11px] opacity-80">
                  {stats.urgentCount}
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
              title="Calculate remaining time for all subscriptions"
            >
              <span>⏱️</span>
              <span>Time Left</span>
            </button>
          </div>
        </div>

        {/* Unified Subscriptions Ledger */}
        {isLoading ? (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] p-12 text-center text-slate-400">
            <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-2.5" />
            <p className="text-xs">Loading subscriptions...</p>
          </div>
        ) : displayedSubs.length === 0 ? (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] p-12 text-center space-y-3">
            <p className="text-sm text-slate-400">No active subscriptions.</p>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
            >
              + Add Subscription
            </button>
          </div>
        ) : (
          <div className="rounded-2xl bg-[#0d1017] border border-white/[0.07] divide-y divide-white/[0.06] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            {displayedSubs.map((sub) => {
              const calc = calculatedTimes[sub.id];

              return (
                <div
                  key={sub.id}
                  className="group px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Left: Monogram + Service Name + Renewal Date */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#151926] border border-white/[0.08] flex items-center justify-center text-xs font-bold uppercase text-orange-300 shrink-0">
                      {sub.name.slice(0, 2)}
                    </div>

                    <div className="min-w-0">
                      <h3 className="font-semibold text-white text-sm truncate">
                        {sub.name}
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>Renews {formatDateDisplay(sub.renewalDate)}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-500">
                          Started {formatDateDisplay(sub.purchaseDate)}
                        </span>
                      </p>
                    </div>
                  </div>

                  {/* Right: Time Left + Price + Edit/Delete */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.05]">
                    {calc ? (
                      <button
                        onClick={() => handleCalculateSingle(sub)}
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
                        onClick={() => handleCalculateSingle(sub)}
                        className="text-[11px] text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.07] border border-white/[0.07] px-2.5 py-1 rounded-lg font-medium transition cursor-pointer"
                      >
                        ⏱️ Time left
                      </button>
                    )}

                    <div className="text-right min-w-[96px]">
                      <span className="text-sm font-bold font-mono text-white tabular-nums">
                        PKR {sub.amount.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(sub)}
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
                        onClick={() => handleDelete(sub.id)}
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

      {/* Add / Edit Subscription Modal */}
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
                {editingId ? "Edit Subscription" : "Add Subscription"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Service Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Qwen Plus, ChatGPT, Netflix"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#07090e] border border-white/[0.09] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Monthly Cost (PKR)
                </label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  required
                  placeholder="1500"
                  value={formAmount}
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-[#07090e] border border-white/[0.09] rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 transition font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formPurchaseDate}
                    onChange={(e) => handlePurchaseDateChange(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-[#07090e] border border-white/[0.09] rounded-xl text-white focus:outline-none focus:border-orange-500 transition [color-scheme:dark]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Renewal Date
                  </label>
                  <input
                    type="date"
                    required
                    value={formRenewalDate}
                    onChange={(e) => setFormRenewalDate(e.target.value)}
                    className="w-full px-2.5 py-2 text-xs bg-[#07090e] border border-white/[0.09] rounded-xl text-white focus:outline-none focus:border-orange-500 transition [color-scheme:dark]"
                  />
                </div>
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
                  {editingId ? "Save" : "Add Subscription"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
