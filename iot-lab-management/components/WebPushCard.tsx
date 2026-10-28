import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Text } from "./AppText";
import { C, W } from "../lib/theme";
import { confirmAction, notify } from "../lib/notify";
import { disablePush, enablePush, getPushState, type PushState } from "../lib/web/webPush";

// การ์ด "แจ้งเตือนบนเครื่องนี้" ในหน้าแจ้งเตือน — เว็บ/PWA เท่านั้น (แอปมือถือไม่แสดง)
//   iPhone ที่ยังเปิดใน Safari → บอกวิธีเพิ่มไปยังหน้าจอโฮมก่อน (iOS รับ push ได้เฉพาะแอปหน้าจอโฮม)
export default function WebPushCard() {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS === "web") getPushState().then(setState);
  }, []);

  if (Platform.OS !== "web" || !state || state === "unsupported") return null;

  const turnOn = async () => {
    setBusy(true);
    const error = await enablePush();
    setBusy(false);
    setState(await getPushState());
    if (error) notify("เปิดการแจ้งเตือนไม่สำเร็จ", error);
  };

  const turnOff = () =>
    confirmAction("ปิดการแจ้งเตือนบนเครื่องนี้?", "ยังดูรายการได้ในหน้านี้ตามปกติ", "ปิดการแจ้งเตือน", async () => {
      setBusy(true);
      await disablePush();
      setBusy(false);
      setState(await getPushState());
    });

  if (state === "on") {
    return (
      <View style={[s.card, s.row]}>
        <View style={[s.icon, { backgroundColor: C.successBg }]}>
          <Ionicons name="notifications" size={18} color={C.successInk} />
        </View>
        <Text style={[s.title, { flex: 1 }]}>แจ้งเตือนบนเครื่องนี้เปิดอยู่</Text>
        <Pressable onPress={turnOff} disabled={busy} hitSlop={8} style={s.linkBtn} accessibilityRole="button">
          {busy ? <ActivityIndicator size="small" color={C.primary} /> : <Text style={s.link}>ปิด</Text>}
        </Pressable>
      </View>
    );
  }

  const ios = state === "ios-install";
  const denied = state === "denied";
  return (
    <View style={s.card}>
      <View style={s.row}>
        <View style={[s.icon, { backgroundColor: denied ? C.warningBg : C.primarySoft }]}>
          <Ionicons
            name={ios ? "share-outline" : denied ? "notifications-off-outline" : "notifications-outline"}
            size={18}
            color={denied ? C.warningInk : C.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{denied ? "การแจ้งเตือนถูกปิดในเบราว์เซอร์" : "รับแจ้งเตือนบนเครื่องนี้"}</Text>
          <Text style={s.body}>
            {ios
              ? "บน iPhone ต้องติดตั้งก่อน: แตะปุ่มแชร์ → \"เพิ่มไปยังหน้าจอโฮม\" แล้วเปิด LabHub จากไอคอนบนหน้าจอโฮม"
              : denied
                ? "เปิดได้ที่การตั้งค่าเว็บไซต์ของเบราว์เซอร์ (ไอคอนแม่กุญแจข้างที่อยู่เว็บ) แล้วกลับมาหน้านี้"
                : "เด้งเตือนเมื่อคำขอได้รับอนุมัติ ใกล้ครบกำหนดคืน หรือมีงานใหม่ แม้ไม่ได้เปิดแอป"}
          </Text>
        </View>
      </View>
      {state === "off" && (
        <Pressable onPress={turnOn} disabled={busy} style={({ pressed }) => [s.btn, pressed && { opacity: 0.85 }]} accessibilityRole="button">
          {busy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.btnText}>เปิดการแจ้งเตือน</Text>}
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { ...W.card, padding: 14, marginHorizontal: 16, marginBottom: 10, gap: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 14.5, fontWeight: "700", color: C.ink },
  body: { fontSize: 13, color: C.text2, lineHeight: 19, marginTop: 2 },
  btn: { ...W.primary, height: 42, alignItems: "center", justifyContent: "center" },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  linkBtn: { minWidth: 44, height: 32, alignItems: "center", justifyContent: "center" },
  link: { color: C.primary, fontSize: 14, fontWeight: "700" },
});
