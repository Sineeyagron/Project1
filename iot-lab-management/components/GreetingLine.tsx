import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { useWeather } from "../lib/weather";
import supabase from "../lib/supabase";

// บรรทัดทักทายบนหัวหน้าแรก (ใช้ร่วม Admin/TA และนักศึกษา):
// [ไอคอนช่วงเวลา] สวัสดีตอน... [อากาศ 26°] · บทบาท ● ออนไลน์

function getGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour >= 5 && hour < 8) return { text: "สวัสดีตอนเช้า", icon: "sunny-outline", color: "#F59E0B" };
  if (hour >= 8 && hour < 12) return { text: "สวัสดีตอนสาย", icon: "partly-sunny-outline", color: "#F59E0B" };
  if (hour >= 12 && hour < 16) return { text: "สวัสดีตอนบ่าย", icon: "sunny-outline", color: "#EA580C" };
  if (hour >= 16 && hour < 19) return { text: "สวัสดีตอนเย็น", icon: "partly-sunny-outline", color: "#EA580C" };
  if (hour >= 19 && hour < 22) return { text: "สวัสดีตอนค่ำ", icon: "moon-outline", color: "#2563EB" };
  return { text: "สวัสดีตอนดึก", icon: "moon-outline", color: "#1D4ED8" };
}

// dot = สีจุด: "green" (ค่าเริ่มต้น) / "red" — แดชบอร์ดผู้ดูแลใช้บอกสถานะเช็กอิน (F4: ยังไม่เช็กอิน = แดง)
export default function GreetingLine({ roleLabel, dot = "green" }: { roleLabel?: string; dot?: "green" | "red" }) {
  const greeting = useMemo(() => getGreeting(), []);
  const weather = useWeather();
  return (
    <View style={s.row}>
      <Ionicons name={greeting.icon as any} size={13} color={greeting.color} />
      <Text style={s.greet}>{greeting.text}</Text>
      {weather ? (
        <View style={s.weather} accessibilityLabel={`อากาศตอนนี้ ${weather.label} ${weather.temp} องศา`}>
          <Ionicons name={weather.icon as any} size={13} color={weather.icon.includes("sun") ? "#F59E0B" : "#64748B"} />
          <Text style={s.weatherText}>{weather.temp}°</Text>
        </View>
      ) : null}
      {roleLabel ? <Text style={s.greet}>· {roleLabel}</Text> : null}
      <OnlineDot tone={dot} />
    </View>
  );
}

// สถานะเชื่อมต่อจริง: ช่องอัปเดตสด (Realtime) ของ Supabase ยังต่ออยู่ไหม — หน้าแรกทุกบทบาทเปิดช่องไว้แล้ว
// เดิมจุดเขียวกระพริบตลอด แม้ไม่มีเน็ต / เช็กแรกหลังเปิดหน้า 4 วิ (รอช่องต่อเสร็จ) แล้วทุก 5 วิ
function useConnected() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const check = () => {
      const webOffline = Platform.OS === "web" && typeof navigator !== "undefined" && navigator.onLine === false;
      setOnline(!webOffline && supabase.realtime.isConnected());
    };
    const first = setTimeout(check, 4000);
    const timer = setInterval(check, 5000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);
  return online;
}

// จุดเขียวกระพริบ = ออนไลน์ (วงแสงขยายแล้วจางหาย วนไปเรื่อย ๆ) / จุดเทานิ่ง = ขาดการเชื่อมต่อ
// แดงตัดกับพื้นขาวชัดกว่าเขียว → ลดความเข้มวงแสง/เงาของสีแดง ให้ดูขนาดเท่ากัน (ขนาดจริงเท่ากันอยู่แล้ว)
const DOT_COLOR = {
  green: { fill: "#22C55E", glow: "0 0 6px rgba(34,197,94,0.7)", ring: 0.6 },
  red: { fill: "#EF4444", glow: "0 0 3px rgba(239,68,68,0.45)", ring: 0.3 },
};

function OnlineDot({ tone }: { tone: "green" | "red" }) {
  const c = DOT_COLOR[tone];
  const online = useConnected();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!online) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1100, easing: Easing.out(Easing.ease), useNativeDriver: Platform.OS !== "web" }),
      { resetBeforeIteration: true }
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, online]);
  if (!online) {
    return (
      <View style={s.onlineWrap} accessibilityLabel="ออฟไลน์">
        <View style={[s.onlineDot, s.offlineDot]} />
      </View>
    );
  }
  return (
    <View style={s.onlineWrap} accessibilityLabel="ออนไลน์">
      <Animated.View
        style={[
          s.onlineRing,
          { backgroundColor: c.fill },
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [c.ring, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.5] }) }],
          },
        ]}
      />
      <Animated.View style={[s.onlineDot, { backgroundColor: c.fill, boxShadow: c.glow }, { opacity: pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.35, 1] }) }]} />
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  greet: { color: "#475569", fontSize: 13 },
  weather: { flexDirection: "row", alignItems: "center", gap: 2 },
  weatherText: { color: "#475569", fontSize: 13, fontWeight: "600" },
  onlineWrap: { width: 10, height: 10, marginLeft: 3, alignItems: "center", justifyContent: "center" },
  onlineRing: { position: "absolute", width: 10, height: 10, borderRadius: 5, backgroundColor: "#22C55E" },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E", boxShadow: "0 0 6px rgba(34,197,94,0.7)" },
  offlineDot: { backgroundColor: "#94A3B8", boxShadow: "none" },
});
