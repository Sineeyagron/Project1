import React, { useEffect, useState } from "react";
import { ActionSheetIOS, Alert, Modal, Platform, Pressable, StyleSheet, TouchableOpacity, View } from "react-native";
import { Text } from "../components/AppText";
import { W, NG } from "./theme";

// Alert.alert ของ React Native ไม่ทำงานบนเว็บ (react-native-web ทำเป็น no-op)
// และ window.alert/confirm ถูกซ่อนในบางที่ (เช่นแผง Browser ของ Claude)
// → บนเว็บใช้หน้าต่างของแอปเอง (<DialogHost /> ใน app/_layout.tsx) / มือถือใช้ Alert ปกติ

type DialogButton = { text: string; style?: "cancel" | "destructive" | "default"; onPress?: () => void };
type Dialog = { title: string; message?: string; buttons: DialogButton[]; sheet?: boolean; selected?: number };

let showDialog: ((dialog: Dialog) => void) | null = null;

function present(dialog: Dialog) {
  if (Platform.OS !== "web") {
    Alert.alert(dialog.title, dialog.message, dialog.buttons);
    return;
  }
  if (showDialog) {
    showDialog(dialog);
    return;
  }
  // ยังไม่มี DialogHost (ไม่ควรเกิด) → ใช้ของเบราว์เซอร์
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

// เมนูเลือก 1 ตัวเลือก แบบ iPhone (Action Sheet เด้งจากด้านล่าง)
// iOS: เมนูของระบบเอง / Android + เว็บ: แผ่นเมนูของแอป (DialogHost)
export function pickOption(
  title: string,
  options: string[],
  onSelect: (index: number) => void,
  selected?: number
) {
  if (Platform.OS === "ios") {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title,
        options: [...options.map((o, i) => (i === selected ? `✓ ${o}` : o)), "ยกเลิก"],
        cancelButtonIndex: options.length,
      },
      (index) => { if (index < options.length) onSelect(index); }
    );
    return;
  }
  const dialog: Dialog = {
    title,
    sheet: true,
    selected,
    buttons: [
      ...options.map((text, i) => ({ text, onPress: () => onSelect(i) })),
      { text: "ยกเลิก", style: "cancel" as const },
    ],
  };
  if (showDialog) showDialog(dialog);
  else Alert.alert(title, undefined, dialog.buttons.slice(0, 3));
}

export function DialogHost() {
  const [dialog, setDialog] = useState<Dialog | null>(null);

  useEffect(() => {
    showDialog = setDialog;
    return () => { showDialog = null; };
  }, []);

  if (!dialog) return null;

  const press = (button: DialogButton) => {
    setDialog(null);
    button.onPress?.();
  };

  if (dialog.sheet) {
    const options = dialog.buttons.filter((b) => b.style !== "cancel");
    const cancel = dialog.buttons.find((b) => b.style === "cancel");
    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setDialog(null)}>
        <View style={s.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDialog(null)} accessibilityLabel="ปิดเมนู" />
          <View style={s.sheetWrap}>
            <View style={s.sheetGroup}>
              <Text style={s.sheetTitle}>{dialog.title}</Text>
              {options.map((b, i) => (
                <Pressable
                  key={b.text}
                  style={({ pressed }) => [s.sheetOption, pressed && s.sheetPressed]}
                  onPress={() => press(b)}
                >
                  <Text style={[s.sheetOptionText, i === dialog.selected && s.sheetOptionSelected]}>
                    {i === dialog.selected ? `✓ ${b.text}` : b.text}
                  </Text>
                </Pressable>
              ))}
            </View>
            {cancel && (
              <Pressable
                style={({ pressed }) => [s.sheetGroup, s.sheetCancel, pressed && s.sheetPressed]}
                onPress={() => press(cancel)}
              >
                <Text style={s.sheetCancelText}>{cancel.text}</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setDialog(null)}>
      <View style={s.backdrop}>
        <View style={s.box}>
          <Text style={s.title}>{dialog.title}</Text>
          {!!dialog.message && <Text style={s.message}>{dialog.message}</Text>}
          <View style={s.row}>
            {dialog.buttons.map((b) => (
              <TouchableOpacity
                key={b.text}
                style={[s.btn, b.style === "cancel" ? s.btnCancel : b.style === "destructive" ? s.btnDanger : s.btnPrimary]}
                onPress={() => press(b)}
                activeOpacity={0.85}
              >
                <Text style={[s.btnText, b.style === "cancel" && s.btnTextCancel]}>{b.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
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
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  btnPrimary: { ...W.primarySolid },
  btnDanger: { ...NG, backgroundColor: "#ef4444" },
  btnCancel: { backgroundColor: "#f1f5f9" },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  btnTextCancel: { color: "#475569" },

  // แผ่นเมนูเลือก (หน้าตาแบบ Action Sheet ของ iOS)
  sheetBackdrop: { flex: 1, backgroundColor: "rgba(15,23,42,0.4)", justifyContent: "flex-end" },
  sheetWrap: { padding: 10, paddingBottom: 24, gap: 8, width: "100%", maxWidth: 520, alignSelf: "center" },
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
