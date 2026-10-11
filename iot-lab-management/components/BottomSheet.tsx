import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Platform, Pressable, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { useKeyboardAnimation } from "react-native-keyboard-controller";

// แผ่นเลื่อนจากล่าง ใช้ซ้ำทั้งแอป
// การเลื่อนขึ้น-ลง = แอนิเมชันของ iOS เอง (Modal animationType="slide") — ได้ 120Hz บนจอ ProMotion แม้ใน Expo Go
//   (เดิมเลื่อนด้วย Animated ของ React Native ถูกจำกัด 60Hz บน iPhone → รู้สึกหน่วงเทียบกับส่วนอื่นของเครื่อง —
//    เจ้าของโปรเจกต์เลือกแบบนี้ 11 ต.ค. 2569 + เปิด CADisableMinimumFrameDurationOnPhone ใน app.json สำหรับแอปที่ build จริง)
// ฉากเทา: อยู่ใน Modal เดียวกัน เลยเลื่อนขึ้นมาพร้อมแผ่น → เริ่มใสแล้วค่อยจางเข้าระหว่างเลื่อน ไม่เห็นเป็นแผ่นเทาเลื่อน
//   ปิด = จางฉากเทาออกก่อนนิดหนึ่ง แล้วให้ iOS เลื่อนแผ่นลง / แตะฉากเทา = ปิด
// onHidden = Modal ปิดจริงแล้ว (iOS เปิด Modal ใหม่ระหว่าง Modal เดิมยังปิดไม่จบไม่ได้ → ใช้ต่อแผ่นถัดไป)
// แป้นพิมพ์ขึ้น (iOS) → ยกทั้งแผ่นพ้นแป้น ความสูงแป้นจาก react-native-keyboard-controller (ฝั่ง native ทีละเฟรม)
//   Android: ระบบหดหน้าต่างให้เอง (adjustResize) ยกซ้ำจะลอยเกิน
const FADE_IN = 300; // ใกล้เคียงเวลาที่ iOS เลื่อนแผ่นขึ้น
const FADE_OUT = 120;

export default function BottomSheet({
  visible,
  onClose,
  onHidden,
  style,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  onHidden?: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const [shown, setShown] = useState(visible); // ค่าที่ส่งให้ Modal (ปิดช้ากว่า visible นิดหนึ่ง ให้ฉากเทาจางออกก่อน)
  const dim = useRef(new Animated.Value(0)).current;
  const wantOpen = useRef(visible);

  useEffect(() => {
    wantOpen.current = visible;
    if (visible) {
      dim.stopAnimation();
      if (shown) {
        // เปิดซ้ำระหว่างกำลังจางออก (Modal ยังอยู่) → จางกลับเข้า
        Animated.timing(dim, { toValue: 1, duration: FADE_OUT, useNativeDriver: true }).start();
      } else {
        dim.setValue(0);
        setShown(true);
        // ฉากเทาจางเข้าไปพร้อมกับที่ iOS เลื่อนแผ่นขึ้น
        Animated.timing(dim, { toValue: 1, duration: FADE_IN, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      }
    } else if (shown) {
      Animated.timing(dim, { toValue: 0, duration: FADE_OUT, easing: Easing.in(Easing.quad), useNativeDriver: true }).start(({ finished }) => {
        if (!finished || wantOpen.current) return; // เปิดใหม่ระหว่างกำลังจางออก → ห้ามปิด
        setShown(false);
        // iOS: Modal ปิดจริงตอน onDismiss (ด้านล่าง) / Android + เว็บ: ถือว่าปิดเลย
        if (Platform.OS !== "ios") onHidden?.();
      });
    }
  }, [visible]);

  const keyboard = useKeyboardAnimation(); // height = 0 → −ความสูงแป้น

  return (
    <Modal visible={shown} transparent animationType="slide" onRequestClose={onClose} onDismiss={onHidden} statusBarTranslucent>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: dim }]}>
          <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="ปิด" />
        </Animated.View>
        <Animated.View style={[s.sheet, style, Platform.OS === "ios" && { transform: [{ translateY: keyboard.height }] }]}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(15,23,42,0.38)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
