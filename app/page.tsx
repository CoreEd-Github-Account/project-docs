"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";
import { NotificationBell } from "@/components/NotificationBell";

type AccentColor = "blue" | "indigo" | "amber" | "purple" | "emerald";

const ACCENT_RGB: Record<AccentColor, string> = {
  blue: "59, 130, 246",
  indigo: "99, 102, 241",
  amber: "245, 158, 11",
  purple: "168, 85, 247",
  emerald: "16, 185, 129",
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

export default function HomePortal() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Live Date & Time State
  const [now, setNow] = useState<Date | null>(null);

  // Auto IP & Location-based Weather State
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // Live Market Telemetry State (BTC, Crude Oil, USD to PKR - 15 min cycle)
  const [markets, setMarkets] = useState<MarketData | null>(null);
  const [marketsLoading, setMarketsLoading] = useState(true);

  // Live IT / AI Agents / Cybersecurity News State (15 min cycle)
  const [newsItems, setNewsItems] = useState<TechNewsItem[]>([]);
  const [newsIndex, setNewsIndex] = useState(0);
  const [newsLoading, setNewsLoading] = useState(true);

  // Subtle Live Mouse Interaction State & Refs
  const portalRef = useRef<HTMLDivElement | null>(null);
  const [activeAccent, setActiveAccent] = useState<AccentColor>("blue");

  // iPhone Notch / Dynamic Island Header State
  const [notchHovered, setNotchHovered] = useState(false);
  const [notchBellOpen, setNotchBellOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const isNotchExpanded = notchHovered || notchBellOpen;

  // Playful Sleeping -> Vomiting Emoji Workspace Reveal State (auto-sleeps after 5 mins)
  const [isWorkspaceAwake, setIsWorkspaceAwake] = useState(false);

  useEffect(() => {
    if (!isWorkspaceAwake) return;
    const sleepTimer = setTimeout(() => {
      setIsWorkspaceAwake(false);
      setActiveAccent("blue");
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearTimeout(sleepTimer);
  }, [isWorkspaceAwake]);

  // Smoothly interpolate mouse position via requestAnimationFrame (zero React re-renders per frame)
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

  // Helper for magnetic icon tilt & local cursor glint on the 5 launcher buttons
  const handleIconMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const rotY = ((x / rect.width - 0.5) * 14).toFixed(2);
    const rotX = ((0.5 - y / rect.height) * 14).toFixed(2);
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

  // Check Authentication Status on mount
  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth");
      const data = await res.json();
      setIsAuthenticated(Boolean(data.authenticated));
    } catch (err) {
      console.error("Auth check error:", err);
      setIsAuthenticated(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Live Clock (1 second interval)
  useEffect(() => {
    setNow(new Date());
    const interval = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch live weather using user's IP + Location (and GPS coordinates if granted)
  const fetchWeather = useCallback(async () => {
    setWeatherLoading(true);
    try {
      let lat: number | undefined;
      let lon: number | undefined;
      let city = "";
      let ip = "";

      // 1. Detect client's public IP and location directly from the browser
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

      // Fallback browser IP lookup if ipwho.is was blocked
      if (lat === undefined || lon === undefined || !ip) {
        try {
          const freeRes = await fetch("https://freeipapi.com/api/json", { cache: "no-store" });
          if (freeRes.ok) {
            const freeData = await freeRes.json();
            if (lat === undefined && typeof freeData.latitude === "number") lat = freeData.latitude;
            if (lon === undefined && typeof freeData.longitude === "number") lon = freeData.longitude;
            if (!city && freeData.cityName) {
              city = freeData.countryCode
                ? `${freeData.cityName}, ${freeData.countryCode}`
                : freeData.cityName;
            }
            if (!ip && freeData.ipAddress) ip = freeData.ipAddress;
          }
        } catch {}
      }

      // 2. Call our backend /api/weather with the detected IP & coordinates (uses nearest airport METAR station + Open-Meteo)
      const params = new URLSearchParams();
      if (lat !== undefined && lon !== undefined) {
        params.set("lat", String(lat));
        params.set("lon", String(lon));
      }
      if (city) params.set("city", city);
      if (ip) params.set("ip", ip);

      const res = await fetch(`/api/weather?${params.toString()}`, { cache: "no-store" });
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
    // Refresh live weather every 5 minutes
    const timer = setInterval(fetchWeather, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchWeather]);

  // Fetch live market rates (BTC, Crude Oil, USD to PKR) every 15 minutes
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
    // Refresh every 15 minutes as requested
    const marketTimer = setInterval(fetchMarkets, 15 * 60 * 1000);
    return () => clearInterval(marketTimer);
  }, [fetchMarkets]);

  // Fetch latest IT, AI Agents, Cybersecurity & Hacker Attack news every 15 minutes
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
    // Refresh latest IT & Cybersecurity news every 15 minutes
    const newsTimer = setInterval(fetchNews, 15 * 60 * 1000);
    return () => clearInterval(newsTimer);
  }, [fetchNews]);

  // Gently cycle through the fetched news headlines every 12 seconds
  useEffect(() => {
    if (newsItems.length <= 1) return;
    const cycleTimer = setInterval(() => {
      setNewsIndex((prev) => (prev + 1) % newsItems.length);
    }, 12000);
    return () => clearInterval(cycleTimer);
  }, [newsItems.length]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setIsAuthenticated(false);
    }
  };

  // Formatted Time & Date strings
  const timeString = now
    ? now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })
    : "";

  const dateString = now
    ? now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";

  // 1. Loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-9 h-9 border-3 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p className="text-sm font-medium">Verifying access...</p>
      </div>
    );
  }

  // 2. Unauthenticated -> Show Login Form
  if (!isAuthenticated) {
    return (
      <LoginForm
        onLoginSuccess={() => {
          setIsAuthenticated(true);
        }}
      />
    );
  }

  // 3. Authenticated -> Show Workspace Portal with Live Corner Clock, Weather & Blurry Background
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
      className="relative min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col overflow-x-hidden"
    >
      {/* Visual Appealing Blurry Background Image, Live Cursor Spotlight & Illuminated Architectural Dot Matrix */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <img
          src="/images/workspace-bg.jpg"
          alt=""
          style={{
            transform: "translate3d(var(--px), var(--py), 0) scale(1.06)",
          }}
          className="w-full h-full object-cover filter blur-md opacity-40 select-none transition-opacity duration-1000 will-change-transform"
        />
        {/* Soft Dark Vignette Overlays for Maximum Contrast & Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/70 to-slate-950/95" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[450px] bg-blue-600/15 blur-[160px] rounded-full pointer-events-none" />

        {/* Subtle Live Cursor Ambient Spotlight (shifts tint on icon hover) */}
        <div
          className="absolute inset-0 transition-colors duration-500"
          style={{
            background:
              "radial-gradient(520px circle at var(--mx) var(--my), rgba(var(--accent-rgb), 0.13), rgba(var(--accent-rgb), 0.03) 45%, transparent 75%)",
          }}
        />

        {/* Cursor-Revealed Architectural Dot Matrix Grid */}
        <div
          className="absolute inset-0 opacity-75"
          style={{
            backgroundImage:
              "radial-gradient(rgba(var(--accent-rgb), 0.55) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            WebkitMaskImage:
              "radial-gradient(280px circle at var(--mx) var(--my), #000 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
            maskImage:
              "radial-gradient(280px circle at var(--mx) var(--my), #000 0%, rgba(0,0,0,0.4) 50%, transparent 100%)",
          }}
        />
      </div>

      {/* Keyframes for iPhone Notch Notification Shake & Playful Emoji Reveal */}
      <style>{`
        @keyframes notch-shake {
          0%, 100% { transform: translateX(0) rotate(0deg); }
          10% { transform: translateX(-3px) rotate(-1.2deg); }
          20% { transform: translateX(3px) rotate(1.2deg); }
          30% { transform: translateX(-3px) rotate(-1deg); }
          40% { transform: translateX(2.5px) rotate(1deg); }
          50% { transform: translateX(-1.5px) rotate(-0.5deg); }
          60%, 99% { transform: translateX(0) rotate(0deg); }
        }
        @keyframes sleep-breathe {
          0%, 100% { transform: scale(1) translateY(0px) rotate(-2deg); }
          50% { transform: scale(1.08) translateY(-6px) rotate(2deg); }
        }
        @keyframes zzz-float {
          0% { opacity: 0; transform: translate(0, 6px) scale(0.7); }
          40% { opacity: 0.9; }
          100% { opacity: 0; transform: translate(18px, -26px) scale(1.2); }
        }
        @keyframes vomit-shake {
          0% { transform: scale(0.8) rotate(0deg); }
          15% { transform: scale(1.25) rotate(-10deg) translateY(-6px); }
          30% { transform: scale(1.2) rotate(10deg) translateY(4px); }
          45% { transform: scale(1.15) rotate(-6deg); }
          60% { transform: scale(1.1) rotate(6deg); }
          100% { transform: scale(1) rotate(0deg); }
        }
        @keyframes icon-spew {
          0% { opacity: 0; transform: translateY(-28px) scale(0.35); }
          70% { opacity: 1; transform: translateY(4px) scale(1.06); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* Top Header: Centered iPhone Dynamic Island / Notch */}
      <header className="bg-transparent sticky top-0 z-30 pt-3 flex justify-center pointer-events-none">
        <div
          onMouseEnter={() => setNotchHovered(true)}
          onMouseLeave={() => setNotchHovered(false)}
          style={{
            animation:
              !isNotchExpanded && unreadNotifications > 0
                ? "notch-shake 2.2s cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite"
                : "none",
          }}
          className={`pointer-events-auto relative flex items-center justify-center bg-black/95 backdrop-blur-2xl transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            isNotchExpanded
              ? "w-44 h-14 px-3 rounded-3xl border border-slate-700/85 shadow-[0_18px_45px_rgba(0,0,0,0.9),0_0_25px_rgba(59,130,246,0.12)]"
              : unreadNotifications > 0
                ? "w-36 h-9 px-3.5 rounded-full border border-rose-500/45 shadow-[0_10px_30px_rgba(0,0,0,0.9),0_0_20px_rgba(244,63,94,0.28)] cursor-pointer"
                : "w-32 h-9 px-3.5 rounded-full border border-slate-800/90 shadow-[0_10px_28px_rgba(0,0,0,0.9)] cursor-pointer"
          }`}
        >
          {/* COLLAPSED NOTCH VIEW (iPhone Dynamic Island resting state) */}
          <div
            className={`absolute inset-0 px-3.5 flex items-center justify-between transition-all duration-200 ${
              isNotchExpanded
                ? "opacity-0 scale-75 pointer-events-none"
                : "opacity-100 scale-100"
            }`}
          >
            {/* Camera Lens / Notification Alert Left Side */}
            {unreadNotifications > 0 ? (
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                </span>
                <svg
                  className="w-3.5 h-3.5 text-rose-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>
              </div>
            ) : (
              /* Authentic Recessed Camera Lens */
              <div className="w-3 h-3 rounded-full bg-slate-900 border border-slate-800/90 flex items-center justify-center shadow-inner">
                <div className="w-1 h-1 rounded-full bg-blue-500/40" />
              </div>
            )}

            {/* Center Speaker Grill Subtle Line */}
            <div className="w-7 h-1 rounded-full bg-slate-800/80" />

            {/* Right Status Indicator / Unread Count Pill */}
            {unreadNotifications > 0 ? (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/40 text-[10px] font-bold font-mono text-rose-300 leading-none">
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            ) : (
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
            )}
          </div>

          {/* EXPANDED NOTCH VIEW (Pops out all 3 options on hover) */}
          <div
            className={`flex items-center gap-2 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              isNotchExpanded
                ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
                : "opacity-0 scale-50 -translate-y-1 pointer-events-none"
            }`}
          >
            {/* Option 1: Notifications */}
            <NotificationBell
              align="center"
              onUnreadCountChange={setUnreadNotifications}
              onDropdownOpenChange={setNotchBellOpen}
            />

            {/* Option 2: Settings Icon Button */}
            <Link
              href="/settings"
              aria-label="Settings"
              className="group relative w-10 h-10 rounded-xl bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-blue-400 border border-slate-800 hover:border-blue-500/40 transition-all duration-200 flex items-center justify-center cursor-pointer shadow-md hover:-translate-y-0.5 hover:scale-105 active:scale-95"
            >
              <svg
                className="w-[18px] h-[18px] transition-transform duration-300 group-hover:rotate-45"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.8}
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <div className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-slate-900/95 border border-slate-700/80 text-[11px] font-medium text-slate-200 whitespace-nowrap opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 shadow-xl z-30">
                Settings
              </div>
            </Link>

            {/* Option 3: Log Out Icon Button */}
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Log out"
              className="group relative w-10 h-10 rounded-xl bg-rose-950/35 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 border border-rose-500/30 hover:border-rose-500/50 transition-all duration-200 flex items-center justify-center cursor-pointer shadow-md hover:-translate-y-0.5 hover:scale-105 active:scale-95"
            >
              <svg
                className="w-[18px] h-[18px] transition-transform duration-200 group-hover:translate-x-0.5"
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
              <div className="pointer-events-none absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg bg-slate-900/95 border border-rose-500/40 text-[11px] font-medium text-rose-200 whitespace-nowrap opacity-0 -translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 shadow-xl z-30">
                Log out
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center">
        {/* TOP CORNER SECTION: BIG FONT DATE & TIME + AUTO IP WEATHER */}
        <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-6 mb-10 pb-6 border-b border-slate-800/80">
          {/* Big Font Live Clock & Date in the Corner */}
          <div className="space-y-1.5 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start">
              <span className="text-4xl sm:text-6xl font-black text-white tracking-tight font-mono drop-shadow-xl">
                {timeString || "00:00:00 AM"}
              </span>
            </div>
            <p className="text-sm sm:text-base font-medium text-slate-300 tracking-wide flex items-center justify-center md:justify-start gap-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{dateString || "Loading today's date..."}</span>
            </p>
          </div>

          {/* Current Live Weather Widget (Auto-detected via user IP & Location) */}
          <div
            onClick={fetchWeather}
            title={
              weather?.ip
                ? `Location: ${weather.location || "Detected"} | IP: ${weather.ip} (Click to refresh)`
                : "Click to refresh live weather"
            }
            className="flex items-center gap-4 px-5 py-3 rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 shadow-2xl hover:border-slate-700 transition cursor-pointer"
          >
            {weatherLoading ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-1 px-3">
                <span className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                <span>Fetching weather...</span>
              </div>
            ) : weather ? (
              <>
                <span className="text-4xl filter drop-shadow select-none">
                  {weather.emoji}
                </span>
                <div className="text-left space-y-0.5">
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white font-mono">
                      {weather.temp}°C
                    </span>
                    <span className="text-xs font-semibold text-slate-200">
                      {weather.condition}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                    {weather.location && (
                      <>
                        <span className="text-blue-400 font-medium">📍 {weather.location}</span>
                        <span>•</span>
                      </>
                    )}
                    {weather.humidity !== undefined && (
                      <span>💧 {weather.humidity}%</span>
                    )}
                    {weather.windSpeed !== undefined && (
                      <>
                        <span>•</span>
                        <span>💨 {weather.windSpeed} km/h</span>
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="text-2xl">🌙</span>
                <span>Weather data ready</span>
              </div>
            )}
          </div>
        </div>

        {/* TOP-LEFT IT / AI AGENTS / CYBERSECURITY NEWS BENEATH HEADER (Image + Heading Only) */}
        <aside className="fixed left-5 top-16 z-20 hidden sm:flex items-center select-none">
          {newsLoading && newsItems.length === 0 ? (
            <div className="flex items-center gap-3 px-3 py-2 rounded-2xl bg-slate-950/80 backdrop-blur-2xl border border-slate-800/85 shadow-[0_12px_30px_rgba(0,0,0,0.75)] w-72 sm:w-80">
              <div className="w-11 h-11 rounded-xl bg-slate-800 animate-pulse shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-full bg-slate-800 rounded animate-pulse" />
                <div className="h-3 w-2/3 bg-slate-800 rounded animate-pulse" />
              </div>
            </div>
          ) : newsItems.length > 0 ? (
            <a
              href={newsItems[newsIndex]?.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                // Middle/left click opens article; right side next-button cycles stories
                if (!newsItems[newsIndex]?.url) e.preventDefault();
              }}
              className="group relative flex items-center gap-3 px-3 py-2 rounded-2xl bg-slate-950/80 backdrop-blur-2xl border border-slate-800/85 hover:border-blue-500/45 shadow-[0_12px_30px_rgba(0,0,0,0.75)] hover:-translate-y-0.5 transition-all duration-200 w-72 sm:w-84 cursor-pointer"
            >
              {/* Article Thumbnail Image */}
              <img
                src={newsItems[newsIndex].image}
                alt=""
                className="w-11 h-11 rounded-xl object-cover border border-slate-800 shrink-0 bg-slate-900 group-hover:scale-105 transition-transform duration-200"
              />

              {/* Heading Only */}
              <p className="text-xs font-semibold text-slate-100 group-hover:text-blue-300 leading-snug line-clamp-2 flex-1 transition-colors">
                {newsItems[newsIndex].title}
              </p>

              {/* Subtle Next Headline Button on Hover */}
              {newsItems.length > 1 && (
                <button
                  type="button"
                  aria-label="Next news story"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setNewsIndex((prev) => (prev + 1) % newsItems.length);
                  }}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white flex items-center justify-center text-xs transition-opacity shrink-0 cursor-pointer"
                >
                  ›
                </button>
              )}
            </a>
          ) : null}
        </aside>

        {/* TOP-RIGHT MARKET DOCK BENEATH HEADER (Large Icons + Price, Hover Tooltip for Name) */}
        <aside className="fixed right-5 top-16 z-20 hidden sm:flex items-center gap-3 select-none">
          {/* 1. BITCOIN */}
          <div
            onClick={fetchMarkets}
            className="group relative flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-950/80 backdrop-blur-2xl border border-amber-500/30 hover:border-amber-400/70 shadow-[0_12px_30px_rgba(0,0,0,0.75)] hover:-translate-y-0.5 hover:scale-105 transition-all duration-200 cursor-pointer"
          >
            <span className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 font-mono font-black text-xl shadow-inner">
              ₿
            </span>
            <div className="text-left">
              {marketsLoading && !markets?.btc ? (
                <div className="h-4 w-14 bg-slate-800 rounded animate-pulse" />
              ) : markets?.btc ? (
                <span className="text-sm font-black font-mono tabular-nums text-white tracking-tight">
                  ${markets.btc.price.toLocaleString()}
                </span>
              ) : (
                <span className="text-xs text-slate-500 font-mono">--</span>
              )}
            </div>

            {/* Hover Tooltip */}
            <div className="pointer-events-none absolute top-full mt-2.5 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-amber-500/40 shadow-2xl opacity-0 -translate-y-1 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 transition-all duration-150 z-30 whitespace-nowrap text-center">
              <p className="text-xs font-bold text-white">Bitcoin (BTC / USD)</p>
              {markets?.btc?.changePct !== undefined && (
                <p
                  className={`text-[10px] font-mono font-semibold mt-0.5 ${
                    markets.btc.changePct >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {markets.btc.changePct >= 0 ? "+" : ""}
                  {markets.btc.changePct.toFixed(2)}% today
                </p>
              )}
            </div>
          </div>

          {/* 2. CRUDE OIL */}
          <div
            onClick={fetchMarkets}
            className="group relative flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-950/80 backdrop-blur-2xl border border-sky-500/30 hover:border-sky-400/70 shadow-[0_12px_30px_rgba(0,0,0,0.75)] hover:-translate-y-0.5 hover:scale-105 transition-all duration-200 cursor-pointer"
          >
            <span className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/35 flex items-center justify-center text-sky-400 shadow-inner">
              <svg
                className="w-5 h-5"
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
            <div className="text-left">
              {marketsLoading && !markets?.crudeOil ? (
                <div className="h-4 w-14 bg-slate-800 rounded animate-pulse" />
              ) : markets?.crudeOil ? (
                <span className="text-sm font-black font-mono tabular-nums text-white tracking-tight">
                  ${markets.crudeOil.price.toFixed(2)}
                </span>
              ) : (
                <span className="text-xs text-slate-500 font-mono">--</span>
              )}
            </div>

            {/* Hover Tooltip */}
            <div className="pointer-events-none absolute top-full mt-2.5 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-sky-500/40 shadow-2xl opacity-0 -translate-y-1 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 transition-all duration-150 z-30 whitespace-nowrap text-center">
              <p className="text-xs font-bold text-white">Crude Oil (WTI / Barrel)</p>
              {markets?.crudeOil?.changePct !== undefined && (
                <p
                  className={`text-[10px] font-mono font-semibold mt-0.5 ${
                    markets.crudeOil.changePct >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {markets.crudeOil.changePct >= 0 ? "+" : ""}
                  {markets.crudeOil.changePct.toFixed(2)}% today
                </p>
              )}
            </div>
          </div>

          {/* 3. USD TO PKR */}
          <div
            onClick={fetchMarkets}
            className="group relative flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-slate-950/80 backdrop-blur-2xl border border-emerald-500/30 hover:border-emerald-400/70 shadow-[0_12px_30px_rgba(0,0,0,0.75)] hover:-translate-y-0.5 hover:scale-105 transition-all duration-200 cursor-pointer"
          >
            <span className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/35 flex items-center justify-center text-emerald-400 font-mono font-black text-base shadow-inner">
              ₨
            </span>
            <div className="text-left">
              {marketsLoading && !markets?.usdPkr ? (
                <div className="h-4 w-14 bg-slate-800 rounded animate-pulse" />
              ) : markets?.usdPkr ? (
                <span className="text-sm font-black font-mono tabular-nums text-white tracking-tight">
                  Rs {markets.usdPkr.price.toFixed(2)}
                </span>
              ) : (
                <span className="text-xs text-slate-500 font-mono">--</span>
              )}
            </div>

            {/* Hover Tooltip */}
            <div className="pointer-events-none absolute top-full mt-2.5 right-0 px-3 py-1.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl opacity-0 -translate-y-1 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 transition-all duration-150 z-30 whitespace-nowrap text-center">
              <p className="text-xs font-bold text-white">USD to PKR Exchange Rate</p>
              {markets?.usdPkr?.changePct !== undefined && (
                <p
                  className={`text-[10px] font-mono font-semibold mt-0.5 ${
                    markets.usdPkr.changePct >= 0
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }`}
                >
                  {markets.usdPkr.changePct >= 0 ? "+" : ""}
                  {markets.usdPkr.changePct.toFixed(2)}% today
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* PLAYFUL SLEEPING -> VOMITING EMOJI LAUNCHER & 5 WORKSPACE ICONS */}
        {!isWorkspaceAwake ? (
          /* SLEEPING STATE: Large Sleeping Emoji Only (Click to wake/spew icons) */
          <div className="flex flex-col items-center justify-center py-8 select-none">
            <button
              type="button"
              onClick={() => setIsWorkspaceAwake(true)}
              aria-label="Wake workspace"
              className="group relative flex items-center justify-center w-28 h-28 sm:w-36 sm:h-36 rounded-full cursor-pointer focus:outline-none"
            >
              {/* Soft Ambient Sleep Halo */}
              <span className="pointer-events-none absolute inset-0 rounded-full bg-blue-500/15 blur-2xl group-hover:bg-blue-400/25 transition-all duration-300" />

              {/* Floating Zzz Bubbles (fade out when hovered & woken up to 🙄) */}
              <span
                style={{ animation: "zzz-float 2.6s ease-in-out infinite" }}
                className="pointer-events-none absolute -top-2 right-2 text-sm font-mono font-bold text-blue-300/80 group-hover:hidden"
              >
                z
              </span>
              <span
                style={{
                  animation: "zzz-float 2.6s ease-in-out 0.85s infinite",
                }}
                className="pointer-events-none absolute -top-6 -right-1 text-base font-mono font-bold text-indigo-300/80 group-hover:hidden"
              >
                Z
              </span>
              <span
                style={{
                  animation: "zzz-float 2.6s ease-in-out 1.7s infinite",
                }}
                className="pointer-events-none absolute -top-10 -right-4 text-lg font-mono font-extrabold text-purple-300/85 group-hover:hidden"
              >
                Z
              </span>

              {/* Large Sleeping Emoji (😴 by default, 🙄 on mouse hover) */}
              <span
                style={{ animation: "sleep-breathe 3.2s ease-in-out infinite" }}
                className="text-7xl sm:text-8xl filter drop-shadow-[0_18px_35px_rgba(0,0,0,0.85)] group-hover:hidden transition-transform duration-200"
              >
                😴
              </span>
              <span className="hidden group-hover:inline-block text-7xl sm:text-8xl filter drop-shadow-[0_18px_35px_rgba(0,0,0,0.85)] scale-110 active:scale-95 transition-transform duration-200">
                🙄
              </span>
            </button>
          </div>
        ) : (
          /* AWAKE STATE: Converts to Vomiting Emoji + Displays All 5 Workspace Icons (Auto-sleeps after 5 mins) */
          <div className="flex flex-col items-center justify-center w-full">
            {/* Vomiting Emoji (Click to manually put back to sleep, or auto-sleeps in 5 minutes) */}
            <button
              type="button"
              onClick={() => {
                setIsWorkspaceAwake(false);
                setActiveAccent("blue");
              }}
              title="Auto-hides in 5 minutes (Click to sleep now)"
              aria-label="Vomiting emoji workspace active"
              style={{
                animation:
                  "vomit-shake 0.75s cubic-bezier(0.36, 0.07, 0.19, 0.97) both",
              }}
              className="group relative mb-5 flex items-center justify-center cursor-pointer select-none focus:outline-none"
            >
              <span className="pointer-events-none absolute inset-0 rounded-full bg-emerald-500/20 blur-2xl" />
              <span className="text-6xl sm:text-7xl filter drop-shadow-[0_14px_28px_rgba(0,0,0,0.85)] group-hover:scale-110 active:scale-95 transition-transform duration-200">
                🤮
              </span>
            </button>

            {/* 5 Large Pop-On-Hover Workspace Icons with Rich Tooltips & Live Magnetic Tilt */}
            <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10 max-w-4xl mx-auto w-full py-4 [perspective:900px]">
              {/* ICON 1: PROJECTS */}
              <Link
                href="/projects"
                aria-label="Projects"
                onMouseEnter={() => setActiveAccent("blue")}
                onMouseMove={handleIconMouseMove}
                onMouseLeave={handleIconMouseLeave}
                style={
                  {
                    "--rx": "0deg",
                    "--ry": "0deg",
                    animation:
                      "icon-spew 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.04s both",
                  } as React.CSSProperties
                }
                className="group relative flex flex-col items-center cursor-pointer focus:outline-none"
              >
                {/* Hover Tooltip */}
                <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-52 px-3.5 py-2.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-blue-500/40 shadow-2xl shadow-blue-500/20 opacity-0 translate-y-2 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:scale-100 transition-all duration-200 z-30 text-center">
                  <p className="text-xs font-bold text-white">Projects</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Templates, live previews, documents &amp; task notepads
                  </p>
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-slate-900 border-r border-b border-blue-500/40" />
                </div>

                {/* Pop Icon Button */}
                <div
                  style={{
                    transform: "rotateX(var(--rx)) rotateY(var(--ry))",
                  }}
                  className="relative overflow-hidden w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-blue-950/70 backdrop-blur-xl border border-blue-500/35 group-hover:bg-blue-600 group-hover:border-blue-400 flex items-center justify-center text-3xl sm:text-4xl shadow-2xl group-hover:shadow-blue-500/40 group-hover:-translate-y-3 group-hover:scale-110 active:scale-95 transition-all duration-300 ease-out"
                >
                  <span
                    className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{
                      background:
                        "radial-gradient(64px circle at var(--ix, 50%) var(--iy, 50%), rgba(255,255,255,0.28), transparent 70%)",
                    }}
                  />
                  <span className="relative z-10">📁</span>
                </div>
              </Link>

              {/* ICON 2: SUBSCRIPTIONS */}
              <Link
                href="/subscriptions"
                aria-label="Subscriptions"
                onMouseEnter={() => setActiveAccent("indigo")}
                onMouseMove={handleIconMouseMove}
                onMouseLeave={handleIconMouseLeave}
                style={
                  {
                    "--rx": "0deg",
                    "--ry": "0deg",
                    animation:
                      "icon-spew 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.1s both",
                  } as React.CSSProperties
                }
                className="group relative flex flex-col items-center cursor-pointer focus:outline-none"
              >
                {/* Hover Tooltip */}
                <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-52 px-3.5 py-2.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-indigo-500/40 shadow-2xl shadow-indigo-500/20 opacity-0 translate-y-2 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:scale-100 transition-all duration-200 z-30 text-center">
                  <p className="text-xs font-bold text-white">Subscriptions</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Track renewal dates, countdowns &amp; monthly PKR costs
                  </p>
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-slate-900 border-r border-b border-indigo-500/40" />
                </div>

                {/* Pop Icon Button */}
                <div
                  style={{
                    transform: "rotateX(var(--rx)) rotateY(var(--ry))",
                  }}
                  className="relative overflow-hidden w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-indigo-950/70 backdrop-blur-xl border border-indigo-500/35 group-hover:bg-indigo-600 group-hover:border-indigo-400 flex items-center justify-center text-3xl sm:text-4xl shadow-2xl group-hover:shadow-indigo-500/40 group-hover:-translate-y-3 group-hover:scale-110 active:scale-95 transition-all duration-300 ease-out"
                >
                  <span
                    className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{
                      background:
                        "radial-gradient(64px circle at var(--ix, 50%) var(--iy, 50%), rgba(255,255,255,0.28), transparent 70%)",
                    }}
                  />
                  <span className="relative z-10">⏱️</span>
                </div>
              </Link>

              {/* ICON 3: PASSWORD MANAGER */}
              <Link
                href="/passwords"
                aria-label="Password Manager"
                onMouseEnter={() => setActiveAccent("amber")}
                onMouseMove={handleIconMouseMove}
                onMouseLeave={handleIconMouseLeave}
                style={
                  {
                    "--rx": "0deg",
                    "--ry": "0deg",
                    animation:
                      "icon-spew 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.16s both",
                  } as React.CSSProperties
                }
                className="group relative flex flex-col items-center cursor-pointer focus:outline-none"
              >
                {/* Hover Tooltip */}
                <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-52 px-3.5 py-2.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-amber-500/40 shadow-2xl shadow-amber-500/20 opacity-0 translate-y-2 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:scale-100 transition-all duration-200 z-30 text-center">
                  <p className="text-xs font-bold text-white">Password Manager</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Store project credentials, URLs &amp; 1-click passwords
                  </p>
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-slate-900 border-r border-b border-amber-500/40" />
                </div>

                {/* Pop Icon Button */}
                <div
                  style={{
                    transform: "rotateX(var(--rx)) rotateY(var(--ry))",
                  }}
                  className="relative overflow-hidden w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-amber-950/70 backdrop-blur-xl border border-amber-500/35 group-hover:bg-amber-600 group-hover:border-amber-400 flex items-center justify-center text-3xl sm:text-4xl shadow-2xl group-hover:shadow-amber-500/40 group-hover:-translate-y-3 group-hover:scale-110 active:scale-95 transition-all duration-300 ease-out"
                >
                  <span
                    className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{
                      background:
                        "radial-gradient(64px circle at var(--ix, 50%) var(--iy, 50%), rgba(255,255,255,0.28), transparent 70%)",
                    }}
                  />
                  <span className="relative z-10">🔑</span>
                </div>
              </Link>

              {/* ICON 4: PROMPT SAVER */}
              <Link
                href="/prompts"
                aria-label="Prompt Saver"
                onMouseEnter={() => setActiveAccent("purple")}
                onMouseMove={handleIconMouseMove}
                onMouseLeave={handleIconMouseLeave}
                style={
                  {
                    "--rx": "0deg",
                    "--ry": "0deg",
                    animation:
                      "icon-spew 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.22s both",
                  } as React.CSSProperties
                }
                className="group relative flex flex-col items-center cursor-pointer focus:outline-none"
              >
                {/* Hover Tooltip */}
                <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-52 px-3.5 py-2.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-purple-500/40 shadow-2xl shadow-purple-500/20 opacity-0 translate-y-2 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:scale-100 transition-all duration-200 z-30 text-center">
                  <p className="text-xs font-bold text-white">Prompt Saver</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Save &amp; organize AI prompts with 1-click copy
                  </p>
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-slate-900 border-r border-b border-purple-500/40" />
                </div>

                {/* Pop Icon Button */}
                <div
                  style={{
                    transform: "rotateX(var(--rx)) rotateY(var(--ry))",
                  }}
                  className="relative overflow-hidden w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-purple-950/70 backdrop-blur-xl border border-purple-500/35 group-hover:bg-purple-600 group-hover:border-purple-400 flex items-center justify-center text-3xl sm:text-4xl shadow-2xl group-hover:shadow-purple-500/40 group-hover:-translate-y-3 group-hover:scale-110 active:scale-95 transition-all duration-300 ease-out"
                >
                  <span
                    className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{
                      background:
                        "radial-gradient(64px circle at var(--ix, 50%) var(--iy, 50%), rgba(255,255,255,0.28), transparent 70%)",
                    }}
                  />
                  <span className="relative z-10">💡</span>
                </div>
              </Link>

              {/* ICON 5: COMMANDS */}
              <Link
                href="/commands"
                aria-label="Commands"
                onMouseEnter={() => setActiveAccent("emerald")}
                onMouseMove={handleIconMouseMove}
                onMouseLeave={handleIconMouseLeave}
                style={
                  {
                    "--rx": "0deg",
                    "--ry": "0deg",
                    animation:
                      "icon-spew 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.28s both",
                  } as React.CSSProperties
                }
                className="group relative flex flex-col items-center cursor-pointer focus:outline-none"
              >
                {/* Hover Tooltip */}
                <div className="pointer-events-none absolute -top-20 left-1/2 -translate-x-1/2 w-52 px-3.5 py-2.5 rounded-xl bg-slate-900/95 backdrop-blur-xl border border-emerald-500/40 shadow-2xl shadow-emerald-500/20 opacity-0 translate-y-2 scale-95 group-hover:opacity-100 group-hover:translate-y-0 group-hover:scale-100 group-focus-visible:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:scale-100 transition-all duration-200 z-30 text-center">
                  <p className="text-xs font-bold text-white">Commands</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    CLI vault for GitHub, npm, Linux &amp; custom commands
                  </p>
                  <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-slate-900 border-r border-b border-emerald-500/40" />
                </div>

                {/* Pop Icon Button */}
                <div
                  style={{
                    transform: "rotateX(var(--rx)) rotateY(var(--ry))",
                  }}
                  className="relative overflow-hidden w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-emerald-950/70 backdrop-blur-xl border border-emerald-500/35 group-hover:bg-emerald-600 group-hover:border-emerald-400 flex items-center justify-center text-2xl sm:text-3xl font-mono font-black text-emerald-400 group-hover:text-white shadow-2xl group-hover:shadow-emerald-500/40 group-hover:-translate-y-3 group-hover:scale-110 active:scale-95 transition-all duration-300 ease-out"
                >
                  <span
                    className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                    style={{
                      background:
                        "radial-gradient(64px circle at var(--ix, 50%) var(--iy, 50%), rgba(255,255,255,0.28), transparent 70%)",
                    }}
                  />
                  <span className="relative z-10">&gt;_</span>
                </div>
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}