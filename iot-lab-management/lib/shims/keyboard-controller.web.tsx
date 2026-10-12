import { forwardRef, type ReactNode } from "react";
import { ScrollView, type ScrollViewProps } from "react-native";

// แทน react-native-keyboard-controller บนเว็บเท่านั้น (metro.config.js สลับให้ตอน build เว็บ)
//   ของจริงดึง react-native-reanimated มาด้วย (~840 KB) แต่บนเว็บไม่มีอะไรให้คุม:
//   เบราว์เซอร์มือถือเลื่อนหน้าหลบแป้นพิมพ์เอง → ใช้ ScrollView ธรรมดา
// แอปใช้แค่ KeyboardProvider + KeyboardAwareScrollView — ถ้า import ตัวอื่นเพิ่ม ต้องเพิ่มที่นี่ด้วย

export function KeyboardProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

type Props = ScrollViewProps & {
  bottomOffset?: number;
  extraKeyboardSpace?: number;
  disableScrollOnKeyboardHide?: boolean;
  enabled?: boolean;
};

export const KeyboardAwareScrollView = forwardRef<ScrollView, Props>(function KeyboardAwareScrollView(
  { bottomOffset: _b, extraKeyboardSpace: _e, disableScrollOnKeyboardHide: _d, enabled: _en, ...rest },
  ref,
) {
  return <ScrollView ref={ref} {...rest} />;
});
