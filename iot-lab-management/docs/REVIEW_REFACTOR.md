# Review โค้ด + Refactor (28 ต.ค. 2569)

> repo ทดลอง `refactor_test` (สำเนา main `dfc665e`) · refactor = ไม่เปลี่ยนการทำงาน/หน้าตา
> ตรวจทุกขั้นด้วย `npx tsc --noEmit` + เปิดหน้าใน Expo web ด้วยบัญชีจำลอง (375px ทุกหน้า + 1280px หน้า admin) — ไม่แตะฐานข้อมูลจริง

## สิ่งที่เจอ → ทำอะไรไป

| # | เจอ | ทำ (commit) |
|---|---|---|
| 1 | ไฟล์ที่ไม่ได้ใช้: `backend/` (Express รุ่นแรก), ไฟล์เปล่า `npm`, `.expo-codex-logs/`, `.claude/settings.local.json`, `scripts/reset-project.js`, รูป 12 ไฟล์ (~2.4 MB), `package.json` ที่ราก repo, `TODO_for_claudecode.md`, `test-qr.html`, `docs/mockups/`, README แม่แบบ Expo | ลบ · เอกสารเก่า 3 ไฟล์ย้ายไป `docs/archive/` · README ใหม่ · `.gitignore` กัน log (ขั้น 1) |
| 2 | dependency ไม่ได้ใช้: `axios`, `@react-navigation/*` 3 ตัว, `@types/estree` · `typescript`/`@types/react` ใส่ซ้ำ 2 กลุ่มคนละเวอร์ชัน | ถอด — `expo export -p web` ผ่าน (ขั้น 2) |
| 3 | import/ตัวแปรไม่ได้ใช้ 24 จุด · export ไม่มีคนเรียก 2 ตัว · แดชบอร์ด admin ยังดึง `borrow_records` ย้อนหลัง 7 วันทุกครั้งที่เปิดหน้า เพื่อทำกราฟที่ถอดออกจากหน้าไปแล้ว | ลบ — แดชบอร์ดยิงคำขอน้อยลง 1 ครั้ง/การเปิด (ขั้น 3) |
| 4 | style ไม่ได้ใช้ 161 ชื่อใน 25 ไฟล์ (ค้างจากตอนย้ายไป ScreenHeader/SearchBar/BottomSheet) | ลบ 578 บรรทัด (ขั้น 4) |
| 5 | โค้ดซ้ำ: `thaiDate` ×4, `thaiDateTime` ×2, `compareItems` ×2, `formatId` ×2, `HeroChip` ×2, `isIOS` ×2 | รวมไว้ที่ `lib/itemInfo`, `lib/people`, `components/room/HeroChip`, `lib/web/webPush` (ขั้น 5) |
| 6 | 🔴 บั๊กแฝง: `useIsDesktop() && isAdminPath(usePathname())` 4 จุด — ย่อ/ขยายหน้าต่างเว็บข้าม 1024px จำนวน hook เปลี่ยน → React error · component ประกาศใน render 6 ตัว | เพิ่ม `useIsDesktopAdmin()` ใน `lib/layout` · ย้าย component ออกนอก render (ขั้น 6) |
| 7 | `lib/` 41 ไฟล์ + `components/` 27 ไฟล์ วางแบน ระบบห้อง/ระบบยืม/ของเว็บปนกัน | `lib/room/`, `lib/web/`, `components/room/`, `components/borrow/` (ขั้น 7) |
| 8 | CLAUDE.md อ้าง path เก่า + เขียนว่า iotinspection อยู่ระบบห้อง (จริง ๆ ใช้ตาราง `items`/`item_inspections` ของระบบยืม และ `lib/term` เขียนไว้ว่าห้าม import ข้าม) · อ้าง `PLAN/REVIEW_ระบบห้อง.md` ที่ไม่มีอยู่ | แก้ให้ตรงของจริง (ขั้น 8) |

