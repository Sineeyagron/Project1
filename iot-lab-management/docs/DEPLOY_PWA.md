# ขึ้นเว็บ LabHub เป็น PWA (Vercel) + เปิด Web Push

> สิ่งที่โค้ดทำไว้แล้ว: manifest + ไอคอน (`public/`), service worker (`public/sw.js`), `vercel.json`,
> ตาราง `push_subscriptions` + trigger (migration `20261012110000_web_push.sql` — **apply ขึ้น Supabase แล้ว**),
> Edge Function `send-push` (**deploy แล้ว** แต่ยังตอบ `not_configured` จนกว่าจะใส่ VAPID ในข้อ 2),
> การ์ด "รับแจ้งเตือนบนเครื่องนี้" ในหน้าแจ้งเตือน (แสดงเฉพาะบนเว็บ)
>
> ข้างล่างคือขั้นตอนที่ต้องทำเอง (เกี่ยวกับบัญชี/คีย์ลับ)

---

## 1. Deploy ขึ้น Vercel

1. push branch ขึ้น GitHub (ผ่าน GitHub Desktop)
2. เข้า <https://vercel.com/signup> → **Continue with GitHub**
3. **Add New… → Project** → เลือก repo `Project1` → **Import**
4. ตั้งค่าโปรเจกต์:
   - **Root Directory** → กด Edit เลือก `iot-lab-management` (สำคัญ — แอปอยู่ในโฟลเดอร์ย่อย)
   - **Framework Preset** → `Other`
   - Build Command / Output Directory / Install Command **ไม่ต้องกรอก** (อ่านจาก `vercel.json`: `npx expo export -p web` → `dist`)
   - Production Branch: ตั้งที่ Settings → Git ภายหลังได้ (ถ้าจะ deploy จาก `Addfeature` แทน `main`)
5. **Deploy** → รอ 2–4 นาที → ได้โดเมน เช่น `https://labhub-xxxx.vercel.app`

`vercel.json` จัดการให้แล้ว: ทุก path ที่ไม่มีไฟล์ → `index.html` (เปิดลิงก์ตรง/รีเฟรชหน้าไหนก็ได้), `sw.js` ไม่ถูก cache ค้าง, ไฟล์ `/_expo/static` cache ยาว

> deploy ครั้งต่อไป: แค่ push → Vercel build ใหม่เอง

## 2. สร้าง VAPID keys + ใส่ใน Supabase

VAPID = คู่กุญแจที่บริการ push (Google/Apple/Mozilla) ใช้ยืนยันว่าข้อความมาจากเรา — สร้างครั้งเดียว ใช้ตลอด

```bash
npx web-push generate-vapid-keys
```

ได้ Public Key กับ Private Key → ไปที่ Supabase Dashboard → **Edge Functions → Secrets** (หรือ Project Settings → Edge Functions) เพิ่ม 3 ค่า:

| Name | Value |
|---|---|
| `VAPID_PUBLIC_KEY` | Public Key ที่ได้ |
| `VAPID_PRIVATE_KEY` | Private Key ที่ได้ (**ห้ามใส่ในโค้ด/ห้าม commit**) |
| `VAPID_SUBJECT` | `mailto:อีเมลผู้ดูแล` เช่น `mailto:you@kkumail.com` |

ไม่ต้องใส่ Public Key ในแอป — แอปเว็บขอจาก `send-push` เอง

ตรวจ: เปิด `https://enupmlxmajjwskvzgcdq.supabase.co/functions/v1/send-push` ในเบราว์เซอร์ → ต้องได้ `{"publicKey":"..."}` (ถ้ายังได้ `not_configured` = secret ยังไม่เข้า รอ 1 นาทีแล้วลองใหม่)

> ถ้าวันหลังสร้าง VAPID ใหม่ → เครื่องที่เปิดแจ้งเตือนไว้ต้องกด "เปิดการแจ้งเตือน" ใหม่อีกครั้ง

## 3. Deploy Edge Function (เฉพาะตอนแก้โค้ด send-push)

ตอนนี้ deploy ไว้แล้ว — ทำข้อนี้เฉพาะเมื่อแก้ไฟล์ใน `supabase/functions/send-push/`

```bash
npx supabase login
```

```bash
npx supabase functions deploy send-push --project-ref enupmlxmajjwskvzgcdq --no-verify-jwt
```

ต้องมี `--no-verify-jwt` (trigger ในฐานข้อมูลเรียกโดยไม่มี token — ฟังก์ชันกันคนนอกเองด้วย id แจ้งเตือน + เวลาไม่เกิน 2 นาที)

