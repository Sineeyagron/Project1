import React, { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Path, RadialGradient, Rect, Stop } from "react-native-svg";
import { Text } from "./AppText";

// หน้ากำลังโหลด (แอปมือถือ): น้องขวดทดลอง + ออร่า + "รอสักครู่นะ" + แถบโหลด — หน้าตาเดียวกับเว็บ (LoadingState.web.tsx)
// ให้เบา: ภาพนิ่ง (react-native-svg) + ขยับเฉพาะ transform/opacity ผ่าน native driver (ไม่กิน JS)
//   ลอยขึ้นลง · ออร่าหายใจ · แถบวิ่ง — น้ำกระเพื่อม/ฟอง/ประกายวิบวับมีเฉพาะเว็บ (บน native ต้องวาด SVG ใหม่ทุกเฟรม)
//   โหลดเสร็จใน 0.3 วิ = ไม่แสดง · เครื่องตั้ง "ลดการเคลื่อนไหว" = ภาพนิ่ง

type Props = { style?: StyleProp<ViewStyle>; text?: string };

const SHOW_AFTER = 300;
const FLASK =
  "M43 26h18v22.5c0 1.6.5 3.2 1.4 4.6l17.4 27.2c3.8 6.1-.5 13.7-7.6 13.7H31.8c-7.1 0-11.4-7.6-7.6-13.7l17.4-27.2c.9-1.4 1.4-3 1.4-4.6z";

function loop(value: Animated.Value, duration: number, easing = Easing.inOut(Easing.sin)) {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: duration / 2, easing, useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: duration / 2, easing, useNativeDriver: true }),
    ]),
  );
}

export default function LoadingState({ style, text = "กำลังโหลดข้อมูล..." }: Props) {
  const [show, setShow] = useState(false);
  const bob = useRef(new Animated.Value(0)).current;
  const aura = useRef(new Animated.Value(0)).current;
  const run = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const t = setTimeout(() => setShow(true), SHOW_AFTER);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!show) return;
    let anims: Animated.CompositeAnimation[] = [];
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      anims = [
        loop(bob, 2800),
        loop(aura, 3200),
        Animated.loop(Animated.timing(run, { toValue: 1, duration: 1000, easing: Easing.bezier(0.65, 0, 0.35, 1), useNativeDriver: true })),
      ];
      anims.forEach((a) => a.start());
    });
    return () => {
      cancelled = true;
      anims.forEach((a) => a.stop());
    };
  }, [show, bob, aura, run]);

  if (!show) return <View style={[s.wrap, style]} />;

  return (
    <View style={[s.wrap, style]} accessibilityRole="progressbar" accessibilityLabel="รอสักครู่ กำลังโหลด">
      <View style={s.stage}>
        <Animated.View
          style={[s.aura, {
            opacity: aura.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
            transform: [{ scale: aura.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] }) }],
          }]}
        >
          <Svg width={168} height={168}>
            <Defs>
              <RadialGradient id="au" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#3B82F6" stopOpacity={0.42} />
                <Stop offset="0.38" stopColor="#93C5FD" stopOpacity={0.28} />
                <Stop offset="0.7" stopColor="#BFDBFE" stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id="au2" cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor="#FFFFFF" stopOpacity={1} />
                <Stop offset="0.3" stopColor="#DBEAFE" stopOpacity={0.55} />
                <Stop offset="0.5" stopColor="#DBEAFE" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Circle cx={84} cy={84} r={84} fill="url(#au)" />
            <Circle cx={84} cy={84} r={84} fill="url(#au2)" />
          </Svg>
        </Animated.View>

        <Animated.View
          style={[s.shadow, {
            opacity: bob.interpolate({ inputRange: [0, 1], outputRange: [0.14, 0.08] }),
            transform: [{ scaleX: bob.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }) }],
          }]}
        />

        <Animated.View style={[s.flask, { transform: [{ translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] }]}>
          <Svg width={114} height={132} viewBox="0 0 104 120">
            <Defs>
              <ClipPath id="lhl-flask"><Path d={FLASK} /></ClipPath>
            </Defs>
            <Path d={FLASK} fill="#fff" />
            <G clipPath="url(#lhl-flask)">
              <Path d="M2 65q10-4 20 0t20 0 20 0 20 0 20 0V102H2z" fill="#BFDBFE" />
              <Path d="M2 68q10-4.5 20 0t20 0 20 0 20 0 20 0V102H2z" fill="#2563EB" />
              <Circle cx={39} cy={86} r={2.2} fill="#fff" />
              <Circle cx={65} cy={84} r={1.7} fill="#fff" />
            </G>
            <Path d={FLASK} fill="none" stroke="#1E40AF" strokeWidth={4.5} strokeLinejoin="round" />
            <Rect x={38.5} y={19} width={27} height={8.5} rx={4.25} fill="#1E40AF" />
            <Path d="M38.5 54.5l-8 12.5" stroke="#fff" strokeWidth={3} strokeLinecap="round" />
            <G>
              <Ellipse cx={46} cy={77} rx={2.5} ry={3.1} fill="#0F172A" />
              <Ellipse cx={58} cy={77} rx={2.5} ry={3.1} fill="#0F172A" />
            </G>
            <Circle cx={46.9} cy={76} r={0.85} fill="#fff" />
            <Circle cx={58.9} cy={76} r={0.85} fill="#fff" />
            <Path d="M49.4 82.2q2.6 2.2 5.2 0" fill="none" stroke="#0F172A" strokeWidth={1.9} strokeLinecap="round" />
            <Ellipse cx={40.6} cy={81.6} rx={2.4} ry={1.4} fill="#F9A8D4" opacity={0.6} />
            <Ellipse cx={63.4} cy={81.6} rx={2.4} ry={1.4} fill="#F9A8D4" opacity={0.6} />
          </Svg>
        </Animated.View>
      </View>

      <Text style={s.t1}>รอสักครู่นะ</Text>
      <Text style={s.t2}>{text}</Text>

      <View style={s.bar}>
        <Animated.View
          style={[s.run, { transform: [{ translateX: run.interpolate({ inputRange: [0, 1], outputRange: [-66, 156] }) }] }]}
        />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", paddingTop: 8, paddingBottom: 16, minHeight: 250 },
  stage: { width: 170, height: 140 },
  aura: { position: "absolute", left: 1, top: -4, width: 168, height: 168 },
  shadow: { position: "absolute", left: 57, top: 117, width: 56, height: 8, borderRadius: 4, backgroundColor: "#1E3A8A" },
  flask: { position: "absolute", left: 28, top: 0 },
  t1: { fontSize: 17, fontWeight: "600", color: "#172033", marginTop: 10, textAlign: "center" },
  t2: { fontSize: 13, color: "#64748B", marginTop: 2, textAlign: "center" },
  bar: { width: 150, height: 5, marginTop: 16, borderRadius: 99, backgroundColor: "rgba(37,99,235,0.12)", overflow: "hidden" },
  run: { width: 60, height: 5, borderRadius: 99, backgroundColor: "#2563EB" },
});
