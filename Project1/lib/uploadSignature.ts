// เก็บ SVG string ตรงๆ ลง DB แทนการ upload ไป Storage
// หลีกเลี่ยง RLS policy ของ Supabase Storage ทั้งหมด
export async function uploadSignature(
  svgString: string,
  prefix: "borrow" | "return",
  borrowRecordId: string
): Promise<string> {
  // คืน SVG string โดยตรง — borrowscan/returnscan จะเอาไปเก็บใน DB column
  return svgString;
}