## 4. ให้ล็อกอิน Google บนเว็บใช้ได้

Supabase Dashboard → **Authentication → URL Configuration**

- **Site URL**: `https://labhub-xxxx.vercel.app` (โดเมนจากข้อ 1)
- **Redirect URLs** → Add URL:
  - `https://labhub-xxxx.vercel.app/**`
  - (เก็บของเดิมไว้: `iotlab://**` ของแอปมือถือ, `http://localhost:8081/**` ไว้พัฒนา)

ถ้าใน Google Cloud Console ตั้ง Authorized JavaScript origins ไว้ ให้เพิ่มโดเมน Vercel ด้วย (Redirect URI ของ Google ยังเป็น `https://enupmlxmajjwskvzgcdq.supabase.co/auth/v1/callback` เหมือนเดิม ไม่ต้องแก้)

## 5. เทสบนมือถือจริง

ต้องเป็น HTTPS (โดเมน Vercel) — เปิดผ่าน IP ในวง LAN แบบ http จะไม่มี service worker/push

### iPhone (iOS 16.4 ขึ้นไป)
1. เปิดโดเมน Vercel ใน **Safari** → ล็อกอิน
2. ปุ่มแชร์ (สี่เหลี่ยมลูกศรขึ้น) → **เพิ่มไปยังหน้าจอโฮม** → เพิ่ม
3. เปิด **LabHub จากไอคอนบนหน้าจอโฮม** (ไม่ใช่จาก Safari) → ล็อกอินอีกครั้ง (คนละที่เก็บกับ Safari)
4. แถบล่าง **แจ้งเตือน** → **เปิดการแจ้งเตือน** → อนุญาต
5. ทดสอบ: ใช้อีกบัญชีทำให้เกิดแจ้งเตือน (เช่น ผู้ดูแลอนุมัติคำขอยืม) → ล็อกหน้าจอ iPhone รอแจ้งเตือนเด้ง → แตะ → เปิดหน้าแจ้งเตือน

ถ้าเปิดใน Safari เฉย ๆ การ์ดจะบอกให้ "เพิ่มไปยังหน้าจอโฮม" ก่อน (ข้อจำกัดของ iOS)

### Android (Chrome)
1. เปิดโดเมน Vercel ใน Chrome → ล็อกอิน
2. เมนู ⋮ → **ติดตั้งแอป / เพิ่มลงในหน้าจอหลัก** (ไม่ติดตั้งก็รับแจ้งเตือนได้ แต่ติดตั้งแล้วเหมือนแอปกว่า)
3. หน้า **แจ้งเตือน** → **เปิดการแจ้งเตือน** → อนุญาต
4. ทดสอบแบบเดียวกับ iPhone

### คอม (ผู้ดูแล)
Chrome/Edge: หน้าแจ้งเตือน (กระดิ่ง/เมนูซ้าย) → เปิดการแจ้งเตือน → ได้แจ้งเตือนคำขอใหม่ที่มุมจอ

### ถ้าแจ้งเตือนไม่เด้ง
- ดูผลการเรียกล่าสุด: Supabase → SQL Editor → `select status_code, content, created from net._http_response order by created desc limit 5;`
  - `503 not_configured` = ยังไม่ได้ใส่ VAPID (ข้อ 2)
  - `{"sent":0}` = แจ้งเตือนเก่าเกิน 2 นาที หรือไม่มีเครื่องลงทะเบียน
  - `{"sent":1}` แต่ไม่เด้ง = ดูการตั้งค่าแจ้งเตือนของเครื่อง/โหมดโฟกัส/ห้ามรบกวน
- Supabase → Edge Functions → send-push → Logs
- เคยกด "ไม่อนุญาต" → ต้องไปเปิดในการตั้งค่าเว็บไซต์ของเบราว์เซอร์ (iPhone: การตั้งค่า → แจ้งเตือน → LabHub)

## หมายเหตุ
- แจ้งเตือนส่งเฉพาะผู้ใช้ที่เปิดไว้อย่างน้อย 1 เครื่อง — คนอื่นไม่มีคำขอ HTTP เพิ่ม (ประหยัด Disk IO แพ็กเกจฟรี)
- ออกจากระบบบนเครื่องไหน = เครื่องนั้นเลิกรับแจ้งเตือนของบัญชีนั้น
- งานผู้ดูแล (`for_staff`) แตะแล้วไป `/admin/notifications` / เรื่องของตัวเองไป `/notifications?tab=1`
- แก้ `public/sw.js` แล้วเปลี่ยน `VERSION` ในไฟล์ → cache เก่าถูกล้างเอง
