import { Alert, Platform } from "react-native";

// Alert.alert ของ React Native ไม่ทำงานบนเว็บ (react-native-web ทำเป็น no-op) ใช้ window.alert แทน
export function notify(title: string, message?: string, onClose?: () => void) {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
    onClose?.();
    return;
  }
  Alert.alert(title, message, [{ text: "โอเค", onPress: onClose }]);
}
