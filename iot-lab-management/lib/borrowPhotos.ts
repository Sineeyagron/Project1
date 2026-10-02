import { Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import supabase, { SUPABASE_ANON_KEY, SUPABASE_URL } from "./supabase";

const FS = FileSystem as any;
const BUCKET = "borrow-photos";

// รูปหลักฐานตอนยืม/คืน: ต้องถ่ายสดจากกล้องเท่านั้น (แผน 2.4) → ทำได้แค่ในแอปมือถือ
export const canTakeLivePhoto = Platform.OS !== "web";

export async function takeLivePhoto(): Promise<string | null> {
  if (!canTakeLivePhoto) {
    throw new Error("ถ่ายรูปหลักฐานได้เฉพาะในแอปมือถือ");
  }
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== "granted") {
    throw new Error("ต้องอนุญาตให้แอปใช้กล้องก่อน");
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

  const path = `${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
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

// bucket ไม่สาธารณะ → ขอลิงก์ชั่วคราว (เจ้าของ หรือ staff เท่านั้นที่ขอได้)
export async function borrowPhotoUrl(path?: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

// ข้อความประทับบนรูป: รหัสของ + เวลาฝั่งเซิร์ฟเวอร์ (แผน 2.6: แสดงซ้อน ไม่เขียนทับไฟล์)
export function photoStamp(itemCode?: string | null, at?: string | null) {
  const when = at
    ? new Date(at).toLocaleString("th-TH", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";
  return [itemCode, when].filter(Boolean).join(" · ");
}
