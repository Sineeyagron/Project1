import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

// ย่อรูปก่อนอัปโหลด: ด้านยาวสุดไม่เกิน maxSide พิกเซล + บีบเป็น JPEG
//   รูปจากกล้องมือถือ 1–4 พันพิกเซล (200–500 KB) แต่แอปแสดงแค่ 56–84 จุด / เต็มจอตอนกดขยาย
//   → ไฟล์เล็กลงหลายเท่า: อัปโหลด/โหลดเร็วขึ้น, ประหยัดพื้นที่ Supabase, มือถือถอดรหัสรูปเร็วขึ้น (แผ่นไม่สะดุด)
// ย่อไม่สำเร็จ (เช่นไฟล์แปลก) → คืนรูปเดิม ไม่ให้การบันทึกล้มเพราะเรื่องรูป
export async function shrinkPhoto(uri: string, maxSide: number, quality = 0.7): Promise<string> {
  try {
    const original = await ImageManipulator.manipulate(uri).renderAsync();
    let image = original;
    if (Math.max(original.width, original.height) > maxSide) {
      const ctx = ImageManipulator.manipulate(original);
      ctx.resize(original.width >= original.height ? { width: maxSide } : { height: maxSide });
      image = await ctx.renderAsync();
    }
    const saved = await image.saveAsync({ compress: quality, format: SaveFormat.JPEG });
    return saved.uri;
  } catch {
    return uri;
  }
}

// ขนาดที่ใช้ในแอป
export const ITEM_PHOTO_MAX = 1000; // รูปอุปกรณ์: การ์ด/แผ่นรายละเอียด + กดขยายเต็มจอ
export const EVIDENCE_PHOTO_MAX = 1600; // รูปหลักฐานยืม-คืน: ต้องเห็นรอย/ตำหนิชัดพอตอนผู้ดูแลตรวจ