## ที่ตั้งใจไม่แตะ
- `supabase/migrations/` (ประวัติ DB จริง), `app/` (ชื่อไฟล์ = URL), `public/sw.js` (แก้แล้วต้องเปลี่ยน `VERSION` — คอมเมนต์ยังเขียน `lib/webPush` อยู่ 2 ที่)
- `currentTerm()` ที่ซ้ำใน `admin/iotinspection` — ตั้งใจแยกตามกติกาสองระบบ
- eslint อีก ~200 ข้อแนว `react-hooks/refs`, `exhaustive-deps` (ใช้ Animated ref แบบ RN ปกติ) — ไม่ใช่บั๊ก แก้แล้วเสี่ยงพฤติกรรมเปลี่ยน
- เวอร์ชัน patch ของ expo ที่ `expo-doctor` บอกว่าเก่า (6 ตัว) — เป็นแบบนี้อยู่แล้ว อัปเกรดควรทำแยก

## ตรวจตามกติกา CLAUDE.md ทุกไฟล์ใน app/ components/ lib/ (หลัง refactor)
| กติกา | ผล |
|---|---|
| ห้าม `Alert.alert` (ใช้ lib/notify) | ✅ ไม่มี (มีแค่ตัวสำรองใน lib/notify เอง) |
| `<Modal>` ต้องมี `<DialogHost />` | ✅ ครบทุกไฟล์ |
| ห้ามประกอบชื่อ Ionicons ด้วยการต่อ string | ✅ ไม่มี |
| ห้าม `router.replace` เป็นปุ่มย้อน | ✅ ไม่มี (`AdminShell` ใช้กับเมนูซ้าย ไม่ใช่ปุ่มย้อน) |
| `currentUser()` แทน `auth.getUser()` | ✅ เหลือที่เดียวใน login หลังล็อกอิน Google (ตั้งใจถามเซิร์ฟเวอร์ครั้งเดียว) |
| แผ่นล่างห้ามมี ScrollView แนวตั้งซ้อน | ✅ ที่เจอใน repairs/stations เป็นแนวนอน |
| import ข้ามระบบ | ✅ ไม่มี นอกจาก `home.tsx` (หน้ารวม) · เดิม `admin/roomreports` ใช้ `useRealtime` ของระบบยืม → **แก้แล้ว (ภายหลัง)**: ย้ายตัวจัดการช่องไป `lib/broadcast.ts` (ใช้ร่วม) แล้วหน้าห้องเรียก `useMyNotifications()` จากที่นั่น — ห้ามเปิดช่อง `user:<id>` แยกเอง เพราะ supabase.channel คืนช่องเดิม ปิดฝั่งหนึ่งแล้วกระดิ่งอีกฝั่งหลุด |
| เขียนข้อมูลแล้วเช็กแถวด้วย `.select("id")` | ⚠️ update/delete ไม่เช็กจำนวนแถว 16 จุด: `admin/categories` 8, `admin/items` 6, `notifications` 2 (ทำเครื่องหมายอ่านแล้ว) — 2 หน้าแรกเป็นหน้า admin ล้วน (RLS ให้สิทธิ์อยู่แล้ว) จะล้มเงียบได้เฉพาะตอนข้อมูลถูกลบจากที่อื่นก่อน · insert/upsert ที่ RLS ไม่ให้จะ error เองอยู่แล้ว · **แก้แล้ว (ภายหลัง)**: `admin/categories` 6 จุด + `admin/items` 6 จุด เช็กแล้ว ได้ 0 แถว = แจ้ง "ไม่มีสิทธิ์แก้ไข หรือ…ถูกลบไปแล้ว" (ข้อความแบบเดียวกับหน้าระบบห้อง) + โหลดรายการใหม่ · ที่เหลือตั้งใจไม่เช็ก: ย้ายของตามหมวด (`items` ที่ `category_id`) — หมวดว่าง = 0 แถวเป็นปกติ / `notifications` ทำเครื่องหมายอ่านแล้ว — ไม่มีอันค้าง = 0 แถวเป็นปกติ |

## เรื่องที่ควรตัดสินใจต่อ (ยังไม่ได้ทำ)
- ไฟล์ใหญ่ (`admin/home` 934, `admin/items` 1023, `login` 877 บรรทัด) ส่วนใหญ่เป็น StyleSheet — แยกเป็น component ย่อยได้ถ้าจะทำต่อ
