// กติการหัสผ่าน — ต้องตรงกับที่ตั้งใน Supabase (Authentication → Email: ยาว 8 ตัว, มีตัวอักษรและตัวเลข)
// ใช้ในหน้าสมัครสมาชิก + ตั้งรหัสใหม่ จะได้บอกผู้ใช้ก่อนส่ง ไม่ต้องรอ error ภาษาอังกฤษจากเซิร์ฟเวอร์

export const PASSWORD_MIN = 8;
export const PASSWORD_HINT = `อย่างน้อย ${PASSWORD_MIN} ตัว มีตัวอักษรและตัวเลข`;

// คืนข้อความบอกว่าผิดตรงไหน / null = ผ่าน
export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `รหัสผ่านต้องยาวอย่างน้อย ${PASSWORD_MIN} ตัว`;
  if (!/[A-Za-z]/.test(pw)) return "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษอย่างน้อย 1 ตัว";
  if (!/\d/.test(pw)) return "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว";
  return null;
}

// error จาก Supabase Auth → ภาษาไทย
export function authErrorThai(message: string) {
  if (/already registered|already been registered|already exists/i.test(message)) return "อีเมลนี้ถูกใช้สมัครไปแล้ว";
  if (/weak|password should|password must|characters/i.test(message)) return `รหัสผ่านไม่ผ่านเกณฑ์ (${PASSWORD_HINT})`;
  if (/invalid email|valid email/i.test(message)) return "รูปแบบอีเมลไม่ถูกต้อง";
  if (/rate limit|too many/i.test(message)) return "ลองบ่อยเกินไป รอสักครู่แล้วลองใหม่";
  return message;
}
