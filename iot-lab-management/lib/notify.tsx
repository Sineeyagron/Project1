import React, { useEffect, useState } from "react";
import { Alert, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";

// Alert.alert ของ React Native ไม่ทำงานบนเว็บ (react-native-web ทำเป็น no-op)
// และ window.alert/confirm ถูกซ่อนในบางที่ (เช่นแผง Browser ของ Claude)
// → บนเว็บใช้หน้าต่างของแอปเอง (<DialogHost /> ใน app/_layout.tsx) / มือถือใช้ Alert ปกติ

type DialogButton = { text: string; style?: "cancel" | "destructive" | "default"; onPress?: () => void };
type Dialog = { title: string; message?: string; buttons: DialogButton[] };

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
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    gap: 8,
  },
  title: { fontSize: 17, fontWeight: "900", color: "#0f172a" },
  message: { fontSize: 13.5, lineHeight: 20, color: "#475569" },
  row: { flexDirection: "row", gap: 10, marginTop: 10 },
  btn: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  btnPrimary: { backgroundColor: "#7c3aed" },
  btnDanger: { backgroundColor: "#ef4444" },
  btnCancel: { backgroundColor: "#f1f5f9" },
  btnText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  btnTextCancel: { color: "#475569" },
});
