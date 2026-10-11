import { useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

// ทางผ่านเนื้อหาจาก <BottomSheet> (หน้าเดิม) ไปแสดงใน route แผ่น iOS แท้ app/sheet-host.tsx
//   หน้าเดิมส่งเนื้อหาชุดล่าสุดมาทุกครั้งที่ render → ฟอร์มในแผ่นพิมพ์/กดได้สดเหมือนอยู่ในหน้าเดิม
//   แยกตาม id → เปิดแผ่นซ้อนแผ่นได้
export type SheetEntry = {
  content: ReactNode;
  style?: StyleProp<ViewStyle>;
  onClose: () => void;
  open: boolean; // false = หน้าเดิมสั่งปิดเอง (ไม่ต้องเรียก onClose ซ้ำตอนแผ่นหายไป)
};

const entries = new Map<string, SheetEntry>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => { version++; listeners.forEach((fn) => fn()); };

export function setSheet(id: string, entry: SheetEntry) {
  entries.set(id, entry);
  emit();
}
export function patchSheet(id: string, patch: Partial<SheetEntry>) {
  const e = entries.get(id);
  if (!e) return;
  entries.set(id, { ...e, ...patch });
  emit();
}
export function getSheet(id: string) {
  return entries.get(id);
}
export function dropSheet(id: string) {
  entries.delete(id);
  emit();
}

const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export function useSheetEntry(id: string) {
  useSyncExternalStore(subscribe, () => version);
  return entries.get(id);
}
