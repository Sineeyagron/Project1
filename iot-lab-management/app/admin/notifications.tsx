// หน้าแจ้งเตือนของผู้ดูแลบนเว็บจอใหญ่ = หน้าเดิม (app/notifications.tsx) แต่อยู่ใต้ /admin → ได้เมนูซ้าย (components/desktop/AdminShell)
//   ไม่มี ?tab=1 → โหมดผู้ดูแล (งานผู้ดูแล + สิทธิ์ TA) เหมือนกดกระดิ่งจากแดชบอร์ดมือถือ
export { default } from "../notifications";
