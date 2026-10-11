import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, LayoutChangeEvent, Modal, Platform, Pressable, StyleProp, StyleSheet, ViewStyle } from "react-native";
import { useKeyboardAnimation } from "react-native-keyboard-controller";

// แผ่นเลื่อนจากล่าง ใช้ซ้ำทั้งแอป: ฉากหลังเทา "จาง" เข้า-ออก / แผ่น "เลื่อน" ขึ้น-ลง ไปพร้อมกัน
// การเคลื่อนที่ (ปรับ 11 ต.ค. 2569 — บนมือถือเดิมรู้สึกอืด ทั้งที่ 60 fps):
//   - เริ่มจากใต้ขอบจอพอดี (เลื่อนเท่าความสูงแผ่นจริง) — เดิมเริ่มจากความสูงทั้งจอ ช่วงเร็วหมดไปตอนอยู่นอกจอ เห็นแต่ช่วงชะลอ
//   - ขึ้นด้วยสปริงแบบไม่เด้ง (เหมือนแผ่นของ iOS: ออกตัวไว แล้วค่อย ๆ เข้าที่)
//   - รอหน้าต่าง (Modal) ขึ้นจอ + รู้ความสูงแผ่นก่อนค่อยเริ่ม ไม่ให้ช่วงต้นหายไประหว่างสร้างหน้าต่าง
// ปิด = เล่นออกจนจบก่อนแล้วค่อยถอด Modal (เปิดซ้ำระหว่างกำลังปิด = เลื่อนกลับขึ้นจากตรงนั้น) / แตะฉากเทา = ปิด
// onHidden = Modal ปิดจริงแล้ว (iOS เปิด Modal ใหม่ระหว่าง Modal เดิมยังปิดไม่จบไม่ได้ → ใช้ต่อแผ่นถัดไป)
// แป้นพิมพ์ขึ้น (iOS) → ยกทั้งแผ่นพ้นแป้น ความสูงแป้นจาก react-native-keyboard-controller (ฝั่ง native ทีละเฟรม)
//   Android: ระบบหดหน้าต่างให้เอง (adjustResize) ยกซ้ำจะลอยเกิน
const OFFSCREEN = Dimensions.get("window").height; // ก่อนรู้ความสูงแผ่น: ซ่อนไว้นอกจอ
// สปริงไม่เด้ง (damping ratio ≈ 0.95) — ปรับให้ไวขึ้นตามเจ้าของโปรเจกต์ 11 ต.ค. 2569 (เดิม 360/36 ≈ 0.3 วิ → ตอนนี้ ≈ 0.25 วิ)
const SPRING = { stiffness: 480, damping: 42, mass: 1, overshootClamping: true, useNativeDriver: true } as const;

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
  const [mounted, setMounted] = useState(visible);
  const shift = useRef(new Animated.Value(OFFSCREEN)).current; // ระยะที่แผ่นเลื่อนลงจากตำแหน่งปกติ (0 = เปิดเต็ม)
  const fade = useRef(new Animated.Value(0)).current; // ฉากเทา
  const height = useRef(0); // ความสูงแผ่นจริง (onLayout)
  const presented = useRef(false); // Modal ขึ้นจอแล้ว (onShow)
  const pendingOpen = useRef(false); // สั่งเปิดแล้ว รอ Modal ขึ้นจอ + รู้ความสูง
  const wantOpen = useRef(visible); // สถานะล่าสุดที่สั่ง (กันเริ่มเลื่อนขึ้นหลังสั่งปิดไปแล้วระหว่างรอ 2 เฟรม)

  const slideIn = () => {
    pendingOpen.current = false;
    Animated.parallel([
      Animated.spring(shift, { toValue: 0, ...SPRING }),
      Animated.timing(fade, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  };
  // เริ่มได้เมื่อ Modal ขึ้นจอและรู้ความสูงแผ่นแล้ว — รอเพิ่มอีก ~2 เฟรม (34ms ตอนแผ่นยังอยู่ใต้จอ มองไม่เห็น)
  //   ให้ iOS วางเนื้อหาในแผ่น (ข้อความไทยหลายแถว) ให้เสร็จก่อน ไม่งั้นงานนี้ไปชนช่วงต้นของแอนิเมชัน = แผ่นหยุด 1 เฟรมแล้วกระโดด
  const startSoon = () => {
    pendingOpen.current = false;
    // setTimeout แทน requestAnimationFrame: rAF ไม่ทำงานตอนหน้าถูกซ่อน (เช่นแอปถูกพับ) → แผ่นจะค้างใต้จอ
    setTimeout(() => wantOpen.current && slideIn(), 34);
  };
  const tryOpen = () => {
    if (pendingOpen.current && presented.current && height.current > 0) startSoon();
  };

  useEffect(() => {
    wantOpen.current = visible;
    if (visible) {
      if (mounted && presented.current && height.current > 0) {
        slideIn(); // Modal ยังอยู่บนจอ (กำลังปิด) → เลื่อนกลับขึ้นจากตรงนั้น
        return;
      }
      pendingOpen.current = true;
      setMounted(true);
      // สำรอง: แพลตฟอร์มที่ไม่เรียก onShow → เริ่มเองเมื่อรู้ความสูงแล้ว
      const t = setTimeout(() => {
        if (pendingOpen.current && height.current > 0) startSoon();
      }, 300);
      return () => clearTimeout(t);
    } else if (mounted) {
      pendingOpen.current = false;
      Animated.parallel([
        Animated.timing(shift, { toValue: height.current || OFFSCREEN, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 0, duration: 180, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (!finished) return; // เปิดใหม่ระหว่างกำลังปิด → ห้ามถอด ไม่งั้นแผ่นหายค้าง
        presented.current = false;
        height.current = 0;
        shift.setValue(OFFSCREEN);
        setMounted(false);
        // iOS: Modal ปิดจริงตอน onDismiss (ด้านล่าง) / Android + เว็บ: ปิดทันทีที่ visible = false
        if (Platform.OS !== "ios") onHidden?.();
      });
    }
  }, [visible]);

  const onSheetLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h <= 0) return;
    const first = height.current === 0;
    height.current = h;
    // ครั้งแรกหลังสั่งเปิด: วางแผ่นไว้ใต้ขอบจอพอดี แล้วค่อยเลื่อนขึ้น
    if (first && pendingOpen.current) {
      shift.setValue(h);
      tryOpen();
    }
  };

  const keyboard = useKeyboardAnimation(); // height = 0 → −ความสูงแป้น
  const translateY = Platform.OS === "ios" ? Animated.add(shift, keyboard.height) : shift;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onShow={() => {
        presented.current = true;
        tryOpen();
      }}
      onDismiss={onHidden}
      statusBarTranslucent
    >
      <Animated.View style={[StyleSheet.absoluteFill, s.backdrop, { opacity: fade }]}>
        <Pressable style={{ flex: 1 }} onPress={onClose} accessibilityLabel="ปิด" />
      </Animated.View>
      <Animated.View onLayout={onSheetLayout} style={[s.sheet, style, { transform: [{ translateY }] }]}>
        {children}
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(15,23,42,0.38)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0 },
});
