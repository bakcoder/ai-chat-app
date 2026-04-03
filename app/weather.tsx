"use client";

import { useState, useEffect, useCallback } from "react";

type WeatherData = {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
  daily: {
    tempMax: number;
    tempMin: number;
    weatherCode: number;
    date: string;
  }[];
  locationName: string;
};

const SEOUL = { lat: 37.5665, lon: 126.978 };

const WEATHER_LABELS: Record<number, string> = {
  0: "맑음",
  1: "대체로 맑음",
  2: "약간 흐림",
  3: "흐림",
  45: "안개",
  48: "짙은 안개",
  51: "가벼운 이슬비",
  53: "이슬비",
  55: "짙은 이슬비",
  61: "약한 비",
  63: "비",
  65: "강한 비",
  71: "약한 눈",
  73: "눈",
  75: "강한 눈",
  80: "소나기",
  81: "소나기",
  82: "강한 소나기",
  95: "뇌우",
  96: "우박 뇌우",
  99: "강한 우박 뇌우",
};

function weatherIcon(code: number, isDay: boolean): string {
  if (code === 0) return isDay ? "☀️" : "🌙";
  if (code <= 2) return isDay ? "⛅" : "☁️";
  if (code === 3) return "☁️";
  if (code <= 48) return "🌫️";
  if (code <= 55) return "🌦️";
  if (code <= 65) return "🌧️";
  if (code <= 75) return "❄️";
  if (code <= 82) return "🌧️";
  return "⛈️";
}

function dayLabel(dateStr: string): string {
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round(
    (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  return `${d.getMonth() + 1}/${d.getDate()} (${days[d.getDay()]})`;
}

async function fetchWeather(
  lat: number,
  lon: number,
): Promise<WeatherData> {
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lon.toString(),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day",
    daily: "temperature_2m_max,temperature_2m_min,weather_code",
    timezone: "auto",
    forecast_days: "5",
  });

  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?${params.toString()}`,
  );

  if (!res.ok) throw new Error("날씨 정보를 가져올 수 없습니다.");

  const data = await res.json();
  const c = data.current;
  const d = data.daily;

  let locationName = "현재 위치";
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?latitude=${lat}&longitude=${lon}&count=1&language=ko&format=json`,
    );
    if (geoRes.ok) {
      const geoData = await geoRes.json();
      if (geoData.results?.[0]) {
        locationName = geoData.results[0].name;
      }
    }
  } catch {
    /* ignore geocoding errors */
  }

  return {
    temperature: Math.round(c.temperature_2m),
    apparentTemperature: Math.round(c.apparent_temperature),
    humidity: c.relative_humidity_2m,
    windSpeed: Math.round(c.wind_speed_10m * 10) / 10,
    weatherCode: c.weather_code,
    isDay: c.is_day === 1,
    locationName,
    daily: (d.time as string[]).map((date: string, i: number) => ({
      date,
      tempMax: Math.round(d.temperature_2m_max[i]),
      tempMin: Math.round(d.temperature_2m_min[i]),
      weatherCode: d.weather_code[i],
    })),
  };
}

function getPosition(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(SEOUL);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(SEOUL),
      { timeout: 5000 },
    );
  });
}

export default function Weather() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const pos = await getPosition();
      const data = await fetchWeather(pos.lat, pos.lon);
      setWeather(data);
    } catch {
      setError("날씨 정보를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="p-4">
        <p className="text-xs text-zinc-400 animate-pulse">날씨 로딩 중...</p>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="p-4">
        <p className="text-xs text-red-400 mb-2">{error}</p>
        <button
          onClick={load}
          className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline"
        >
          다시 시도
        </button>
      </div>
    );
  }

  const label =
    WEATHER_LABELS[weather.weatherCode] ?? `코드 ${weather.weatherCode}`;
  const icon = weatherIcon(weather.weatherCode, weather.isDay);

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Current */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            {weather.locationName}
          </span>
          <button
            onClick={load}
            className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            aria-label="새로고침"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-3 h-3"
            >
              <path d="M21 12a9 9 0 1 1-3-6.7" />
              <path d="M21 3v6h-6" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-3xl">{icon}</span>
          <div>
            <p className="text-2xl font-semibold tracking-tight">
              {weather.temperature}°
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs text-zinc-600 dark:text-zinc-400">
          <span>체감 {weather.apparentTemperature}°</span>
          <span>습도 {weather.humidity}%</span>
          <span>바람 {weather.windSpeed}km/h</span>
          <span>
            {weather.daily[0]?.tempMin}° / {weather.daily[0]?.tempMax}°
          </span>
        </div>
      </div>

      {/* Forecast */}
      <div>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
          주간 예보
        </p>
        <div className="space-y-1.5">
          {weather.daily.map((d) => (
            <div
              key={d.date}
              className="flex items-center justify-between text-xs"
            >
              <span className="w-16 text-zinc-600 dark:text-zinc-400">
                {dayLabel(d.date)}
              </span>
              <span>{weatherIcon(d.weatherCode, true)}</span>
              <span className="w-16 text-right tabular-nums">
                <span className="text-zinc-400 dark:text-zinc-500">
                  {d.tempMin}°
                </span>
                {" / "}
                <span className="text-zinc-800 dark:text-zinc-200 font-medium">
                  {d.tempMax}°
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
