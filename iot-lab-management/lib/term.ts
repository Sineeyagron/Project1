// ภาคเรียนปัจจุบัน (ปฏิทิน มข. โดยประมาณ): มิ.ย.–ต.ค. = 1 / พ.ย.–มี.ค. = 2 / เม.ย.–พ.ค. = ฤดูร้อน (3)
// ใช้ทั้งตรวจประจำเทอมของระบบยืม (iotinspection) และระบบห้อง (inspection) — เป็นแค่การคำนวณวันที่ ไม่ใช่กติการ่วม
// เดิมเขียนตายตัว "1/2568" → ผลตรวจปีนี้ไปบันทึกเป็นเทอมปีที่แล้ว
export function currentTerm(now = new Date()) {
  const m = now.getMonth() + 1;
  const be = now.getFullYear() + 543;
  if (m >= 6 && m <= 10) return `1/${be}`;
  if (m >= 11) return `2/${be}`;
  if (m <= 3) return `2/${be - 1}`;
  return `3/${be - 1}`;
}
