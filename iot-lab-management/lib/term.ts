// ภาคเรียนปัจจุบันของ "ระบบห้องคอม" (ตรวจประจำเทอม admin/inspection)
// ปฏิทิน มข. โดยประมาณ: มิ.ย.–ต.ค. = 1 / พ.ย.–มี.ค. = 2 / เม.ย.–พ.ค. = ฤดูร้อน (3)
// ระบบยืม-คืน (iotinspection) มีของตัวเอง — สองระบบแยกกันเด็ดขาด ห้าม import ข้ามกัน
// เดิมเขียนตายตัว "1/2568" → ผลตรวจปีนี้ไปบันทึกเป็นเทอมปีที่แล้ว
export function currentTerm(now = new Date()) {
  const m = now.getMonth() + 1;
  const be = now.getFullYear() + 543;
  if (m >= 6 && m <= 10) return `1/${be}`;
  if (m >= 11) return `2/${be}`;
  if (m <= 3) return `2/${be - 1}`;
  return `3/${be - 1}`;
}
