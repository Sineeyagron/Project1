# 📱 LabHub (IoT Lab Management App)

> ไฟล์นี้โหลดทุก session — เก็บให้สั้น · รายละเอียดอยู่ใน `docs/rules/` อ่านเฉพาะเรื่องที่กำลังแก้

## หลัก
- **Stack**: React Native + Expo (expo-router) + Supabase (Auth/DB/Storage/Realtime) + TypeScript · เว็บจริง labhub-kku.vercel.app · ผู้ใช้ = นศ./อาจารย์ห้องแล็บ IoT มข.
- **UI**: `docs/DESIGN.md` เท่านั้น (ฟ้า #2563EB, `lib/theme.ts`) · **ทำ mockup ให้เจ้าของดูก่อน** แล้วค่อยแก้โค้ด
- **Role**: `profiles.role` = `user | ta | admin`
- **ระบบห้องคอม แยกจากระบบยืม-คืนเด็ดขาด** — งานฝั่งหนึ่งห้ามแก้หรือ import ของอีกฝั่ง
- **โฟลเดอร์**: `lib/room/` + `components/room/` = ห้องคอม · `components/borrow/` + ราก `lib/` = ยืม-คืน · `lib/web/` = เฉพาะเว็บ · ราก `components/` = ใช้ร่วม · `app/` ห้ามย้าย (ชื่อไฟล์ = URL) · `home.tsx` มีทั้งการ์ดห้องและการ์ดยืม

## กติกาสั้นที่ต้องจำเสมอ
- ป๊อปอัป `notify`/`confirmAction`/`pickOption` (ห้าม `Alert.alert`) · แผ่นล่าง `<BottomSheet>` (ห้ามทำเองด้วย `<Modal>`)
- ← = `goBack(fallback)` · user = `currentUser()` (ไม่ใช่ `auth.getUser()`)
- จอใหญ่เฉพาะหน้า admin ตัดสินที่ `lib/layout.ts` (`useIsDesktopAdmin()`)
- ห้ามต่อ string ชื่อไอคอน Ionicons · ตาราง/หน้าใหม่ต้องเขียน RLS policy ในไฟล์ migration เดียวกัน

## อ่านเพิ่มตามงาน (`docs/rules/`)
| งาน | ไฟล์ |
|---|---|
| หน้าจอ, นำทาง, แผ่นล่าง, จอใหญ่ admin, PWA/push, build | `docs/rules/app.md` |
| SQL, RLS, Storage, Realtime, cron, ล็อกอิน Google | `docs/rules/supabase.md` |
| ระบบยืม-คืน (F1–F4, TA, หน้า admin) | `docs/rules/borrow.md` |
| ระบบห้องคอม (R0–R3) | `docs/rules/room.md` |
| deploy PWA / ตั้ง admin / ดูแลระบบ | `docs/DEPLOY_PWA.md`, `docs/ADMIN_SETUP.md`, `docs/MAINTENANCE.md` |

## วิธีทำงานกับเจ้าของ (ใช้ได้ทุกเครื่อง)
- ตอบภาษาไทยเสมอ สั้น ประหยัด token · ทำช้าแต่รอบคอบ เช็ก edge case เองก่อนส่ง
- งาน UI ทุกอย่าง: ใช้ skill `ui-ux-pro-max` + ทำ mockup HTML ให้ดูก่อนแก้โค้ด
- **ไม่ commit/push เองถ้าไม่สั่ง** — เจ้าของ commit ผ่าน GitHub Desktop → ให้ข้อความ Summary (บรรทัดเดียว) + Description (bullet) ภาษาไทย
- branch: ใช้ branch ปัจจุบันต่อ · เปิดใหม่จาก origin/main เฉพาะเมื่อ branch เดิม merge แล้ว · ห้าม commit ลง main
- ไม่เปิดเบราว์เซอร์/dev server ถ้าไม่สั่ง · Windows: แก้ไฟล์ด้วย Edit tool (python ใน Bash ล้มเงียบ)
- ผู้นำเสนอ = เพื่อน + น้อง (ไม่ได้เขียนโค้ด) → เอกสารสำหรับพวกเขาเขียนทีละขั้น

## จดงานทุกครั้ง (บังคับ)
หลังแก้/เพิ่มงานเสร็จทุกครั้ง ต้องอัปเดต .md ก่อนจบ:
1. กติกา/ไฟล์/ตาราง/RPC ใหม่ → เพิ่มใน `docs/rules/<เรื่อง>.md` ที่ตรงเรื่อง (แก้ของเดิม ไม่เขียนซ้ำ)
2. อัปเดตหัวข้อ "สถานะล่าสุด" ด้านล่าง (เก็บแค่ ~5 บรรทัด — ลบของเก่าที่ merge แล้วออก ประวัติดูใน git log)

## สถานะล่าสุด (อัปเดต 2 พ.ย. 2569)
- นำเสนอโปรเจกต์จบแล้ว · อาจารย์ขอเพิ่ม (งานแก้สุดท้าย): **QR แปะคอมแต่ละเครื่อง** → สแกนดูสถานะ + แจ้งเสีย, ป้าย QR คอม, สรุปห้องคอม PDF
- QR คอม: **ขึ้นเว็บจริงแล้ว** (PR #46 + #48 การ์ดสแกนย้ายไปลิงก์ด่วน + #50 ป้าย QR เลือกขนาด เล็ก/ปกติ/ใหญ่) · เทสผ่าน: ผู้ดูแลสแกนแล้วเห็นเส้นเวลาประวัติ, นศ. ดูอย่างเดียว (แม้ใส่ `from=admin` เอง), ลิงก์เครื่องที่ไม่มี = "ไม่พบเครื่องนี้", นศ. เข้า `admin/room` ไม่ได้ · ป้าย QR ทุกห้องจริง × 3 ขนาด: ไม่ล้นกรอบ, จำนวนแผ่นตรง, ถอด QR ป้ายเล็กได้ครบ (จำลองบนเครื่อง)
  - เทสค้าง (`docs/TEST_ROOM_QR.md`): **พิมพ์ป้ายลงกระดาษจริง** (วัดขนาดที่สเกล 100% + สแกนระยะจริง), ปุ่ม "ดูเพิ่ม" (ยังไม่มีเครื่องประวัติเกิน 3), นศ. แจ้งปัญหา (N3), สแกนกล้องจริง/QR ผิดประเภท (N1/N4), กล้องมือถือธรรมดา → ล็อกอิน → กลับเครื่องเดิม (ส่วน C)
  - iPhone: สแกนด้วยกล้อง = เปิด Safari เสมอ (ไม่เข้าแอปบนหน้าจอโฮม, ล็อกอินแยก) — ข้อจำกัด iOS ไม่ใช่บั๊ก · ติดตั้งแอปแล้วให้ใช้การ์ดสแกนในแอป
- deploy: Vercel ต่อกับ fork `parnppk/ProJect_LabHub` → merge PR ที่ Project1 แล้ว **Sync fork** = ขึ้นเว็บจริง · push branch อื่นขึ้น fork = preview (`labhub-git-<branch>-iot-lab1.vercel.app` ต้องล็อกอิน Vercel, ล็อกอิน Google อาจเด้งไปเว็บจริง)
- CI (GitHub Actions: tsc + lint) merge แล้ว (PR #47) · ค้าง: เจ้าของตั้ง branch protection ของ main เอง (ดู `docs/rules/app.md` หัวข้อ Build)
- Expo Go บน iPhone เป็น SDK 58 แล้ว โปรเจกต์ยัง SDK 57 → เทสบนมือถือผ่านเว็บ/preview แทน · อัปเกรด SDK = งานแยก ไม่ด่วน
- น้องเพิ่มอุปกรณ์เองในแอป (ไม่ทำ CSV)
- ค้าง (ไม่ด่วน): ลบรูปหลักฐานยืม-คืนที่เก่ากว่า 1 เทอม กัน storage ฟรี 1 GB เต็ม (ตอนนี้ใช้ ~43 MB)
