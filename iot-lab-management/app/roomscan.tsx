import React, { useRef, useState } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "../components/AppText";
import ScanCamera from "../components/ScanCamera";
import ScreenHeader from "../components/ScreenHeader";
import { goBack } from "../lib/nav";
import { notify } from "../lib/notify";
import { parseStationLink } from "../lib/room/stationQr";
import { W, C } from "../lib/theme";

// สแกน QR ที่แปะคอม (ระบบห้อง) → ผังห้องพร้อมแผ่นของเครื่องนั้น: ดูสถานะ / แจ้งปัญหา
// แยกจากหน้าสแกนยืม-คืน (app/scan) — QR อุปกรณ์ยืมไม่รับที่นี่ และ QR คอมไม่รับที่หน้านั้น
// from=admin = เปิดจากหน้าผู้ดูแล (admin/room) → ผังห้องโหมดผู้ดูแล (เห็นประวัติ + แก้เช็กลิสต์ได้)
export default function RoomScan() {
  const router = useRouter();
  const { from } = useLocalSearchParams<{ from?: string }>();
  const { height } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const lock = useRef(false); // กล้องส่งค่าเดิมซ้ำหลายครั้งต่อวินาที
  const lastBad = useRef(""); // QR ที่ไม่ใช่ของห้องคอม เตือนครั้งเดียวต่อป้าย

  const onScanned = (data: string) => {
    if (lock.current) return;
    const hit = parseStationLink(data);
    if (!hit) {
      if (lastBad.current === data) return;
      lastBad.current = data;
      notify("ไม่ใช่ป้ายห้องคอม", "สแกน QR ที่แปะบนเครื่องคอม · ป้ายอุปกรณ์ยืม-คืนให้สแกนที่ปุ่ม \"สแกนยืม / คืนอุปกรณ์\"");
      return;
    }
    lock.current = true;
    setBusy(true);
    router.replace({
      pathname: "/roommap",
      params: { room_id: hit.room_id, station: hit.station, ...(from === "admin" ? { from: "admin" } : {}) },
    } as any);
  };

  return (
    <View style={s.page}>
      <ScreenHeader
        title="สแกน QR คอม"
        subtitle="ดูสถานะเครื่อง / แจ้งปัญหา"
        onBack={() => goBack(from === "admin" ? "/admin/room" : "/home")}
      />
      <View style={s.body}>
        <ScanCamera
          height={Math.round(Math.min(440, height * 0.55))}
          onScanned={onScanned}
          tip="ส่องกล้องไปที่ QR บนป้ายเครื่องคอม"
          footnote="ให้ QR อยู่ในกรอบ · ห่าง 10–30 ซม."
          busy={busy}
          askSub="ใช้สแกน QR ที่แปะบนเครื่องคอม"
        />
        <View style={[W.card, s.hint]}>
          <Ionicons name="desktop-outline" size={20} color={C.primary} />
          <Text style={s.hintText}>ป้ายอยู่ที่ตัวเครื่องหรือจอ · สแกนแล้วเห็นสถานะเครื่องและอุปกรณ์ กดแจ้งปัญหาได้ทันที</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  page: { ...W.page },
  body: { paddingHorizontal: 16, gap: 14 },
  hint: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  hintText: { flex: 1, fontSize: 13, lineHeight: 19, color: C.text2 },
});
