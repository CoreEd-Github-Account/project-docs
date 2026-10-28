import { NextResponse } from "next/server";

function getWeatherDetails(
  code: number,
  isDay: boolean,
  metarWx?: string
): { emoji: string; condition: string } {
  if (metarWx) {
    const wx = metarWx.toUpperCase();
    if (wx.includes("TS")) return { emoji: "⛈️", condition: "Thunderstorm" };
    if (wx.includes("RA") || wx.includes("DZ")) return { emoji: "🌧️", condition: "Rain" };
    if (wx.includes("SN")) return { emoji: "❄️", condition: "Snow" };
    if (wx.includes("FG")) return { emoji: "🌫️", condition: "Foggy" };
    if (wx.includes("HZ") || wx.includes("FU") || wx.includes("DU")) {
      return { emoji: isDay ? "🌤️" : "🌙", condition: isDay ? "Hazy & Warm" : "Clear & Hazy" };
    }
  }

  switch (code) {
    case 0:
      return isDay
        ? { emoji: "☀️", condition: "Sunny & Clear" }
        : { emoji: "🌙", condition: "Clear Night" };
    case 1:
      return isDay
        ? { emoji: "🌤️", condition: "Mainly Clear" }
        : { emoji: "🌙", condition: "Mostly Clear" };
    case 2:
      return isDay
        ? { emoji: "⛅", condition: "Partly Cloudy" }
        : { emoji: "☁️", condition: "Partly Cloudy" };
    case 3:
      return { emoji: "☁️", condition: "Overcast" };
    case 45:
    case 48:
      return { emoji: "🌫️", condition: "Foggy" };
    case 51:
    case 53:
    case 55:
    case 56:
    case 57:
      return { emoji: "🌦️", condition: "Light Drizzle" };
    case 61:
    case 63:
    case 65:
    case 66:
    case 67:
      return { emoji: "🌧️", condition: "Rain" };
    case 71:
    case 73:
    case 75:
    case 77:
      return { emoji: "❄️", condition: "Snow" };
    case 80:
    case 81:
    case 82:
      return { emoji: "🌦️", condition: "Rain Showers" };
    case 85:
    case 86:
      return { emoji: "🌨️", condition: "Snow Showers" };
    case 95:
    case 96:
    case 99:
      return { emoji: "⛈️", condition: "Thunderstorm" };
    default:
      return isDay
        ? { emoji: "⛅", condition: "Partly Cloudy" }
        : { emoji: "🌙", condition: "Clear Night" };
  }
}

