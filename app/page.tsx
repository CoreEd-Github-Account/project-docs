"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { NotificationBell } from "@/components/NotificationBell";

type AccentColor = "blue" | "indigo" | "amber" | "purple" | "emerald" | "teal";

const ACCENT_RGB: Record<AccentColor, string> = {
  blue: "59, 130, 246",
  indigo: "99, 102, 241",
  amber: "245, 158, 11",
  purple: "168, 85, 247",
  emerald: "16, 185, 129",
  teal: "20, 184, 166",
};

interface WeatherData {
  temp: number;
  condition: string;
  emoji: string;
  humidity?: number;
  windSpeed?: number;
  location?: string;
  ip?: string;
}

interface MarketQuote {
  price: number;
  changePct?: number;
  source: string;
  symbol: string;
}

interface MarketData {
  btc: MarketQuote | null;
  crudeOil: MarketQuote | null;
  usdPkr: MarketQuote | null;
  updatedAt?: string;
}

interface TechNewsItem {
  id: string;
  title: string;
  image: string;
  url: string;
  category: "Cybersecurity" | "AI Agents" | "IT & Cloud";
}

interface VulnerabilityItem {
  id: string;
  cveId: string;
  title: string;
  description: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "UNKNOWN";
  score: number | null;
  published: string;
  url: string;
}

interface AiNewsItem {
  id: string;
  title: string;
  image: string;
  url: string;
  source: string;
}

