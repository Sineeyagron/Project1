import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { usePathname } from "expo-router";
import { desktopBody, useIsDesktop } from "../../lib/layout";
import { isAdminPath } from "../../lib/roles";

// จอใหญ่หน้า admin: ห่อของใต้หัวหน้า (แถบสถิติ/แท็บ/ช่องค้นหา/ปุ่มติดล่าง) ให้อยู่ในกรอบเดียวกับเนื้อหา ขอบตรงกับชื่อหน้า
// มือถือ + หน้านักศึกษา (แท่ง 480 บนคอม): ไม่ห่ออะไรเลย (Fragment) — หน้าตาเหมือนเดิมทุกพิกเซล
// bleed = paddingHorizontal ของกล่องแม่ (เหมือน ScreenHeader) ให้กรอบกว้างเท่าจอแล้วจัดกลางเหมือนหัวหน้าพอดี
// style = เพิ่มเฉพาะจอใหญ่ (เช่น gap)
export default function DesktopBox({ children, bleed = 0, style }: { children: React.ReactNode; bleed?: number; style?: StyleProp<ViewStyle> }) {
  const on = useIsDesktop() && isAdminPath(usePathname());
  if (!on) return <>{children}</>;
  return (
    <View style={bleed ? { marginHorizontal: -bleed } : null}>
      <View style={[desktopBody.wide, style]}>{children}</View>
    </View>
  );
}
