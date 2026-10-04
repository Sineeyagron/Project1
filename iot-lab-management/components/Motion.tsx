import React, { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";

// ลูกเล่นมือถือเบา ๆ ใช้ซ้ำได้ทุกหน้า — Animated แบบ native driver ไม่กระทบการโหลดข้อมูล

// สั่นเบา ๆ (มือถือเท่านั้น — เว็บไม่มี)
export function haptic(kind: "light" | "success" = "light") {
  if (Platform.OS === "web") return;
  if (kind === "success") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  else Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ปุ่มที่กดแล้วยุบนิดหนึ่ง + สั่นเบา ๆ (ใช้แทน TouchableOpacity)
export function PressScale({
  style,
  onPress,
  scaleTo = 0.96,
  children,
  ...rest
}: Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle>; scaleTo?: number; children?: React.ReactNode }) {
  const scale = useRef(new Animated.Value(1)).current;
  const to = (v: number) => Animated.spring(scale, { toValue: v, speed: 40, bounciness: 6, useNativeDriver: true }).start();
  return (
    <AnimatedPressable
      {...rest}
      style={[style as any, { transform: [{ scale }] }]}
      onPressIn={() => to(scaleTo)}
      onPressOut={() => to(1)}
      onPress={(e) => {
        haptic("light");
        onPress?.(e);
      }}
    >
      {children}
    </AnimatedPressable>
  );
}

// ค่อย ๆ จางเข้า + ลอยขึ้นตอนแสดงครั้งแรก (delay = ไล่ลำดับทีละส่วน)
export function FadeIn({ delay = 0, style, children }: { delay?: number; style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 280, delay, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

// วงชีพจรรอบตัวเลข/ป้าย — ใช้เรียกสายตาเมื่อมีงานรอ (วนเรื่อย ๆ จนกว่าจะถอดออก)
export function Pulse({ color, size, style }: { color: string; size: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
        { opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }] },
      ]}
    />
  );
}
