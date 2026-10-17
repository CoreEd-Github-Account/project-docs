import { NextResponse } from "next/server";

function getWeatherDetails(code: number): { emoji: string; condition: string } {
  switch (code) {
    case 0:
      return { emoji: "☀️", condition: "Sunny & Clear" };
    case 1:
      return { emoji: "🌤️", condition: "Mainly Clear" };
    case 2:
      return { emoji: "⛅", condition: "Partly Cloudy" };
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
      return { emoji: "⛅", condition: "Partly Cloudy" };
  }
}

export async function GET(request: Request) {
  try {
    let lat = 24.8608;
    let lon = 67.0104;

    // 1. Auto-detect user's IP coordinates
    try {
      // Check freeipapi for user geo coordinates
      const ipRes = await fetch("https://freeipapi.com/api/json", {
        headers: { "User-Agent": "Project-Studio/1.0" },
        next: { revalidate: 1800 }, // Cache geo for 30 mins
      });

      if (ipRes.ok) {
        const ipData = await ipRes.json();
        if (typeof ipData.latitude === "number" && typeof ipData.longitude === "number") {
          lat = ipData.latitude;
          lon = ipData.longitude;
        }
      }
    } catch (geoErr) {
      console.warn("Geo IP fetch fallback:", geoErr);
    }

    // 2. Fetch live weather from Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m`;
    const weatherRes = await fetch(weatherUrl, {
      next: { revalidate: 600 }, // Cache weather for 10 minutes
    });

    if (!weatherRes.ok) {
      throw new Error(`Open-Meteo responded with ${weatherRes.status}`);
    }

    const weatherData = await weatherRes.json();
    const current = weatherData.current || {};
    const code = typeof current.weather_code === "number" ? current.weather_code : 0;
    const { emoji, condition } = getWeatherDetails(code);

    return NextResponse.json({
      temperature: Math.round(current.temperature_2m ?? 26),
      humidity: Math.round(current.relative_humidity_2m ?? 50),
      windSpeed: Math.round(current.wind_speed_10m ?? 8),
      emoji,
      condition,
    });
  } catch (err) {
    console.error("GET /api/weather error:", err);
    // Graceful fallback weather so UI remains visual and never crashes
    return NextResponse.json({
      temperature: 28,
      humidity: 45,
      windSpeed: 10,
      emoji: "☀️",
      condition: "Clear & Sunny",
    });
  }
}
