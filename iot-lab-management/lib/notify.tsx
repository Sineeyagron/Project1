import React, { useEffect, useReducer, useRef } from "react";
import { Alert, Animated, BackHandler, Easing, Keyboard, Platform, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "../components/AppText";
import { W, NG } from "./theme";

// ป๊อปอัปแจ้งเตือน/ยืนยัน/เมนูเลือกของทั้งแอป — หน้าตาของแอปเองทุกแพลตฟอร์ม (ไม่ใช้ Alert ของ iOS/Android)
//   เจ้าของโปรเจกต์ขอ 11 ต.ค. 2569: ป๊อปอัปต้องเป็นดีไซน์ของแอป ไม่ใช่หน้าต่างมาตรฐานของ iPhone
//
// วาดเป็นชั้นบนสุดของ "ที่ที่กำลังเปิดอยู่" (ไม่ใช้ <Modal> ซ้อน — iOS เปิดหน้าต่างซ้อนบนหน้าต่างอื่นไม่ได้):
//   - <DialogHost /> ใน app/_layout.tsx = ชั้นของทั้งแอป
//   - <DialogHost /> ใส่ไว้ในทุก <Modal> / แผ่น formSheet ด้วย — เปิดอยู่ = ป๊อปอัปขึ้นบนหน้าต่างนั้น
//   ตัวที่เปิดล่าสุดรับป๊อปอัป / หน้าต่างปิดทั้งที่ป๊อปอัปยังค้าง → ส่งต่อให้ชั้นข้างล่าง (ไม่หาย)
//   ⚠️ เพิ่ม <Modal> ใหม่ในแอป ต้องใส่ <DialogHost /> เป็นลูกตัวสุดท้ายข้างในด้วย ไม่งั้นป๊อปอัปจะไปอยู่ใต้หน้าต่าง

type DialogButton = { text: string; style?: "cancel" | "destructive" | "default"; onPress?: () => void };
type Dialog = { title: string; message?: string; buttons: DialogButton[]; sheet?: boolean; selected?: number };
type Host = { queue: Dialog[]; refresh: () => void };

const hosts: Host[] = [];

function present(dialog: Dialog) {
  const top = hosts[hosts.length - 1];
  if (top) {
    Keyboard.dismiss(); // แป้นพิมพ์บังปุ่มของป๊อปอัป
    top.queue.push(dialog);
    top.refresh();
    return;
  }
  // ยังไม่มี DialogHost (ไม่ควรเกิด) → ของระบบ
  if (Platform.OS !== "web") {
    Alert.alert(dialog.title, dialog.message, dialog.buttons);
    return;
  }
  const text = dialog.message ? `${dialog.title}\n\n${dialog.message}` : dialog.title;
  const confirm = dialog.buttons.find((b) => b.style !== "cancel");
  if (dialog.buttons.length > 1) {
    if (window.confirm(text)) confirm?.onPress?.();
  } else {
    window.alert(text);
    confirm?.onPress?.();
  }
}

export function notify(title: string, message?: string, onClose?: () => void) {
  present({ title, message, buttons: [{ text: "โอเค", onPress: onClose }] });
}

// ถามยืนยันก่อนทำ (ปุ่มยกเลิก + ปุ่มยืนยัน)
export function confirmAction(
  title: string,
  message: string,
  confirmText: string,
  onConfirm: () => void,
  destructive = false
) {
  present({
    title,
    message,
    buttons: [
      { text: "ยกเลิก", style: "cancel" },
      { text: confirmText, style: destructive ? "destructive" : "default", onPress: onConfirm },
    ],
  });
}

// เมนูเลือก 1 ตัวเลือก (แผ่นเมนูเลื่อนขึ้นจากด้านล่าง)
export function pickOption(
  title: string,
  options: string[],
  onSelect: (index: number) => void,
  selected?: number
) {
  present({
    title,
    sheet: true,
    selected,
    buttons: [
      ...options.map((text, i) => ({ text, onPress: () => onSelect(i) })),
      { text: "ยกเลิก", style: "cancel" as const },
    ],
  });
}

export function DialogHost() {
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const host = useRef<Host>({ queue: [], refresh }).current;

  useEffect(() => {
    hosts.push(host);
    return () => {
      hosts.splice(hosts.indexOf(host), 1);
      // หน้าต่างปิดไปทั้งที่ยังมีป๊อปอัป (เช่น ปิดหน้าต่างแล้ว notify ทันที) → ย้ายไปชั้นข้างล่าง
      const left = host.queue.splice(0);
      const below = hosts[hosts.length - 1];
      if (left.length && below) {
        below.queue.push(...left);
        below.refresh();
      }
    };
  }, []);

  const dialog = host.queue[0];

  // ปุ่มย้อนกลับของ Android = ยกเลิก (หรือปิด ถ้ามีปุ่มเดียว)
  useEffect(() => {
    if (!dialog || Platform.OS !== "android") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      close(dialog.buttons.find((b) => b.style === "cancel") || (dialog.buttons.length === 1 ? dialog.buttons[0] : undefined));
      return true;
    });
    return () => sub.remove();
  }, [dialog]);

  if (!dialog) return null;

  // ปิดป๊อปอัปก่อน แล้วค่อยทำตามปุ่ม (ปุ่มอาจเปิดป๊อปอัปถัดไปต่อ)
  const close = (button?: DialogButton) => {
    if (host.queue[0] !== dialog) return; // กดซ้ำเร็ว ๆ
    host.queue.shift();
    refresh();
    button?.onPress?.();
  };

  return dialog.sheet ? (
    <SheetView key={host.queue.length + dialog.title} dialog={dialog} onPress={close} />
  ) : (
    <BoxView key={host.queue.length + dialog.title} dialog={dialog} onPress={close} />
  );
}

