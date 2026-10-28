import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import supabase, { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";
import { EVIDENCE_PHOTO_MAX, shrinkPhoto } from "./shrinkPhoto";

const FS = FileSystem as any;
const BUCKET = "borrow-photos";

// รูปหลักฐานตอนยืม/คืน: ต้องถ่ายสดจากกล้องเท่านั้น (แผน 2.4)
//   แอปมือถือ = กล้อง / เว็บบนมือถือ (PWA) = <input capture> เปิดกล้องตรงๆ (expo-image-picker บนเว็บ)
//   เว็บบนคอม = ปิด (กล่องเลือกไฟล์ = ส่งรูปเก่าได้ ผิดกติกาถ่ายสด)
const isPhoneBrowser = () =>
  Platform.OS === "web" &&
  typeof navigator !== "undefined" &&
  (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints || 0) > 1);
export const canTakeLivePhoto = Platform.OS !== "web" || isPhoneBrowser();

export async function takeLivePhoto(): Promise<string | null> {
  if (!canTakeLivePhoto) {
    throw new Error("ถ่ายรูปหลักฐานได้เฉพาะบนมือถือ");
  }
  // เว็บ: เบราว์เซอร์ถามสิทธิ์กล้องเองตอนเปิดกล้อง
  if (Platform.OS !== "web") {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      throw new Error("ต้องอนุญาตให้แอปใช้กล้องก่อน");
    }
  }
  const result = await ImagePicker.launchCameraAsync({
    quality: 0.6,
    allowsEditing: false,
    exif: false,
  });
  return result.canceled ? null : result.assets[0].uri;
}

// อัปโหลดลง borrow-photos/<user_id>/... (policy อนุญาตเฉพาะโฟลเดอร์ของตัวเอง)
// คืน path ไปส่งให้ RPC (request_borrow / request_return)
export async function uploadBorrowPhoto(uri: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("กรุณาเข้าสู่ระบบ");
  // ย่อเหลือด้านยาว 1600px ก่อนส่ง (ยังเห็นรอย/ตำหนิชัด แต่ไฟล์เล็กลงหลายเท่า ส่งคำขอเร็วขึ้น)
  uri = await shrinkPhoto(uri, EVIDENCE_PHOTO_MAX, 0.75);

  const path = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
  // เว็บ: รูปเป็น blob:/data: URL และไม่มี FileSystem.uploadAsync → อัปโหลดผ่าน supabase-js (แบบเดียวกับ admin/scan)
  if (Platform.OS === "web") {
    const blob = await (await fetch(uri)).blob();
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
    if (error) throw new Error(`อัปโหลดรูปไม่สำเร็จ (${error.message})`);
    return path;
  }
  const res = await FS.uploadAsync(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, uri, {
    uploadType: FS.FileSystemUploadType.BINARY_CONTENT,
    httpMethod: "POST",
    mimeType: "image/jpeg",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "image/jpeg",
    },
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`อัปโหลดรูปไม่สำเร็จ (${res.status})`);
  }
  return path;
}

// ข้อความประทับบนรูป: รหัสของ + เวลาฝั่งเซิร์ฟเวอร์ (แผน 2.6: แสดงซ้อน ไม่เขียนทับไฟล์)
export function photoStamp(itemCode?: string | null, at?: string | null) {
  const when = at
    ? new Date(at).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
  return [itemCode, when].filter(Boolean).join(" · ");
}
