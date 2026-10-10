import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Modal, Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";

// แผ่นเลื่อนจากล่าง ใช้ซ้ำได้: ฉากหลังเทา "จาง" เข้า-ออก / แผ่น "เลื่อน" ขึ้น-ลง ไปพร้อมกัน
// (Modal animationType="slide" เดิม: ฉากเทาเลื่อนตามแผ่น และตอนปิดลงช้ากว่า)
// ปิด = เล่นแอนิเมชันออกจนจบก่อน แล้วค่อยถอด Modal / แตะฉากเทา = ปิด
const TRAVEL = Dimensions.get("window").height;

export default function BottomSheet({
  visible,
  onClose,
  style,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(visible);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.setValue(0);
      Animated.timing(progress, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    } else if (mounted) {
      // ถอด Modal เฉพาะตอนปิดเล่นจบจริง — ถ้าเปิดใหม่ระหว่างกำลังปิด (finished = false) ต้องไม่ถอด ไม่งั้นแผ่นหายค้าง
      Animated.timing(progress, { toValue: 0, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [TRAVEL, 0] });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: progress }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="ปิด" />
      </Animated.View>
      <Animated.View style={[s.sheet, style, { transform: [{ translateY }] }]}>{children}</Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(15,23,42,0.38)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
