"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/LoginForm";

interface WeatherData {
  temp: number;
  condition: string;
  emoji: string;
  humidity?: number;
  windSpeed?: number;
}

export default function HomePortal() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Live Date & Time State
  const [now, setNow] = useState<Date | null>(null);

  // Auto IP-based Weather State (no address shown)
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);

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

  // Fetch live weather via user's IP (silently auto-detected, no address displayed)
  useEffect(() => {
    let isMounted = true;

    const fetchWeather = async () => {
      try {
        // 1. Try local server endpoint
        const res = await fetch("/api/weather");
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setWeather({
              temp: data.temperature,
              condition: data.condition,
              emoji: data.emoji,
              humidity: data.humidity,
              windSpeed: data.windSpeed,
            });
            setWeatherLoading(false);
            return;
          }
        }
      } catch {}

      // 2. Direct client-side auto IP detection & Open-Meteo fallback
      try {
        const geoRes = await fetch("https://freeipapi.com/api/json");
        const geo = await geoRes.json();
        const lat = typeof geo.latitude === "number" ? geo.latitude : 24.86;
        const lon = typeof geo.longitude === "number" ? geo.longitude : 67.01;

        const wRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m`
        );
        const wData = await wRes.json();
        const current = wData.current || {};
        const code = current.weather_code ?? 0;

        const emojiMap: Record<number, { emoji: string; text: string }> = {
          0: { emoji: "☀️", text: "Sunny & Clear" },
          1: { emoji: "🌤️", text: "Mainly Clear" },
          2: { emoji: "⛅", text: "Partly Cloudy" },
          3: { emoji: "☁️", text: "Overcast" },
          45: { emoji: "🌫️", text: "Foggy" },
          48: { emoji: "🌫️", text: "Foggy" },
          51: { emoji: "🌦️", text: "Light Drizzle" },
          61: { emoji: "🌧️", text: "Rain" },
          71: { emoji: "❄️", text: "Snow" },
          80: { emoji: "🌦️", text: "Showers" },
          95: { emoji: "⛈️", text: "Thunderstorm" },
        };

        const mapped = emojiMap[code] || { emoji: "⛅", text: "Partly Cloudy" };

        if (isMounted) {
          setWeather({
            temp: Math.round(current.temperature_2m ?? 28),
            condition: mapped.text,
            emoji: mapped.emoji,
            humidity: Math.round(current.relative_humidity_2m ?? 48),
            windSpeed: Math.round(current.wind_speed_10m ?? 10),
          });
        }
      } catch (err) {
        console.error("Client weather fetch error:", err);
      } finally {
        if (isMounted) setWeatherLoading(false);
      }
    };

    fetchWeather();
    return () => {
      isMounted = false;
    };
  }, []);

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
  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col overflow-x-hidden">
      {/* Visual Appealing Blurry Background Image & Ambient Mesh Lighting */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <img
          src="/images/workspace-bg.jpg"
          alt=""
          className="w-full h-full object-cover scale-105 filter blur-md opacity-40 select-none transition-opacity duration-1000"
        />
        {/* Soft Dark Vignette Overlays for Maximum Contrast & Readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950/85 via-slate-950/70 to-slate-950/95" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[450px] bg-blue-600/15 blur-[160px] rounded-full pointer-events-none" />
      </div>

      {/* Top Header */}
      <header className="bg-slate-900/60 border-b border-slate-800/80 sticky top-0 z-20 backdrop-blur-xl">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm shadow-md shadow-blue-600/30">
              T
            </div>
            <div>
              <h1 className="text-base font-bold text-white leading-tight">
                Workspace Portal
              </h1>
              <span className="text-xs text-slate-400">Private Admin Access</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/settings"
              title="Settings & Theme Selector"
              className="group p-1.5 sm:px-3 sm:py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 hover:border-blue-500/50 transition-all flex items-center gap-1.5 text-xs font-medium cursor-pointer shadow-sm"
            >
              <svg className="w-4 h-4 text-slate-400 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="hidden sm:inline">Settings</span>
            </Link>

            <button
              onClick={handleLogout}
              className="text-xs text-red-400 hover:text-red-300 bg-red-950/30 hover:bg-red-950/60 px-3 py-1.5 rounded-lg border border-red-500/30 transition cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 flex flex-col justify-center">
        {/* TOP CORNER SECTION: BIG FONT DATE & TIME + AUTO IP WEATHER */}
        <div className="flex flex-col md:flex-row items-center md:items-end justify-between gap-6 mb-10 pb-6 border-b border-slate-800/80">
          {/* Big Font Live Clock & Date in the Corner */}
          <div className="space-y-1.5 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <span className="text-4xl sm:text-6xl font-black text-white tracking-tight font-mono drop-shadow-xl">
                {timeString || "00:00:00 AM"}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-950/80 border border-blue-500/30 px-2 py-0.5 rounded-md shadow-sm">
                Live
              </span>
            </div>
            <p className="text-sm sm:text-base font-medium text-slate-300 tracking-wide flex items-center justify-center md:justify-start gap-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{dateString || "Loading today's date..."}</span>
            </p>
          </div>

          {/* Current Live Weather Widget (Auto-detected via user IP, no address shown) */}
          <div className="flex items-center gap-4 px-5 py-3 rounded-2xl bg-slate-900/70 backdrop-blur-xl border border-slate-800/80 shadow-2xl hover:border-slate-700 transition">
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
                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                    {weather.humidity !== undefined && (
                      <span>💧 {weather.humidity}% Humidity</span>
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
                <span className="text-2xl">☀️</span>
                <span>Weather data ready</span>
              </div>
            )}
          </div>
        </div>

        {/* Section Heading */}
        <div className="text-center max-w-md mx-auto mb-8 space-y-1.5">
          <h2 className="text-2xl font-bold text-white tracking-tight drop-shadow-sm">
            Select Workspace
          </h2>
          <p className="text-sm text-slate-400">
            Choose which section you want to open.
          </p>
        </div>

        {/* 4 Main Action Cards with Glassmorphism */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto w-full">
          {/* CARD 1: PROJECTS */}
          <Link
            href="/projects"
            className="group bg-slate-900/75 backdrop-blur-xl border border-slate-800/80 hover:border-blue-500/80 rounded-2xl p-5 shadow-2xl hover:shadow-blue-500/10 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-blue-950/60 border border-blue-500/30 flex items-center justify-center text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200 shadow-md">
                📁
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                  Projects
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Documentation templates, section builder, live markdown previews, and task notepads.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-400 group-hover:translate-x-0.5 transition-transform">
                Open Projects →
              </span>
              <span className="text-[11px] text-slate-500">Templates</span>
            </div>
          </Link>

          {/* CARD 2: SUBSCRIPTIONS */}
          <Link
            href="/subscriptions"
            className="group bg-slate-900/75 backdrop-blur-xl border border-slate-800/80 hover:border-blue-500/80 rounded-2xl p-5 shadow-2xl hover:shadow-blue-500/10 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-950/60 border border-indigo-500/30 flex items-center justify-center text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200 shadow-md">
                ⏱️
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                  Subscriptions
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Track purchase and renewal dates, calculate time remaining, and track monthly PKR costs.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-400 group-hover:translate-x-0.5 transition-transform">
                Open Subscriptions →
              </span>
              <span className="text-[11px] text-slate-500">Renewals</span>
            </div>
          </Link>

          {/* CARD 3: PASSWORD MANAGER */}
          <Link
            href="/passwords"
            className="group bg-slate-900/75 backdrop-blur-xl border border-slate-800/80 hover:border-blue-500/80 rounded-2xl p-5 shadow-2xl hover:shadow-blue-500/10 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-amber-950/60 border border-amber-500/30 flex items-center justify-center text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200 shadow-md">
                🔑
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                  Password Manager
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Store project credentials, URLs, IDs, and plain-text passwords with 1-click clipboard copy.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-400 group-hover:translate-x-0.5 transition-transform">
                Open Passwords →
              </span>
              <span className="text-[11px] text-slate-500">Plain-text</span>
            </div>
          </Link>

          {/* CARD 4: PROMPT SAVER */}
          <Link
            href="/prompts"
            className="group bg-slate-900/75 backdrop-blur-xl border border-slate-800/80 hover:border-blue-500/80 rounded-2xl p-5 shadow-2xl hover:shadow-blue-500/10 transition-all duration-200 flex flex-col justify-between text-left cursor-pointer"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center text-lg group-hover:bg-blue-600 group-hover:text-white transition-colors duration-200 shadow-md">
                💡
              </div>
              <div>
                <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                  Prompt Saver
                </h3>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Store and organize AI prompts with headings, descriptions, and 1-click clipboard copy.
                </p>
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
              <span className="text-xs font-semibold text-blue-400 group-hover:translate-x-0.5 transition-transform">
                Open Prompts →
              </span>
              <span className="text-[11px] text-slate-500">Library</span>
            </div>
          </Link>
        </div>
      </main>
    </div>
  );
}