export default function HomePortal() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const [markets, setMarkets] = useState<MarketData | null>(null);
  const [marketsLoading, setMarketsLoading] = useState(true);

  const [newsItems, setNewsItems] = useState<TechNewsItem[]>([]);
  const [newsIndex, setNewsIndex] = useState(0);
  const [newsLoading, setNewsLoading] = useState(true);

  const [vulnItems, setVulnItems] = useState<VulnerabilityItem[]>([]);
  const [vulnIndex, setVulnIndex] = useState(0);
  const [vulnLoading, setVulnLoading] = useState(true);

  const [aiNewsItems, setAiNewsItems] = useState<AiNewsItem[]>([]);
  const [aiNewsIndex, setAiNewsIndex] = useState(0);
  const [aiNewsLoading, setAiNewsLoading] = useState(true);

  const portalRef = useRef<HTMLDivElement | null>(null);
  const [activeAccent, setActiveAccent] = useState<AccentColor>("blue");

  const [notchHovered, setNotchHovered] = useState(false);
  const [notchBellOpen, setNotchBellOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const isNotchExpanded = notchHovered || notchBellOpen;

  const [isWorkspaceAwake, setIsWorkspaceAwake] = useState(false);

  useEffect(() => {
    if (!isWorkspaceAwake) return;
    const sleepTimer = setTimeout(() => {
      setIsWorkspaceAwake(false);
      setActiveAccent("blue");
    }, 5 * 60 * 1000);

    return () => clearTimeout(sleepTimer);
  }, [isWorkspaceAwake]);

  useEffect(() => {
    const el = portalRef.current;
    if (!el) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let rafId: number;

    const handlePointerMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (prefersReducedMotion) {
        el.style.setProperty("--mx", `${targetX}px`);
        el.style.setProperty("--my", `${targetY}px`);
      }
    };

    const tick = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;

      const normX = (currentX / window.innerWidth - 0.5) * 2;
      const normY = (currentY / window.innerHeight - 0.5) * 2;

      el.style.setProperty("--mx", `${currentX.toFixed(1)}px`);
      el.style.setProperty("--my", `${currentY.toFixed(1)}px`);
      el.style.setProperty("--px", `${(normX * -10).toFixed(2)}px`);
      el.style.setProperty("--py", `${(normY * -10).toFixed(2)}px`);

      rafId = requestAnimationFrame(tick);
    };

    window.addEventListener("mousemove", handlePointerMove, { passive: true });
    if (!prefersReducedMotion) {
      rafId = requestAnimationFrame(tick);
    }

    return () => {
      window.removeEventListener("mousemove", handlePointerMove);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isAuthenticated]);

  const handleIconMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotY = ((x / rect.width - 0.5) * 12).toFixed(2);
    const rotX = ((0.5 - y / rect.height) * 12).toFixed(2);
    e.currentTarget.style.setProperty("--ix", `${x}px`);
    e.currentTarget.style.setProperty("--iy", `${y}px`);
    e.currentTarget.style.setProperty("--rx", `${rotX}deg`);
    e.currentTarget.style.setProperty("--ry", `${rotY}deg`);
  };

  const handleIconMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty("--rx", "0deg");
    e.currentTarget.style.setProperty("--ry", "0deg");
    setActiveAccent("blue");
  };

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

  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      let lat: number | undefined;
      let lon: number | undefined;
      let city = "";
      let ip = "";

      try {
        const ipRes = await fetch("https://ipwho.is/", { cache: "no-store" });
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData && ipData.success !== false) {
            if (typeof ipData.latitude === "number") lat = ipData.latitude;
            if (typeof ipData.longitude === "number") lon = ipData.longitude;
            if (ipData.city) {
              city = ipData.country_code
                ? `${ipData.city}, ${ipData.country_code}`
                : ipData.city;
            }
            if (ipData.ip) ip = ipData.ip;
          }
        }
      } catch {}

      if (lat === undefined || lon === undefined || !ip) {
        try {
          const freeRes = await fetch("https://freeipapi.com/api/json", {
            cache: "no-store",
          });
          if (freeRes.ok) {
            const freeData = await freeRes.json();
            if (lat === undefined && typeof freeData.latitude === "number")
              lat = freeData.latitude;
            if (lon === undefined && typeof freeData.longitude === "number")
              lon = freeData.longitude;
            if (!city && freeData.cityName) {
              city = freeData.countryCode
                ? `${freeData.cityName}, ${freeData.countryCode}`
                : freeData.cityName;
            }
            if (!ip && freeData.ipAddress) ip = freeData.ipAddress;
          }
        } catch {}
      }

      const params = new URLSearchParams();
      if (lat !== undefined && lon !== undefined) {
        params.set("lat", String(lat));
        params.set("lon", String(lon));
      }
      if (city) params.set("city", city);
      if (ip) params.set("ip", ip);

      const res = await fetch(`/api/weather?${params.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setWeather({
          temp: data.temperature,
          condition: data.condition,
          emoji: data.emoji,
          humidity: data.humidity,
          windSpeed: data.windSpeed,
          location: data.location || city || undefined,
          ip: data.ip || ip || undefined,
        });
      }
    } catch (err) {
      console.error("Weather fetch error:", err);
    } finally {
      setWeatherLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWeather();
    const timer = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchWeather]);

  const fetchMarkets = useCallback(async () => {
    setMarketsLoading(true);
    try {
      const res = await fetch("/api/markets", { cache: "no-store" });
      if (res.ok) {
        const data: MarketData = await res.json();
        setMarkets(data);
      }
    } catch (err) {
      console.error("Market fetch error:", err);
    } finally {
      setMarketsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarkets();
    const marketTimer = setInterval(fetchMarkets, 15 * 60 * 1000);
    return () => clearInterval(marketTimer);
  }, [fetchMarkets]);

  const fetchNews = useCallback(async () => {
    setNewsLoading(true);
    try {
      const res = await fetch("/api/news", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          setNewsItems(data.items);
          setNewsIndex(0);
        }
      }
    } catch (err) {
      console.error("Tech news fetch error:", err);
    } finally {
      setNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNews();
    const newsTimer = setInterval(fetchNews, 15 * 60 * 1000);
    return () => clearInterval(newsTimer);
  }, [fetchNews]);

  useEffect(() => {
    if (newsItems.length <= 1) return;
    const cycleTimer = setInterval(() => {
      setNewsIndex((prev) => (prev + 1) % newsItems.length);
    }, 12000);
    return () => clearInterval(cycleTimer);
  }, [newsItems.length]);

  const fetchVulns = useCallback(async () => {
    setVulnLoading(true);
    try {
      const res = await fetch("/api/vulnerabilities", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          setVulnItems(data.items);
          setVulnIndex(0);
        }
      }
    } catch (err) {
      console.error("Vulnerabilities fetch error:", err);
    } finally {
      setVulnLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVulns();
    const vulnTimer = setInterval(fetchVulns, 15 * 60 * 1000);
    return () => clearInterval(vulnTimer);
  }, [fetchVulns]);

  useEffect(() => {
    if (vulnItems.length <= 1) return;
    const cycleTimer = setInterval(() => {
      setVulnIndex((prev) => (prev + 1) % vulnItems.length);
    }, 14000);
    return () => clearInterval(cycleTimer);
  }, [vulnItems.length]);

  const fetchAiNews = useCallback(async () => {
    setAiNewsLoading(true);
    try {
      const res = await fetch("/api/ai-news", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.items) && data.items.length > 0) {
          setAiNewsItems(data.items);
          setAiNewsIndex(0);
        }
      }
    } catch (err) {
      console.error("AI news fetch error:", err);
    } finally {
      setAiNewsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAiNews();
    const aiTimer = setInterval(fetchAiNews, 15 * 60 * 1000);
    return () => clearInterval(aiTimer);
  }, [fetchAiNews]);

  useEffect(() => {
    if (aiNewsItems.length <= 1) return;
    const cycleTimer = setInterval(() => {
      setAiNewsIndex((prev) => (prev + 1) % aiNewsItems.length);
    }, 13000);
    return () => clearInterval(cycleTimer);
  }, [aiNewsItems.length]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setIsAuthenticated(false);
    }
  };

  const timeString = now
    ? now.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      })
    : "";

  const dateString = now
    ? now.toLocaleDateString([], {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "";

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#07090e] flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
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

  const accentRgb = ACCENT_RGB[activeAccent];

  return (
    <div
      ref={portalRef}
      style={
        {
          "--mx": "50vw",
          "--my": "50vh",
          "--px": "0px",
          "--py": "0px",
          "--accent-rgb": accentRgb,
        } as React.CSSProperties
      }
      className="relative h-screen max-h-screen bg-[#07090e] text-slate-100 font-sans flex flex-col justify-between overflow-hidden select-none"
    >
      {/* Ambient Background */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <img
          src="/images/workspace-bg.jpg"
          alt=""
          style={{
            transform: "translate3d(var(--px), var(--py), 0) scale(1.05)",
          }}
          className="w-full h-full object-cover filter blur-md opacity-30 transition-opacity duration-1000 will-change-transform"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#07090e]/85 via-[#07090e]/75 to-[#07090e]/95" />

        <div
          className="absolute inset-0 transition-colors duration-500"
          style={{
            background:
              "radial-gradient(500px circle at var(--mx) var(--my), rgba(var(--accent-rgb), 0.11), transparent 70%)",
          }}
        />
      </div>

      <style>{`
        @keyframes notch-shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          15% { transform: translateX(-2.5px) rotate(-1deg); }
          30% { transform: translateX(2.5px) rotate(1deg); }
          45% { transform: translateX(-2px) rotate(-0.5deg); }
          60%, 99% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes icon-spew {
          0% { opacity: 0; transform: translateY(-20px) scale(0.5); }
          75% { opacity: 1; transform: translateY(2px) scale(1.03); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* TOP BAR: Left News Stack | Center Dynamic Island Notch | Right Market Dock */}
      <header className="relative w-full max-w-[1700px] mx-auto px-3 sm:px-4 lg:pl-3 lg:pr-5 pt-2.5 flex items-start justify-between gap-3.5 z-30 pointer-events-none">
        {/* TOP-LEFT: News, Vulnerabilities & AI Intelligence Cards */}
        <div className="hidden lg:flex flex-col gap-2 w-[340px] xl:w-[365px] pointer-events-auto">
          {/* Card 1: Cybersecurity Events */}
          {newsLoading && newsItems.length === 0 ? (
            <div className="flex flex-col gap-1.5 px-3.5 py-2 rounded-2xl bg-[#0d1017]/90 backdrop-blur-xl border border-white/[0.07] min-h-[76px]">
              <div className="flex items-center justify-between">
                <div className="h-2 w-24 bg-white/[0.08] rounded animate-pulse" />
                <div className="h-2 w-10 bg-white/[0.06] rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/[0.06] animate-pulse shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-2.5 w-full bg-white/[0.06] rounded animate-pulse" />
                  <div className="h-2.5 w-3/4 bg-white/[0.06] rounded animate-pulse" />
                </div>
              </div>
            </div>
          ) : newsItems.length > 0 ? (
            <a
              href={newsItems[newsIndex]?.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!newsItems[newsIndex]?.url) e.preventDefault();
              }}
              className="group relative flex flex-col gap-1.5 px-3.5 py-2 rounded-2xl bg-[#0d1017]/90 backdrop-blur-xl border border-white/[0.08] hover:border-cyan-500/35 shadow-xl transition-all duration-200 min-h-[76px] cursor-pointer"
            >
              {/* Heading */}
              <div className="flex items-center justify-between text-[9.5px] font-bold tracking-wider uppercase">
                <div className="flex items-center gap-1.5 text-cyan-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span>Cybersecurity Events</span>
                </div>
                <span className="text-[8.5px] font-mono text-slate-500 font-normal">Live Feed</span>
              </div>

              {/* Content */}
              <div className="flex items-center gap-3">
                <img
                  src={newsItems[newsIndex].image}
                  alt=""
                  className="w-11 h-11 rounded-xl object-cover border border-white/[0.08] shrink-0 bg-slate-900 shadow-sm"
                />
                <p className="text-[12px] font-medium text-slate-200 group-hover:text-white leading-snug line-clamp-2 flex-1 transition-colors">
                  {newsItems[newsIndex].title}
                </p>
                {newsItems.length > 1 && (
                  <button
                    type="button"
                    aria-label="Next cybersecurity event"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setNewsIndex((prev) => (prev + 1) % newsItems.length);
                    }}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white flex items-center justify-center text-xs transition-opacity shrink-0 cursor-pointer"
                  >
                    ›
                  </button>
                )}
              </div>
            </a>
          ) : null}

          {/* Card 2: National Vulnerability Database (NVD) Latest Vulnerability */}
          {vulnLoading && vulnItems.length === 0 ? (
            <div className="flex flex-col gap-1.5 px-3.5 py-2 rounded-2xl bg-[#0d1017]/90 backdrop-blur-xl border border-white/[0.07] min-h-[76px]">
              <div className="flex items-center justify-between">
                <div className="h-2 w-20 bg-white/[0.08] rounded animate-pulse" />
                <div className="h-2 w-14 bg-white/[0.06] rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/[0.06] animate-pulse shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-2.5 w-full bg-white/[0.06] rounded animate-pulse" />
                  <div className="h-2.5 w-3/4 bg-white/[0.06] rounded animate-pulse" />
                </div>
              </div>
            </div>
          ) : vulnItems.length > 0 ? (
            <a
              href={vulnItems[vulnIndex]?.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!vulnItems[vulnIndex]?.url) e.preventDefault();
              }}
              className="group relative flex flex-col gap-1.5 px-3.5 py-2 rounded-2xl bg-[#0d1017]/90 backdrop-blur-xl border border-white/[0.08] hover:border-rose-500/35 shadow-xl transition-all duration-200 min-h-[76px] cursor-pointer"
            >
              {/* Heading */}
              <div className="flex items-center justify-between text-[9.5px] font-bold tracking-wider uppercase">
                <div className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                  <span>CVE Vulnerability</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-mono font-bold text-slate-300">
                    {vulnItems[vulnIndex].cveId}
                  </span>
                  <span
                    className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded leading-none ${
                      vulnItems[vulnIndex].severity === "CRITICAL"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                        : vulnItems[vulnIndex].severity === "HIGH"
                        ? "bg-orange-500/20 text-orange-300 border border-orange-500/30"
                        : vulnItems[vulnIndex].severity === "MEDIUM"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                    }`}
                  >
                    {vulnItems[vulnIndex].severity}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="flex items-center gap-3">
                <div
                  className={`w-11 h-11 rounded-xl border shrink-0 flex flex-col items-center justify-center transition-colors shadow-sm ${
                    vulnItems[vulnIndex].severity === "CRITICAL"
                      ? "bg-rose-500/15 border-rose-500/40 text-rose-400"
                      : vulnItems[vulnIndex].severity === "HIGH"
                      ? "bg-orange-500/15 border-orange-500/40 text-orange-400"
                      : vulnItems[vulnIndex].severity === "MEDIUM"
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-400"
                      : "bg-blue-500/15 border-blue-500/40 text-blue-400"
                  }`}
                >
                  <svg
                    className="w-4 h-4 mb-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.8}
                      d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285zM12 16.5h.008v.008H12v-.008z"
                    />
                  </svg>
                  <span className="text-[8.5px] font-mono font-black tracking-tight leading-none uppercase">
                    {vulnItems[vulnIndex].score !== null
                      ? vulnItems[vulnIndex].score
                      : "NVD"}
                  </span>
                </div>

                <p className="text-[12px] font-medium text-slate-200 group-hover:text-white leading-snug line-clamp-2 flex-1 transition-colors">
                  {vulnItems[vulnIndex].title}
                </p>

                {vulnItems.length > 1 && (
                  <button
                    type="button"
                    aria-label="Next vulnerability"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setVulnIndex((prev) => (prev + 1) % vulnItems.length);
                    }}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white flex items-center justify-center text-xs transition-opacity shrink-0 cursor-pointer"
                  >
                    ›
                  </button>
                )}
              </div>
            </a>
          ) : null}

          {/* Card 3: Global AI News (NewsAPI.ai) */}
          {aiNewsLoading && aiNewsItems.length === 0 ? (
            <div className="flex flex-col gap-1.5 px-3.5 py-2 rounded-2xl bg-[#0d1017]/90 backdrop-blur-xl border border-white/[0.07] min-h-[76px]">
              <div className="flex items-center justify-between">
                <div className="h-2 w-20 bg-white/[0.08] rounded animate-pulse" />
                <div className="h-2 w-12 bg-white/[0.06] rounded animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-white/[0.06] animate-pulse shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-2.5 w-full bg-white/[0.06] rounded animate-pulse" />
                  <div className="h-2.5 w-3/4 bg-white/[0.06] rounded animate-pulse" />
                </div>
              </div>
            </div>
          ) : aiNewsItems.length > 0 ? (
            <a
              href={aiNewsItems[aiNewsIndex]?.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!aiNewsItems[aiNewsIndex]?.url) e.preventDefault();
              }}
              className="group relative flex flex-col gap-1.5 px-3.5 py-2 rounded-2xl bg-[#0d1017]/90 backdrop-blur-xl border border-white/[0.08] hover:border-purple-500/35 shadow-xl transition-all duration-200 min-h-[76px] cursor-pointer"
            >
              {/* Heading */}
              <div className="flex items-center justify-between text-[9.5px] font-bold tracking-wider uppercase">
                <div className="flex items-center gap-1.5 text-purple-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                  <span>Global AI News</span>
                </div>
                <span className="text-[8.5px] font-mono text-purple-300/80 bg-purple-500/15 border border-purple-500/25 px-1.5 py-0.2 rounded">
                  {aiNewsItems[aiNewsIndex].source || "NewsAPI.ai"}
                </span>
              </div>

              {/* Content */}
              <div className="flex items-center gap-3">
                <img
                  src={aiNewsItems[aiNewsIndex].image}
                  alt=""
                  className="w-11 h-11 rounded-xl object-cover border border-white/[0.08] shrink-0 bg-slate-900 shadow-sm"
                />
                <p className="text-[12px] font-medium text-slate-200 group-hover:text-white leading-snug line-clamp-2 flex-1 transition-colors">
                  {aiNewsItems[aiNewsIndex].title}
                </p>
                {aiNewsItems.length > 1 && (
                  <button
                    type="button"
                    aria-label="Next AI news story"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setAiNewsIndex((prev) => (prev + 1) % aiNewsItems.length);
                    }}
                    className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-md bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white flex items-center justify-center text-xs transition-opacity shrink-0 cursor-pointer"
                  >
                    ›
                  </button>
                )}
              </div>
            </a>
          ) : null}
        </div>

        {/* TOP-CENTER: Dynamic Island Notch */}
        <div className="flex justify-center flex-1 lg:flex-none pointer-events-auto">
          <div
            onMouseEnter={() => setNotchHovered(true)}
            onMouseLeave={() => setNotchHovered(false)}
            style={{
              animation:
                !isNotchExpanded && unreadNotifications > 0
                  ? "notch-shake 2.2s cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite"
                  : "none",
            }}
            className={`relative flex items-center justify-center bg-black/95 backdrop-blur-2xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isNotchExpanded
                ? "w-44 h-13 px-3 rounded-3xl border border-white/[0.14] shadow-2xl"
                : unreadNotifications > 0
                  ? "w-34 h-9 px-3.5 rounded-full border border-rose-500/45 shadow-[0_8px_25px_rgba(244,63,94,0.22)] cursor-pointer"
                  : "w-30 h-9 px-3.5 rounded-full border border-white/[0.1] shadow-xl cursor-pointer"
            }`}
          >
            {/* Collapsed State */}
            <div
              className={`absolute inset-0 px-3.5 flex items-center justify-between transition-all duration-200 ${
                isNotchExpanded
                  ? "opacity-0 scale-75 pointer-events-none"
                  : "opacity-100 scale-100"
              }`}
            >
              {unreadNotifications > 0 ? (
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
              ) : (
                <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center">
                  <div className="w-1 h-1 rounded-full bg-blue-500/50" />
                </div>
              )}

              <div className="w-7 h-1 rounded-full bg-white/[0.1]" />

              {unreadNotifications > 0 ? (
                <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 text-[10px] font-bold font-mono text-rose-300 leading-none">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
              )}
            </div>

            {/* Expanded State */}
            <div
              className={`flex items-center gap-2 transition-all duration-300 ${
                isNotchExpanded
                  ? "opacity-100 scale-100 pointer-events-auto"
                  : "opacity-0 scale-50 pointer-events-none"
              }`}
            >
              <NotificationBell
                align="center"
                onUnreadCountChange={setUnreadNotifications}
                onDropdownOpenChange={setNotchBellOpen}
              />

              <Link
                href="/settings"
                aria-label="Settings"
                className="w-9 h-9 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white border border-white/[0.08] transition flex items-center justify-center cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
              </Link>

              <button
                type="button"
                onClick={handleLogout}
                aria-label="Log out"
                className="w-9 h-9 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/25 transition flex items-center justify-center cursor-pointer"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.8}
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* TOP-RIGHT: Market Dock (Large Icons + Price, Hover Tooltip) */}
        <div className="hidden sm:flex items-center gap-2 pointer-events-auto">
          {/* BTC */}
          <div
            onClick={fetchMarkets}
            className="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-[#0d1017]/85 backdrop-blur-xl border border-white/[0.08] hover:border-amber-500/40 shadow-xl transition cursor-pointer"
          >
            <span className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 font-mono font-bold text-sm">
              ₿
            </span>
            <span className="text-xs font-bold font-mono tabular-nums text-white">
              {markets?.btc ? `$${markets.btc.price.toLocaleString()}` : "--"}
            </span>
            <div className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-xl bg-[#10131c] border border-white/[0.1] shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-30 whitespace-nowrap text-center">
              <p className="text-[11px] font-semibold text-white">Bitcoin</p>
            </div>
          </div>

          {/* CRUDE OIL */}
          <div
            onClick={fetchMarkets}
            className="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-[#0d1017]/85 backdrop-blur-xl border border-white/[0.08] hover:border-sky-500/40 shadow-xl transition cursor-pointer"
          >
            <span className="w-7 h-7 rounded-lg bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.2}
                  d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z"
                />
              </svg>
            </span>
            <span className="text-xs font-bold font-mono tabular-nums text-white">
              {markets?.crudeOil
                ? `$${markets.crudeOil.price.toFixed(2)}`
                : "--"}
            </span>
            <div className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-xl bg-[#10131c] border border-white/[0.1] shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-30 whitespace-nowrap text-center">
              <p className="text-[11px] font-semibold text-white">Crude Oil</p>
            </div>
          </div>

          {/* USD TO PKR */}
          <div
            onClick={fetchMarkets}
            className="group relative flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-[#0d1017]/85 backdrop-blur-xl border border-white/[0.08] hover:border-emerald-500/40 shadow-xl transition cursor-pointer"
          >
            <span className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-mono font-bold text-xs">
              ₨
            </span>
            <span className="text-xs font-bold font-mono tabular-nums text-white">
              {markets?.usdPkr ? `Rs ${markets.usdPkr.price.toFixed(2)}` : "--"}
            </span>
            <div className="pointer-events-none absolute top-full mt-2 right-0 px-2.5 py-1 rounded-xl bg-[#10131c] border border-white/[0.1] shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity z-30 whitespace-nowrap text-center">
              <p className="text-[11px] font-semibold text-white">USD to PKR</p>
            </div>
          </div>
        </div>
      </header>

      {/* CENTER HUB: Minimal Clock + Weather & Playful Emoji Launcher */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 flex flex-col items-center justify-start pt-1 sm:pt-2 lg:pt-2 -mt-4 sm:-mt-6 lg:-mt-8 gap-3 sm:gap-4 z-10">
        {/* Clean Centered Time & Compact Weather Pill */}
        <div className="flex flex-col items-center text-center gap-1.5 sm:gap-2">
          <div className="text-4xl sm:text-6xl md:text-[5rem] lg:text-[5rem] font-black text-white tracking-tight font-mono tabular-nums drop-shadow-2xl leading-none">
            {timeString || "00:00:00 AM"}
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-center">
            <span className="px-2.5 py-0.5 rounded-full bg-[#0d1017]/80 border border-white/[0.08] text-[11px] font-medium text-slate-300">
              {dateString || "..."}
            </span>

            {weather && !weatherLoading && (
              <button
                type="button"
                onClick={fetchWeather}
                title="Click to refresh weather"
                className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#0d1017]/80 hover:bg-white/[0.06] border border-white/[0.08] text-[11px] text-slate-200 transition cursor-pointer"
              >
                <span>{weather.emoji}</span>
                <span className="font-mono font-bold">{weather.temp}°C</span>
                {weather.location && (
                  <span className="text-slate-400">• {weather.location}</span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* PLAYFUL SLEEPING / AWAKE EMOJI LAUNCHER */}
        <div className="flex flex-col items-center justify-center">
          {!isWorkspaceAwake ? (
            <button
              type="button"
              onClick={() => setIsWorkspaceAwake(true)}
              aria-label="Wake workspace"
              className="group relative flex items-center justify-center w-20 h-20 sm:w-22 sm:h-22 rounded-full cursor-pointer focus:outline-none"
            >
              <span className="pointer-events-none absolute inset-0 rounded-full bg-blue-500/15 blur-2xl group-hover:bg-orange-500/20 transition-all duration-300" />
              <span className="text-5xl sm:text-6xl filter drop-shadow-[0_14px_28px_rgba(0,0,0,0.85)] group-hover:hidden transition-transform duration-200">
                😴
              </span>
              <span className="hidden group-hover:inline-block text-5xl sm:text-6xl filter drop-shadow-[0_14px_28px_rgba(0,0,0,0.85)] transition-transform duration-200">
                🙄
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIsWorkspaceAwake(false);
                setActiveAccent("blue");
              }}
              title="Click to sleep"
              className="group relative flex items-center justify-center w-20 h-20 sm:w-22 sm:h-22 rounded-full cursor-pointer focus:outline-none"
            >
              <span className="pointer-events-none absolute inset-0 rounded-full bg-emerald-500/20 blur-2xl" />
              <span className="text-5xl sm:text-6xl filter drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] transition-transform duration-200">
                🤮
              </span>
            </button>
          )}
        </div>

        {/* Sleek Glass Workspace Dock (6 Icons + Short Titles Only) */}
        {isWorkspaceAwake && (
          <div className="px-5 py-3 rounded-2xl bg-[#0d1017]/85 backdrop-blur-2xl border border-white/[0.08] shadow-[0_18px_45px_rgba(0,0,0,0.7)] flex flex-wrap items-center justify-center gap-3.5 sm:gap-5 [perspective:900px]">
              {[
                {
                  href: "/projects",
                  label: "Projects",
                  icon: "📁",
                  accent: "blue" as AccentColor,
                  delay: "0.03s",
                },
                {
                  href: "/subscriptions",
                  label: "Subscriptions",
                  icon: "⏱️",
                  accent: "indigo" as AccentColor,
                  delay: "0.08s",
                },
                {
                  href: "/expenses",
                  label: "Expenses",
                  icon: "🧾",
                  accent: "teal" as AccentColor,
                  delay: "0.13s",
                },
                {
                  href: "/passwords",
                  label: "Passwords",
                  icon: "🔑",
                  accent: "amber" as AccentColor,
                  delay: "0.18s",
                },
                {
                  href: "/prompts",
                  label: "Prompts",
                  icon: "💡",
                  accent: "purple" as AccentColor,
                  delay: "0.23s",
                },
                {
                  href: "/commands",
                  label: "Commands",
                  icon: ">_",
                  accent: "emerald" as AccentColor,
                  delay: "0.28s",
                  isMono: true,
                },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  onMouseEnter={() => setActiveAccent(item.accent)}
                  onMouseMove={handleIconMouseMove}
                  onMouseLeave={handleIconMouseLeave}
                  style={
                    {
                      "--rx": "0deg",
                      "--ry": "0deg",
                      animation: `icon-spew 0.4s cubic-bezier(0.22, 1, 0.36, 1) ${item.delay} both`,
                    } as React.CSSProperties
                  }
                  className="group flex flex-col items-center gap-1.5 cursor-pointer focus:outline-none"
                >
                  <div
                    style={{
                      transform: "rotateX(var(--rx)) rotateY(var(--ry))",
                    }}
                    className={`relative overflow-hidden w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[#141824] border border-white/[0.09] group-hover:border-orange-500/60 group-hover:bg-[#1a2030] flex items-center justify-center shadow-xl group-hover:-translate-y-1 group-hover:scale-105 active:scale-95 transition-all duration-200 ${
                      item.isMono
                        ? "text-lg sm:text-xl font-mono font-black text-emerald-400"
                        : "text-xl sm:text-2xl"
                    }`}
                  >
                    <span
                      className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{
                        background:
                          "radial-gradient(48px circle at var(--ix, 50%) var(--iy, 50%), rgba(255,255,255,0.18), transparent 70%)",
                      }}
                    />
                    <span className="relative z-10">{item.icon}</span>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400 group-hover:text-white transition-colors">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
        )}
      </main>

      <div className="h-2" />
    </div>
  );
}