// Calculate Relative Humidity (%) from Temperature (C) and Dew Point (C) via Magnus formula
function calcHumidityFromDewPoint(tempC: number, dewpC: number): number {
  const a = 17.625;
  const b = 243.04;
  const alphaT = (a * tempC) / (b + tempC);
  const alphaD = (a * dewpC) / (b + dewpC);
  const rh = 100 * Math.exp(alphaD - alphaT);
  return Math.max(5, Math.min(100, Math.round(rh)));
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const paramLat = searchParams.get("lat");
    const paramLon = searchParams.get("lon");
    const paramCity = searchParams.get("city");
    const paramIp = searchParams.get("ip");

    let lat = paramLat ? parseFloat(paramLat) : NaN;
    let lon = paramLon ? parseFloat(paramLon) : NaN;
    let city = paramCity || "";
    let country = "";
    let ip = paramIp || "";

    // Extract client IP from request headers if behind proxy
    if (!ip) {
      const forwarded = request.headers.get("x-forwarded-for");
      const realIp = request.headers.get("x-real-ip");
      const candidate = forwarded ? forwarded.split(",")[0].trim() : realIp?.trim() || "";
      if (candidate && candidate !== "::1" && candidate !== "127.0.0.1") {
        ip = candidate;
      }
    }

    // 1. Auto-detect user's IP and coordinates if not provided by client
    if (Number.isNaN(lat) || Number.isNaN(lon) || !city || !ip) {
      try {
        const ipWhoUrl = ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : "https://ipwho.is/";
        const ipRes = await fetch(ipWhoUrl, {
          headers: { "User-Agent": "WorkspacePortal/1.0" },
          cache: "no-store",
        });

        if (ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData && ipData.success !== false) {
            if (Number.isNaN(lat) && typeof ipData.latitude === "number") lat = ipData.latitude;
            if (Number.isNaN(lon) && typeof ipData.longitude === "number") lon = ipData.longitude;
            if (!city && ipData.city) city = ipData.city;
            if (ipData.country_code) country = ipData.country_code;
            if (!ip && ipData.ip) ip = ipData.ip;
          }
        }
      } catch (e) {
        console.warn("ipwho.is fallback:", e);
      }
    }

    // Secondary IP geolocation fallback (freeipapi)
    if (Number.isNaN(lat) || Number.isNaN(lon) || !city) {
      try {
        const freeRes = await fetch("https://freeipapi.com/api/json", {
          headers: { "User-Agent": "WorkspacePortal/1.0" },
          cache: "no-store",
        });
        if (freeRes.ok) {
          const freeData = await freeRes.json();
          if (Number.isNaN(lat) && typeof freeData.latitude === "number") lat = freeData.latitude;
          if (Number.isNaN(lon) && typeof freeData.longitude === "number") lon = freeData.longitude;
          if (!city && freeData.cityName) city = freeData.cityName;
          if (!country && freeData.countryCode) country = freeData.countryCode;
          if (!ip && freeData.ipAddress) ip = freeData.ipAddress;
        }
      } catch (e) {
        console.warn("freeipapi fallback:", e);
      }
    }

    // Default fallback coordinates if all geo lookups fail
    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      lat = 24.8608;
      lon = 67.0104;
      if (!city) city = "Karachi";
      if (!country) country = "PK";
    }

    // 2. Query real local airport weather station (METAR) + Open-Meteo in parallel
    const bbox = `${(lat - 0.65).toFixed(3)},${(lon - 0.65).toFixed(3)},${(lat + 0.65).toFixed(3)},${(lon + 0.65).toFixed(3)}`;
    const metarUrl = `https://aviationweather.gov/api/data/metar?bbox=${bbox}&format=json`;
    const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,is_day`;

    const [metarResult, openMeteoResult] = await Promise.allSettled([
      fetch(metarUrl, {
        headers: { "User-Agent": "WorkspacePortal/1.0" },
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : null)),
      fetch(openMeteoUrl, {
        cache: "no-store",
      }).then((r) => (r.ok ? r.json() : null)),
    ]);

    const metarList =
      metarResult.status === "fulfilled" && Array.isArray(metarResult.value)
        ? metarResult.value
        : [];
    const omData =
      openMeteoResult.status === "fulfilled" && openMeteoResult.value
        ? openMeteoResult.value
        : null;

    const currentOm = omData?.current || {};
    const isDay =
      typeof currentOm.is_day === "number"
        ? currentOm.is_day === 1
        : new Date().getHours() >= 6 && new Date().getHours() < 19;

    // Pick closest METAR station if available
    let closestStation: any = null;
    if (metarList.length > 0) {
      closestStation = metarList
        .filter((s: any) => typeof s.temp === "number")
        .sort((a: any, b: any) => {
          const distA = Math.hypot((a.lat || 0) - lat, (a.lon || 0) - lon);
          const distB = Math.hypot((b.lat || 0) - lat, (b.lon || 0) - lon);
          return distA - distB;
        })[0];
    }

    const temperature =
      closestStation && typeof closestStation.temp === "number"
        ? Math.round(closestStation.temp)
        : Math.round(currentOm.temperature_2m ?? 25);

    const humidity =
      closestStation &&
      typeof closestStation.temp === "number" &&
      typeof closestStation.dewp === "number"
        ? calcHumidityFromDewPoint(closestStation.temp, closestStation.dewp)
        : Math.round(currentOm.relative_humidity_2m ?? 45);

    const windSpeed =
      closestStation && typeof closestStation.wspd === "number"
        ? Math.round(closestStation.wspd * 1.852) // knots to km/h
        : Math.round(currentOm.wind_speed_10m ?? 8);

    const code = typeof currentOm.weather_code === "number" ? currentOm.weather_code : 0;
    const { emoji, condition } = getWeatherDetails(
      code,
      isDay,
      closestStation?.wxString
    );

    const locationLabel = city
      ? country
        ? `${city}, ${country}`
        : city
      : closestStation?.name || "Local Area";

    return NextResponse.json({
      temperature,
      humidity,
      windSpeed,
      emoji,
      condition,
      location: locationLabel,
      ip: ip || undefined,
      station: closestStation?.icaoId || undefined,
      isDay,
    });
  } catch (err) {
    console.error("GET /api/weather error:", err);
    return NextResponse.json(
      { error: "Failed to fetch live weather" },
      { status: 500 }
    );
  }
}
