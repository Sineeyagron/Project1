import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { CameraView, useCameraPermissions, BarcodeType } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { C } from "../lib/theme";

// กล้องสแกนกลาง (ระบบยืม-คืน): หน้าสแกนยืม/คืนของ นศ. (app/scan) + สแกนดูสถานะของผู้ดูแล (app/admin/lookup)
//   แบบ ก ที่เจ้าของโปรเจกต์เลือก 11 ต.ค. 2569: กล้องใหญ่ + กรอบเล็ง 4 มุม + เส้นสแกนวิ่ง + ปุ่มไฟฉาย + ป้ายบอกวิธีบนภาพ
//   ยังไม่อนุญาตกล้อง = พื้นเข้มเหมือนกล้อง + ปุ่มอนุญาต / กำลังค้นหา = วงหมุนบนภาพกล้อง
const FRAME = 190; // ขนาดกรอบเล็ง

export default function ScanCamera({
  height,
  onScanned,
  barcodeTypes = ["qr"],
  tip,
  footnote,
  busy = false,
}: {
  height: number;
  onScanned: (data: string) => void;
  barcodeTypes?: BarcodeType[];
  tip: string; // ป้ายบนภาพด้านบน
  footnote?: string; // ข้อความเล็กมุมล่างซ้าย
  busy?: boolean; // กำลังค้นหาหลังสแกน
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const sweep = useRef(new Animated.Value(0)).current;

  // เส้นสแกนวิ่งขึ้นลงในกรอบ — บอกว่ากล้องกำลังหา QR อยู่ (หยุดตอนกำลังค้นหา)
  useEffect(() => {
    if (busy || !permission?.granted) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [busy, permission?.granted]);

  const lineY = sweep.interpolate({ inputRange: [0, 1], outputRange: [10, FRAME - 12] });

  return (
    <View style={[s.box, { height }]}>
      {permission?.granted ? (
        <>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            onBarcodeScanned={busy ? undefined : ({ data }) => onScanned(data)}
            barcodeScannerSettings={{ barcodeTypes }}
          />
          {/* กรอบเล็ง 4 มุม + เส้นสแกน */}
          <View pointerEvents="none" style={s.frameWrap}>
            <View style={s.frame}>
              <View style={[s.corner, s.tl]} />
              <View style={[s.corner, s.tr]} />
              <View style={[s.corner, s.bl]} />
              <View style={[s.corner, s.br]} />
              {!busy && <Animated.View style={[s.line, { transform: [{ translateY: lineY }] }]} />}
            </View>
          </View>
          <View pointerEvents="none" style={s.tip}>
            <Text style={s.tipText} numberOfLines={1}>{tip}</Text>
          </View>
          {footnote ? <Text pointerEvents="none" style={s.footnote} numberOfLines={1}>{footnote}</Text> : null}
          {/* ไฟฉาย: ห้องแล็บมืด / ป้ายสะท้อนแสง (เว็บไม่มี) */}
          {Platform.OS !== "web" && (
            <TouchableOpacity
              style={[s.torch, torch && s.torchOn]}
              onPress={() => setTorch((v) => !v)}
              activeOpacity={0.85}
              accessibilityLabel={torch ? "ปิดไฟฉาย" : "เปิดไฟฉาย"}
            >
              {/* ไอคอนไฟฉาย (ไม่ใช่สายฟ้า) — ผู้ใช้ Android คุ้นกับสายฟ้าว่าเป็นแฟลชถ่ายรูป */}
              <Ionicons name={torch ? "flashlight" : "flashlight-outline"} size={19} color={torch ? C.ink : "#FFFFFF"} />
            </TouchableOpacity>
          )}
          {busy && (
            <View style={s.busy}>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text style={s.busyText}>กำลังค้นหา...</Text>
            </View>
          )}
        </>
      ) : (
        <TouchableOpacity style={s.ask} onPress={requestPermission} activeOpacity={0.85} disabled={!permission}>
          {!permission ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <View style={s.askIcon}>
                <Ionicons name="camera-outline" size={30} color="#FFFFFF" />
              </View>
              <Text style={s.askTitle}>แตะเพื่ออนุญาตใช้กล้อง</Text>
              <Text style={s.askSub}>ใช้สแกน QR ที่ติดบนอุปกรณ์</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const CORNER = 30;
const s = StyleSheet.create({
  box: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#121A28",
    boxShadow: "0 2px 4px rgba(15,23,42,0.08), 0 12px 24px rgba(37,99,235,0.14)",
  },
  frameWrap: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center" },
  frame: { width: FRAME, height: FRAME },
  corner: { position: "absolute", width: CORNER, height: CORNER, borderColor: "#FFFFFF" },
  tl: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 16 },
  tr: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 16 },
  bl: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 16 },
  br: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 16 },
  line: {
    position: "absolute",
    left: 12,
    right: 12,
    top: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#60A5FA",
    boxShadow: "0 0 10px #60A5FA",
  },
  tip: {
    position: "absolute",
    top: 14,
    alignSelf: "center",
    backgroundColor: "rgba(15,23,42,0.55)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
    maxWidth: "88%",
  },
  tipText: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  footnote: { position: "absolute", left: 16, bottom: 18, right: 70, color: "#E2E8F0", fontSize: 12 },
  torch: {
    position: "absolute",
    right: 14,
    bottom: 14,
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  torchOn: { backgroundColor: "#FDE68A" },
  busy: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "rgba(15,23,42,0.45)" },
  busyText: { color: "#FFFFFF", fontSize: 14, fontWeight: "600" },
  ask: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6, padding: 20 },
  askIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.14)", marginBottom: 6 },
  askTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  askSub: { color: "#CBD5E1", fontSize: 13 },
});
