// อัปโหลดรูปอุปกรณ์ขึ้น bucket item-images → คืน public URL (ใช้ที่ admin/scan + admin/items)
import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import supabase from "./supabase";
import { ITEM_PHOTO_MAX, shrinkPhoto } from "./shrinkPhoto";

const FS = FileSystem as any;
const SUPABASE_URL = "https://enupmlxmajjwskvzgcdq.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudXBtbHhtYWpqd3NrdnpnY2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDIxMDUsImV4cCI6MjA4OTMxODEwNX0.px5ah-o_guGnQ8lTP7oJIwZXJEDiAcicuQTo3A_4aqE";

// พลาด = throw Error พร้อมข้อความ
export async function uploadItemPhoto(photoUri: string): Promise<string> {
  // ชื่อไฟล์ใช้แค่ ASCII: Storage ไม่รับ key ที่มีตัวอักษรไทย
  const fileBase = `items/${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  let fileName = "";
  // ย่อด้านยาว 1000px ก่อนอัปโหลด
  const uploadUri = await shrinkPhoto(photoUri, ITEM_PHOTO_MAX);

  if (Platform.OS === "web") {
    // เว็บ: blob:/data: URL ไม่มี uploadAsync → ผ่าน supabase-js
    const blob = await (await fetch(uploadUri)).blob();
    const ext = blob.type === "image/png" ? "png" : "jpg";
    fileName = `${fileBase}.${ext}`;
    const { error } = await supabase.storage
      .from("item-images")
      .upload(fileName, blob, { contentType: blob.type || "image/jpeg", upsert: true });
    if (error) throw new Error(error.message);
  } else {
    // มือถือ: uploadAsync (กันไฟล์ 0 ไบต์)
    const ext = uploadUri.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
    fileName = `${fileBase}.${ext}`;
    const contentType = ext === "png" ? "image/png" : "image/jpeg";
    // Storage เฉพาะ admin → ส่ง token ผู้ใช้ ไม่ใช่ anon key
    const { data: { session } } = await supabase.auth.getSession();
    const res = await FS.uploadAsync(
      `${SUPABASE_URL}/storage/v1/object/item-images/${fileName}`,
      uploadUri,
      {
        uploadType: FS.FileSystemUploadType.BINARY_CONTENT,
        mimeType: contentType,
        httpMethod: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token ?? SUPABASE_ANON}`,
          apikey: SUPABASE_ANON,
          "Content-Type": contentType,
          "x-upsert": "true",
        },
      }
    );
    if (res.status !== 200 && res.status !== 201) throw new Error(`status: ${res.status}\n${res.body}`);
  }

  return supabase.storage.from("item-images").getPublicUrl(fileName).data.publicUrl;
}