// เฟดฉากหลัง + กล่องขยายขึ้นนิด ๆ (native driver ลื่นบนมือถือ)
function useAppear() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== "web" }).start();
  }, []);
  return v;
}

function BoxView({ dialog, onPress }: { dialog: Dialog; onPress: (b?: DialogButton) => void }) {
  const v = useAppear();
  return (
    <Animated.View style={[s.layer, s.center, { opacity: v }]} accessibilityViewIsModal>
      <View style={s.dim} />
      <Animated.View style={[s.box, { transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}>
        <Text style={s.title}>{dialog.title}</Text>
        {!!dialog.message && <Text style={s.message}>{dialog.message}</Text>}
        <View style={s.row}>
          {dialog.buttons.map((b) => (
            <TouchableOpacity
              key={b.text}
              style={[s.btn, b.style === "cancel" ? s.btnCancel : b.style === "destructive" ? s.btnDanger : s.btnPrimary]}
              onPress={() => onPress(b)}
              activeOpacity={0.85}
            >
              <Text style={[s.btnText, b.style === "cancel" && s.btnTextCancel]}>{b.text}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Animated.View>
    </Animated.View>
  );
}

function SheetView({ dialog, onPress }: { dialog: Dialog; onPress: (b?: DialogButton) => void }) {
  const v = useAppear();
  const options = dialog.buttons.filter((b) => b.style !== "cancel");
  const cancel = dialog.buttons.find((b) => b.style === "cancel");
  return (
    <Animated.View style={[s.layer, s.bottom, { opacity: v }]} accessibilityViewIsModal>
      <Pressable style={s.dim} onPress={() => onPress(cancel)} accessibilityLabel="ปิดเมนู" />
      <Animated.View style={[s.sheetWrap, { transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [60, 0] }) }] }]}>
        <View style={s.sheetGroup}>
          <Text style={s.sheetTitle}>{dialog.title}</Text>
          {options.map((b, i) => (
            <Pressable key={b.text} style={({ pressed }) => [s.sheetOption, pressed && s.sheetPressed]} onPress={() => onPress(b)}>
              <Text style={[s.sheetOptionText, i === dialog.selected && s.sheetOptionSelected]}>
                {i === dialog.selected ? `✓ ${b.text}` : b.text}
              </Text>
            </Pressable>
          ))}
        </View>
        {cancel && (
          <Pressable style={({ pressed }) => [s.sheetGroup, s.sheetCancel, pressed && s.sheetPressed]} onPress={() => onPress(cancel)}>
            <Text style={s.sheetCancelText}>{cancel.text}</Text>
          </Pressable>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  // ชั้นเต็มจอเหนือทุกอย่างในหน้าต่างนั้น
  layer: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 1000, elevation: 1000 },
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  bottom: { justifyContent: "flex-end" },
  dim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(15,23,42,0.45)" },
  box: {
    ...W.card,
    width: "100%",
    maxWidth: 380,
    padding: 20,
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: "900", color: "#172033" },
  message: { fontSize: 13.5, lineHeight: 20, color: "#475569" },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  btnPrimary: { ...W.primarySolid },
  btnDanger: { ...NG, backgroundColor: "#ef4444" },
  btnCancel: { backgroundColor: "#f1f5f9" },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "800", textAlign: "center" },
  btnTextCancel: { color: "#475569" },

  // แผ่นเมนูเลือก
  sheetWrap: { padding: 10, paddingBottom: 28, gap: 8, width: "100%", maxWidth: 520, alignSelf: "center" },
  sheetGroup: { ...W.card, overflow: "hidden" },
  sheetTitle: {
    textAlign: "center",
    fontSize: 13,
    color: "#64748b",
    fontWeight: "700",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DCE6F5",
  },
  sheetOption: {
    paddingVertical: 16,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#DCE6F5",
  },
  sheetPressed: { backgroundColor: "#f1f5f9" },
  sheetOptionText: { fontSize: 17, color: "#2563eb", fontWeight: "500" },
  sheetOptionSelected: { fontWeight: "800" },
  sheetCancel: { paddingVertical: 16, alignItems: "center" },
  sheetCancelText: { fontSize: 17, color: "#2563eb", fontWeight: "800" },
});
