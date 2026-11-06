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
- งาน UI: mockup ให้ดูก่อน (Artifact เปิดบนมือถือได้) แล้วค่อยแก้โค้ด · ใช้ skill `ui-ux-pro-max` ถ้าเครื่องนั้นมี
- **ไม่ commit/push เองถ้าไม่สั่ง** · สั่งแล้ว = commit + เปิด PR ให้ (ข้อความไทย) · ห้าม commit ลง main · งานใหม่เปิด branch จาก origin/main
- ไม่เปิดเบราว์เซอร์/dev server ถ้าไม่สั่ง · Windows: แก้ไฟล์ด้วย Edit tool (python ใน Bash ล้มเงียบ)
- **deploy** = merge PR → เจ้าของกด **Sync fork** `parnppk/ProJect_LabHub` (Claude ถูกระบบกันไม่ให้ sync เอง) · preview branch = push ขึ้น fork → `labhub-git-<branch>-iot-lab1.vercel.app`
- **DB จริง** (โปรเจกต์ Supabase เดียว ไม่มี staging · ยังไม่มีผู้ใช้จริง เทสบนเว็บจริงได้): Claude ถูกกัน `apply_migration` / อ่านข้อมูลจริง / กดแก้ค่าตั้ง → เขียนไฟล์ migration แล้วให้เจ้าของรันใน SQL Editor · ล็อกอินบน localhost เจ้าของทำเอง (dev server ชี้ DB จริง)
- ผู้นำเสนอ = เพื่อน + น้อง (ไม่ได้เขียนโค้ด) → เอกสารสำหรับพวกเขาเขียนทีละขั้น

## จดงานทุกครั้ง (บังคับ)
หลังแก้/เพิ่มงานเสร็จทุกครั้ง ต้องอัปเดต .md ก่อนจบ:
1. กติกา/ไฟล์/ตาราง/RPC ใหม่ → เพิ่มใน `docs/rules/<เรื่อง>.md` ที่ตรงเรื่อง (แก้ของเดิม ไม่เขียนซ้ำ)
2. อัปเดตหัวข้อ "สถานะล่าสุด" ด้านล่าง (เก็บแค่ ~5 บรรทัด — ลบของเก่าที่ merge แล้วออก ประวัติดูใน git log)

## สถานะล่าสุด (อัปเดต 6 พ.ย. 2569)
- นำเสนอจบแล้ว · ทุกงานถึง PR #61 ขึ้นเว็บจริงครบ (QR แปะคอม, หน้าอุปกรณ์จัดกลุ่มตามรุ่น + รูปครบ 28 รุ่น 335 ชิ้น, แก้ code review, ประกาศถึง นศ.+TA)
- branch `docs-diagrams-update`: แผนภาพรายงาน (`docs/diagrams/`) ทำใหม่ตรงฐานข้อมูล 6 พ.ย. (24 ตาราง + ประกาศ + QR คอม, ER สัญลักษณ์ Crow's Foot สากล) รอ merge PR · วิธีทำ/สคริปต์ตรวจ = skill `report-diagrams` · งานแก้ตามผลตรวจ repo 8 ข้อ: `docs/AUDIT_FIXES.md` (ทำหลังพรี 13 พ.ย.)
- ประกาศ (`admin/announce`): สวิตช์อัตโนมัติ**เปิดอยู่** — ของใหม่ทุกวัน 08:00 · ชวนมายืมวันจันทร์ 08:00 · เทสถึงมือถือจริงผ่าน (กระดิ่ง + push + เสียง)
- เทสค้าง (`docs/TEST_ROOM_QR.md`): พิมพ์ป้าย QR ลงกระดาษจริง, สแกนกล้องจริง (N1/N4/ส่วน C), นศ. แจ้งปัญหา (N3), "ดูเพิ่ม" ประวัติเครื่อง
- ค้าง: branch protection ของ main (admin repo `Sineeyagron` ตั้งเอง: Settings → Branches · CI `tsc + lint` มีแล้ว) · ลบรูปหลักฐานยืม-คืนเก่ากว่า 1 เทอม (ไม่ด่วน)
- ตัดสินใจแล้ว: ไม่อัป Expo SDK 58 (เทสผ่านเว็บอย่างเดียว อัปแล้วเสี่ยงพัง)
