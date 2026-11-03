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

## สถานะล่าสุด (อัปเดต 3 พ.ย. 2569)
- นำเสนอจบแล้ว · งานแก้สุดท้าย **QR แปะคอม** ขึ้นเว็บจริงครบ (PR #46 #48 #50: สแกนดูสถานะ/แจ้งเสีย, ป้าย QR 3 ขนาด, สรุป PDF) · เทสบนเว็บจริงผ่าน 3 พ.ย. (นศ. 3 รอบ + admin 3 รอบ, ตัวเลขสรุป PDF ตรง DB)
  - เทสค้าง (`docs/TEST_ROOM_QR.md`): **พิมพ์ป้ายลงกระดาษจริง**, ปุ่ม "ดูเพิ่ม" (ยังไม่มีเครื่องประวัติเกิน 3), นศ. แจ้งปัญหา (N3), สแกนกล้องจริง (N1/N4/ส่วน C) · iPhone สแกนด้วยกล้อง = เปิด Safari เสมอ (ข้อจำกัด iOS ไม่ใช่บั๊ก)
- **หน้าอุปกรณ์ admin จัดกลุ่มตามรุ่น** ขึ้นเว็บจริงแล้ว: จอคอม = ตาราง (PR #52) · มือถือ = การ์ดละรุ่น (PR #53) · ⋮ รุ่น = ปริ้นป้าย QR ทั้งรุ่น / เปลี่ยนรูปทั้งรุ่น · เทสบนเว็บจริงผ่าน 3 พ.ย.
  - 2 พ.ย. เพิ่มอุปกรณ์จาก PDF ห้อง 9604 ลง DB 106 ชิ้น (ตอนนี้รวม 28 รุ่น 335 ชิ้น) · **ยังไม่มีรูปหลายรุ่น** — เจ้าของใส่ผ่าน "เปลี่ยนรูปทั้งรุ่น" (รูปเตรียมไว้ที่ `Downloads\LabHub รูปอุปกรณ์\` บนเครื่องเจ้าของ) · Claude อัปรูปเข้า Storage เองไม่ได้
- deploy: merge PR ที่ Project1 → **Sync fork** `parnppk/ProJect_LabHub` (เจ้าของกดเอง หรือสั่ง Claude: `gh repo sync parnppk/ProJect_LabHub --branch main --source Sineeyagron/Project1`) = ขึ้นเว็บจริง · push branch ขึ้น fork = preview `labhub-git-<branch>-iot-lab1.vercel.app` (ล็อกอิน Vercel ก่อน)
- ค้าง: ตั้ง branch protection ของ main (CI tsc+lint มีแล้ว PR #47) · Expo Go iPhone เป็น SDK 58 แต่โปรเจกต์ SDK 57 → เทสมือถือผ่านเว็บ/preview · ลบรูปหลักฐานยืม-คืนเก่ากว่า 1 เทอม (ไม่ด่วน)
