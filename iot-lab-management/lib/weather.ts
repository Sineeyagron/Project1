import { useEffect, useState } from "react";

// สภาพอากาศเล็ก ๆ บนหัวแดชบอร์ด — Open-Meteo (ฟรี ไม่ต้องใช้ API key)
// ใช้พิกัด มข. ตายตัว จะได้ไม่ต้องขอสิทธิ์ตำแหน่งเครื่อง
const KKU = { lat: 16.4747, lon: 102.823 };
const TTL = 60 * 60 * 1000; // ดึงใหม่ทุก 1 ชม. (แคชในหน่วยความจำ ข้ามหน้าไปมาไม่ยิงซ้ำ)

export type Weather = { temp: number; icon: string; label: string };

let cache: { at: number; data: Weather } | null = null;

// WMO weather code → ไอคอน Ionicons + คำไทยสั้น ๆ
function describe(code: number, isDay: boolean): { icon: string; label: string } {
  if (code === 0) return isDay ? { icon: "sunny", label: "แดดจัด" } : { icon: "moon", label: "ฟ้าโปร่ง" };
  if (code <= 2) return isDay ? { icon: "partly-sunny", label: "มีเมฆบางส่วน" } : { icon: "cloudy-night", label: "มีเมฆบางส่วน" };
  if (code === 3) return { icon: "cloud", label: "เมฆมาก" };
  if (code === 45 || code === 48) return { icon: "cloud", label: "หมอก" };
  if (code >= 95) return { icon: "thunderstorm", label: "พายุฝน" };
  if (code >= 51) return { icon: "rainy", label: "ฝนตก" };
  return { icon: "cloud", label: "มีเมฆ" };
}

export function useWeather() {
  const [weather, setWeather] = useState<Weather | null>(cache?.data ?? null);

  useEffect(() => {
    if (cache && Date.now() - cache.at < TTL) return;
    let alive = true;
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${KKU.lat}&longitude=${KKU.lon}&current=temperature_2m,weather_code,is_day&timezone=Asia%2FBangkok`
    )
      .then((r) => r.json())
      .then((j) => {
        const c = j?.current;
        if (!c || typeof c.temperature_2m !== "number") return;
        const data = { temp: Math.round(c.temperature_2m), ...describe(c.weather_code, c.is_day === 1) };
        cache = { at: Date.now(), data };
        if (alive) setWeather(data);
      })
      .catch(() => {}); // ไม่มีเน็ต / API ล่ม = ไม่แสดง ไม่ต้องเตือน
    return () => {
      alive = false;
    };
  }, []);

  return weather;
}
