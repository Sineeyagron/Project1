# กติกาโค้ดทั้งแอป (UI / เว็บ / PWA)

> อ่านเมื่อแก้หน้าจอ, นำทาง, แผ่นล่าง, เว็บจอใหญ่, PWA

## จอใหญ่ (admin บนเว็บ)
- **แอปมือถือคือหลัก** · เว็บ: แท่งกว้าง 480px กลางจอ (`app/_layout`)
- **แบบจอใหญ่เฉพาะหน้า admin** (เว็บกว้าง ≥1024 — ตัดสินที่ `lib/layout.ts` ที่เดียว ห้ามเช็กเองในหน้า)
- หน้า/ชิ้นส่วนที่ต้องรู้ว่า "จอใหญ่ + อยู่ใต้ /admin" ใช้ `useIsDesktopAdmin()` ห้ามเขียน `useIsDesktop() && isAdminPath(usePathname())` (hook ถูกเรียกไม่ครบเมื่อย่อจอ)
- เมนูซ้าย `components/desktop/AdminShell` + หน้าที่ทำแล้วอยู่ใน `ADMIN_DESKTOP_READY`
  - แดชบอร์ด/กล่องคำขอ/ประวัติ = `components/desktop/*` · อุปกรณ์ = ตาราง · หน้ารายการ = `desktopGrid` 2 คอลัมน์ · หน้าที่มี 2 ส่วน = `desktopCols` · `desktopBody.wide` = กว้าง `DESKTOP_MAX`
  - หัวหน้าจอใหญ่ชิดซ้ายในกรอบเดียวกับเนื้อหา (ScreenHeader) · แถบสถิติ/แท็บ/ปุ่มติดล่างใต้หัว ห่อ `components/desktop/DesktopBox`
  - ตัวหนังสือขยายเองบนจอกว้าง (`TextScale` ใน AdminShell)
  - โทนฟ้า-ขาว: พื้นหน้า/เงาการ์ด = ตัวแปร CSS `--lh-page-bg`/`--lh-card-shadow` ใน `app/+html` (W.page/W.card อ่านบนเว็บ ไม่มีตัวแปร = ค่ามือถือเดิม)
- ไม่มีปุ่ม ← บนจอใหญ่ — ฟีเจอร์/สิทธิ์เหมือนมือถือทุกอย่าง แยกแค่ส่วนแสดงผล

## ป๊อปอัป / แผ่นล่าง
- ป๊อปอัป: `notify` / `confirmAction` / `pickOption` (lib/notify) ห้ามใช้ `Alert.alert`
- **`<Modal>` ใหม่ต้องใส่ `<DialogHost />` เป็นลูกตัวสุดท้าย** (แผ่น formSheet ที่เรียก notify ก็ต้องใส่) ไม่งั้นป๊อปอัปอยู่ใต้หน้าต่าง
- **แผ่นล่างจอทุกอันใช้ `<BottomSheet visible onClose style>`** (components/BottomSheet) = เปิดแผ่น iOS แท้ผ่าน `app/sheet-host.tsx` + `lib/sheetHost` — ห้ามทำแผ่นเองด้วย `<Modal>` (`<Modal>` ใช้ได้เฉพาะของเต็มจอ เช่น ซูมรูป) · เนื้อหาห้ามมี ScrollView แนวตั้งซ้อน · บนเว็บ = หน้าต่างกลางจอ/แผ่นล่าง
- แผ่น iOS (`presentation: "formSheet"`, `SHEET` ใน `_layout`): สูงพอดีเนื้อหาด้วย `lib/sheetFit` · **ScrollView ต้องเป็นรากของแผ่นเลย** (ห้ามห่อ View → แผ่นขาว / ห้าม padding นอก ScrollView → ตัวหนังสือตกขอบ / ห้าม ScrollView ซ้อน → ยืดทับ) ตัวอย่าง `app/equipment-sheet.tsx`

## นำทาง / session
- `lib/nav.ts`: ← = `goBack(fallback)` (ห้าม `router.replace` เป็นปุ่มย้อน) / แถบล่าง นศ. `goTab` / หน้าที่ต้องสดตอนกลับมา `useRefreshOnFocus(load)`
- user ที่ล็อกอิน: `currentUser()` (lib/session) ไม่ใช่ `auth.getUser()` (กิน Disk IO)
- `app/index.tsx` ต้องเป็น `<Redirect href="/admin/home" />` (ห้าม router.replace ใน useEffect) · router ใน `onAuthStateChange`/deep link ห่อ `setTimeout(...,0)`
- รหัสผ่าน `lib/password.ts` (8 ตัว มีตัวอักษร+ตัวเลข) · เปลี่ยนรหัส = `/reset-password` (ต้องล็อกอิน) · **ไม่มีหน้าสมัคร/ลืมรหัส** (นศ. เข้าด้วย Google ครั้งแรก = สร้างบัญชีเอง)
- จำการล็อกอิน: มือถือ AsyncStorage / เว็บ localStorage · ไม่ติ๊ก "จดจำ" = เปิดครั้งหน้าออกจากระบบ (`applyRememberLogin`)

## Build / ไลบรารี
- แป้นพิมพ์: `react-native-keyboard-controller` (`KeyboardProvider` ใน `_layout`, `KeyboardAwareScrollView`) · เว็บ `metro.config.js` สลับเป็น `lib/shims/keyboard-controller.web.tsx` — import ตัวอื่นจากไลบรารีนี้เพิ่ม ต้องเพิ่มใน shim ด้วย
- Ionicons บนเว็บ production = ฉบับย่อ (`scripts/subset-ionicons.js`) — **ห้ามประกอบชื่อไอคอนด้วยการต่อ string**
- รูปก่อนอัปโหลด: `lib/shrinkPhoto.ts` (อุปกรณ์ 1000px, หลักฐานยืม 1600px) · แสดงผลใช้ `expo-image`
- `expo-file-system`: `import * as FileSystem` แล้ว `const FS = FileSystem as any` · UI ค้าง → `npx expo start --clear`

## PWA / Web Push (เว็บเท่านั้น)
- `public/` (manifest, ไอคอน, `sw.js` — แก้แล้วเปลี่ยน `VERSION`), meta ใน `app/+html.tsx`, `lib/web/webPush.ts` (ลงทะเบียน SW ใน `_layout`), การ์ด `WebPushCard` ในหน้าแจ้งเตือน
- แถวใหม่ใน `notifications` → trigger `notifications_push` (pg_net, เฉพาะคนที่มี `push_subscriptions`) → Edge Function `send-push` (deploy `--no-verify-jwt`, VAPID ใน secrets)
- คำขอใหม่ → trigger `borrow_requests_push`/`pickup_requests_push` + นศ. ยกเลิกเอง (`cancel_pickup`, `cancel_request`) → `_push_staff()` → push ถึง admin+TA (ไม่เพิ่มในกระดิ่ง)
- ขั้นตอน deploy: `docs/DEPLOY_PWA.md`
