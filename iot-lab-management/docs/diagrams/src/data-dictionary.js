// สร้างพจนานุกรมข้อมูล (Data Dictionary) เป็น Word → docs/diagrams/data-dictionary.docx
// ข้อมูลคอลัมน์ (ชนิด, null, ค่าเริ่มต้น, check, คีย์) ตรงกับฐานข้อมูลจริงใน Supabase (public schema) ณ 28 ต.ค. 2569
// คำอธิบายภาษาไทยอ้างจาก migration / โค้ดแอป · แก้ตารางในฐานข้อมูลเมื่อไหร่ ต้องแก้ข้อมูลด้านล่างด้วย
// รัน (ในโฟลเดอร์ docs/diagrams): npm install ครั้งแรกครั้งเดียว แล้ว npm run dd — ดู README.md
const fs = require("fs");
const path = require("path");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, ShadingType,
  AlignmentType, HeadingLevel, BorderStyle, PageNumber, Footer, Header, TableLayoutType,
} = require("docx");

const FONT = "TH Sarabun New";

// คอลัมน์: [ชื่อ, ชนิด, nullได้?, คีย์, ค่าเริ่มต้น, ค่าที่อนุญาต, คำอธิบาย]
// คีย์: "PK" | "FK → ตาราง.คอลัมน์" | "PK, FK → ..." | "UQ" | "" · ค่าเริ่มต้น/ค่าที่อนุญาต: "" = ไม่มี
const T = (name, th, desc, cols, notes = []) => ({ name, th, desc, cols, notes });
const UUID = "สุ่ม UUID อัตโนมัติ";
const NOW = "เวลาปัจจุบัน";

const GROUPS = [
  {
    title: "ข้อมูลผู้ใช้และส่วนกลางของระบบ (ใช้ร่วมทั้งสองระบบ)",
    tables: [
      T("profiles", "ข้อมูลผู้ใช้", "ข้อมูลผู้ใช้ 1 แถวต่อ 1 บัญชี ผูกกับบัญชีเข้าสู่ระบบของ Supabase Auth (id เดียวกับ auth.users)", [
        ["id", "uuid", false, "PK", "", "", "รหัสผู้ใช้ เท่ากับรหัสบัญชีใน auth.users"],
        ["role", "text", false, "", "'user'", "user, ta, admin", "บทบาท: ผู้ใช้ทั่วไป / ผู้ช่วยผู้ดูแล (TA) / ผู้ดูแลระบบ — เปลี่ยนได้ผ่านฟังก์ชัน set_user_role เท่านั้น"],
        ["email", "text", true, "", "", "", "อีเมลของบัญชี"],
        ["full_name", "text", true, "", "", "", "ชื่อ-นามสกุล"],
        ["avatar_url", "text", true, "", "", "", "ที่อยู่รูปโปรไฟล์ (จากบัญชี Google)"],
        ["student_id", "text", true, "UQ", "", "รูปแบบ 123456789-0", "รหัสนักศึกษา ตั้งได้ครั้งเดียว ห้ามซ้ำกับคนอื่น (บุคลากรไม่มี)"],
      ], ["ดัชนีไม่ซ้ำแบบมีเงื่อนไข: student_id ห้ามซ้ำเมื่อมีค่า"]),
      T("notifications", "การแจ้งเตือน", "การแจ้งเตือนในแอปของผู้ใช้แต่ละคน (กระดิ่ง) ทั้งระบบยืม-คืนและระบบห้องคอม — แถวใหม่จะส่ง Web Push ให้ผู้รับที่เปิดรับการแจ้งเตือนไว้ (มีแถวใน push_subscriptions) อัตโนมัติ", [
        ["id", "uuid", false, "PK", UUID, "", "รหัสการแจ้งเตือน"],
        ["user_id", "uuid", false, "", "", "", "ผู้รับการแจ้งเตือน (อ้างถึง profiles.id — ไม่มี FK constraint)"],
        ["type", "text", true, "", "'borrow'", "26 ประเภท เช่น approved, declined, due_soon, overdue, warranty_soon, room_report, pickup_scheduled", "ประเภทการแจ้งเตือน ใช้เลือกไอคอนและหน้าที่จะเปิดเมื่อกด"],
        ["title", "text", false, "", "", "", "หัวข้อ"],
        ["body", "text", false, "", "", "", "ข้อความ"],
        ["item_name", "text", true, "", "", "", "ชื่ออุปกรณ์ที่เกี่ยวข้อง ณ เวลาที่แจ้ง"],
        ["read", "boolean", true, "", "false", "", "อ่านแล้วหรือยัง"],
        ["created_at", "timestamptz", true, "", NOW, "", "เวลาที่แจ้ง"],
        ["request_id", "uuid", true, "FK → borrow_requests.id", "", "", "คำขอที่เกี่ยวข้อง (ถ้ามี)"],
        ["item_id", "uuid", true, "FK → items.id", "", "", "อุปกรณ์ที่เกี่ยวข้อง (ถ้ามี)"],
        ["for_staff", "boolean", true, "", "คำนวณอัตโนมัติ", "", "เป็นการแจ้งเตือนสำหรับผู้ดูแลหรือไม่ (generated column คำนวณจาก type และ title)"],
      ]),
      T("push_subscriptions", "อุปกรณ์ที่รับ Web Push", "เครื่อง/เบราว์เซอร์ที่ผู้ใช้อนุญาตให้ส่งการแจ้งเตือนแบบ Push (เว็บแอป PWA) — เพิ่มผ่านฟังก์ชัน save_push_subscription เท่านั้น", [
        ["id", "uuid", false, "PK", UUID, "", "รหัสรายการ"],
        ["user_id", "uuid", false, "FK → auth.users.id", "", "", "เจ้าของเครื่อง"],
        ["endpoint", "text", false, "UQ", "", "", "ที่อยู่สำหรับส่ง Push ของเบราว์เซอร์ (ไม่ซ้ำกัน)"],
        ["p256dh", "text", false, "", "", "", "กุญแจสาธารณะสำหรับเข้ารหัสข้อความ Push"],
        ["auth", "text", false, "", "", "", "รหัสยืนยันตัวตนของการสมัครรับ Push"],
        ["user_agent", "text", true, "", "", "", "ข้อมูลเบราว์เซอร์/อุปกรณ์"],
        ["created_at", "timestamptz", false, "", NOW, "", "เวลาที่สมัครรับ"],
      ]),
      T("app_settings", "การตั้งค่าระบบ", "ค่าตั้งของระบบแบบ key-value ที่ผู้ดูแลระบบแก้ได้จากหน้าตั้งค่า", [
        ["key", "text", false, "PK", "", "age_replace_years, age_warn_years, allowed_email_domain, borrow_day_options, borrow_rules, max_active_borrows, pickup_expiry_hours, pickup_grace_minutes, request_expiry_minutes, warranty_warn_days", "ชื่อค่าตั้ง"],
        ["value", "jsonb", false, "", "", "", "ค่าของการตั้งค่า (เก็บแบบ JSON เช่น ตัวเลข ข้อความ หรือรายการ)"],
        ["updated_at", "timestamptz", false, "", NOW, "", "เวลาที่แก้ไขล่าสุด"],
      ]),
      T("client_errors", "บันทึกข้อผิดพลาดของแอป", "ข้อผิดพลาดที่เกิดในแอปฝั่งผู้ใช้ ส่งมาเก็บเพื่อใช้ตรวจปัญหา — เพิ่มผ่านฟังก์ชัน log_client_error เท่านั้น", [
        ["id", "uuid", false, "PK", UUID, "", "รหัสรายการ"],
        ["created_at", "timestamptz", false, "", NOW, "", "เวลาที่เกิด"],
        ["user_id", "uuid", true, "FK → auth.users.id", "", "", "ผู้ใช้ที่เจอข้อผิดพลาด (ถ้าล็อกอินอยู่)"],
        ["message", "text", false, "", "", "", "ข้อความข้อผิดพลาด"],
        ["stack", "text", true, "", "", "", "ลำดับการเรียกโค้ด (stack trace)"],
        ["url", "text", true, "", "", "", "หน้าที่เกิดข้อผิดพลาด"],
        ["platform", "text", true, "", "", "", "แพลตฟอร์ม (ios, android, web, web-pwa)"],
        ["app_version", "text", true, "", "", "", "เวอร์ชันของแอป"],
      ]),
    ],
  },
  {
    title: "ระบบยืม-คืนอุปกรณ์ IoT",
    tables: [
      T("categories", "หมวดหมู่อุปกรณ์", "หมวดหมู่สำหรับจัดกลุ่มอุปกรณ์ (หมวด \"อื่นๆ\" เป็นหมวดสำรอง ห้ามแก้ไข)", [
        ["id", "uuid", false, "PK", UUID, "", "รหัสหมวด"],
        ["name", "text", false, "UQ", "", "", "ชื่อหมวด (ห้ามซ้ำ ไม่สนตัวพิมพ์เล็ก/ใหญ่)"],
        ["sort_order", "integer", false, "", "0", "", "ลำดับการแสดงผล"],
        ["active", "boolean", false, "", "true", "", "เปิดใช้งานหรือไม่ (ปิดแล้วซ่อนจากตัวกรองและฟอร์มเพิ่มอุปกรณ์)"],
        ["created_at", "timestamptz", false, "", NOW, "", "เวลาที่สร้าง"],
      ], ["ดัชนีไม่ซ้ำ lower(name): ชื่อหมวดห้ามซ้ำโดยไม่สนตัวพิมพ์เล็ก/ใหญ่"]),
      T("borrow_locations", "จุดยืม-คืน", "สถานที่เก็บและรับ-คืนอุปกรณ์ (ปัจจุบันมี 1 จุด ชื่อ IoT Lab)", [
        ["id", "uuid", false, "PK", UUID, "", "รหัสจุดยืม-คืน"],
        ["name", "text", false, "UQ", "", "", "ชื่อสถานที่ (ห้ามซ้ำ ไม่สนตัวพิมพ์เล็ก/ใหญ่)"],
        ["active", "boolean", false, "", "true", "", "เปิดใช้งานหรือไม่"],
        ["created_at", "timestamptz", false, "", NOW, "", "เวลาที่สร้าง"],
      ], ["ดัชนีไม่ซ้ำ lower(name): ชื่อสถานที่ห้ามซ้ำโดยไม่สนตัวพิมพ์เล็ก/ใหญ่"]),
      T("items", "อุปกรณ์", "อุปกรณ์ IoT 1 แถวต่อ 1 ชิ้น — รหัสอุปกรณ์ บาร์โค้ด และจุดเก็บ ระบบออกให้เองตอนเพิ่ม (trigger items_before_insert)", [
        ["id", "uuid", false, "PK", UUID, "", "รหัสอุปกรณ์ภายในระบบ"],
        ["created_at", "timestamptz", false, "", NOW, "", "วันที่เพิ่มเข้าระบบ (ใช้คำนวณอายุอุปกรณ์)"],
        ["name", "text", true, "", "", "", "ชื่อรุ่นอุปกรณ์ เช่น DHT22 Sensor"],
        ["status", "text", true, "", "'available'", "available, reserved, borrowed, repair, retired", "สถานะ: ว่าง / รออนุมัติยืม (กันไว้ระหว่างรอผู้ดูแลอนุมัติ) / ถูกยืม / ซ่อมบำรุง / จำหน่ายแล้ว"],
        ["image_url", "text", true, "", "", "", "ที่อยู่รูปอุปกรณ์"],
        ["description", "text", true, "", "", "", "รายละเอียดอุปกรณ์"],
        ["barcode", "text", true, "UQ", "ระบบออกให้", "", "บาร์โค้ด 4 ตัวอักษร (ห้ามซ้ำ)"],
        ["type", "text", true, "", "", "", "ชื่อหมวดแบบข้อความ (คงไว้ให้ข้อมูลเก่าแสดงตรงกับ category_id)"],
        ["item_prefix", "text", true, "", "ระบบออกให้", "", "คำนำหน้ารหัสตามรุ่น เช่น DHT22"],
        ["item_no", "integer", true, "", "ระบบออกให้", "", "เลขลำดับชิ้นของรุ่นนั้น"],
        ["item_code", "text", false, "UQ", "ระบบออกให้", "", "รหัสอุปกรณ์ที่พิมพ์บนป้าย QR เช่น DHT22 012 (ห้ามซ้ำ แก้ไขไม่ได้)"],
        ["short_name", "text", true, "", "", "", "ชื่อย่อที่ใช้ออกรหัส (ไม่กรอก = ใช้ชื่อรุ่น)"],
        ["manufacturer_serial", "text", true, "", "", "", "หมายเลขซีเรียลจากผู้ผลิต"],
        ["warranty_expires_at", "date", true, "", "", "", "วันหมดประกัน"],
        ["retired_at", "timestamptz", true, "", "", "", "วันที่จำหน่ายออก"],
        ["retire_reason", "text", true, "", "", "", "เหตุผลที่จำหน่ายออก"],
        ["category_id", "uuid", true, "FK → categories.id", "", "", "หมวดหมู่"],
        ["location_id", "uuid", false, "FK → borrow_locations.id", "จุดเริ่มต้นของระบบ", "", "จุดที่เก็บอุปกรณ์"],
      ], ["ดัชนีไม่ซ้ำ: item_code ห้ามซ้ำ · barcode ห้ามซ้ำเมื่อมีค่า"]),
      T("item_code_counters", "ตัวนับรหัสอุปกรณ์", "เลขล่าสุดที่ออกไปแล้วของแต่ละคำนำหน้า ใช้ออกรหัสอุปกรณ์ไม่ให้ซ้ำ (รหัสที่ใช้แล้วไม่นำกลับมาใช้)", [
        ["prefix_key", "text", false, "PK", "", "", "คำนำหน้าแบบตัวพิมพ์เล็ก ใช้เทียบชื่อรุ่น"],
        ["display_prefix", "text", false, "", "", "", "คำนำหน้าตามตัวสะกดครั้งแรก ใช้แสดงในรหัส"],
        ["last_no", "integer", false, "", "0", "", "เลขลำดับล่าสุดที่ออกไปแล้ว"],
        ["updated_at", "timestamptz", false, "", NOW, "", "เวลาที่ออกรหัสล่าสุด"],
      ]),
      T("borrow_requests", "คำขอยืม / คืน / ยืมต่อ", "คำขอที่ผู้ใช้ส่งหลังสแกน QR รอผู้ดูแลพิจารณา — ไม่มีผู้ตอบภายในเวลาที่ตั้งไว้ คำขอยืมจะหมดอายุ คำขอคืนจะคืนอัตโนมัติ", [
        ["id", "uuid", false, "PK", UUID, "", "รหัสคำขอ"],
        ["kind", "text", false, "", "", "borrow, return, renew", "ประเภทคำขอ: ยืม / คืน / ยืมต่อ"],
        ["status", "text", false, "", "'pending'", "pending, approved, declined, expired, cancelled, auto_returned", "สถานะ: รออนุมัติ / อนุมัติ / ปฏิเสธ / หมดอายุ / ยกเลิก / คืนอัตโนมัติ"],
        ["item_id", "uuid", true, "FK → items.id", "", "", "อุปกรณ์ที่ขอ (1 ชิ้นมีคำขอรออนุมัติได้ครั้งละ 1 รายการ)"],
        ["user_id", "uuid", false, "FK → profiles.id", "", "", "ผู้ส่งคำขอ"],
        ["borrow_record_id", "uuid", true, "FK → borrow_records.id", "", "", "การยืมที่เกี่ยวข้อง (คำขอยืมที่อนุมัติแล้ว หรือการยืมที่ขอคืน/ยืมต่อ)"],
        ["location_id", "uuid", true, "FK → borrow_locations.id", "", "", "จุดรับ-คืน"],
        ["days", "integer", true, "", "", "1 – 60", "จำนวนวันที่ขอยืม / ขอยืมต่อ"],
        ["condition", "text", true, "", "", "good, damaged", "สภาพอุปกรณ์ที่ผู้ใช้ระบุ: ปกติ / ชำรุด"],
        ["condition_note", "text", true, "", "", "", "หมายเหตุสภาพ"],
        ["photo_path", "text", true, "", "", "", "ที่อยู่รูปถ่ายหลักฐาน (Storage: borrow-photos)"],
        ["created_at", "timestamptz", false, "", NOW, "", "เวลาที่ส่งคำขอ"],
        ["expires_at", "timestamptz", true, "", "", "", "เวลาที่คำขอหมดอายุ"],
        ["decided_by", "uuid", true, "FK → profiles.id", "", "", "ผู้ดูแลที่พิจารณา"],
        ["decided_at", "timestamptz", true, "", "", "", "เวลาที่พิจารณา"],
        ["decision_note", "text", true, "", "", "", "หมายเหตุจากผู้ดูแล เช่น เหตุผลที่ปฏิเสธ"],
      ], ["ดัชนีไม่ซ้ำแบบมีเงื่อนไข: item_id ไม่ซ้ำเมื่อ status = 'pending' (อุปกรณ์ 1 ชิ้นมีคำขอรออนุมัติได้ครั้งละ 1 รายการ)"]),
      T("borrow_records", "การยืม", "บันทึกการยืม 1 ครั้ง ตั้งแต่อนุมัติยืมจนคืนเสร็จ", [
        ["id", "uuid", false, "PK", UUID, "", "รหัสการยืม"],
        ["user_id", "uuid", false, "", "", "", "ผู้ยืม (อ้างถึง profiles.id — ไม่มี FK constraint)"],
        ["item_id", "uuid", true, "FK → items.id", "", "", "อุปกรณ์ที่ยืม"],
        ["borrow_date", "timestamptz", true, "", NOW, "", "เวลาที่เริ่มยืม"],
        ["return_date", "timestamptz", true, "", "", "", "เวลาที่คืน"],
        ["status", "text", true, "", "'borrowed'", "borrowed, pending_return, returned", "สถานะ: กำลังยืม / รอยืนยันคืน / คืนแล้ว"],
        ["due_date", "date", true, "", "", "", "วันครบกำหนดคืน"],
        ["borrow_signature_url", "text", true, "", "", "", "ลายเซ็นตอนยืม (คอลัมน์จากระบบรุ่นแรก ปัจจุบันไม่ใช้)"],
        ["return_signature_url", "text", true, "", "", "", "ลายเซ็นตอนคืน (คอลัมน์จากระบบรุ่นแรก ปัจจุบันไม่ใช้)"],
        ["borrow_request_id", "uuid", true, "FK → borrow_requests.id", "", "", "คำขอยืมที่ทำให้เกิดการยืมนี้"],
        ["borrow_photo_path", "text", true, "", "", "", "รูปถ่ายสภาพตอนยืม"],
        ["borrow_condition", "text", true, "", "", "good, damaged", "สภาพตอนยืม"],
        ["borrow_condition_note", "text", true, "", "", "", "หมายเหตุสภาพตอนยืม"],
        ["return_photo_path", "text", true, "", "", "", "รูปถ่ายสภาพตอนคืน"],
        ["return_condition", "text", true, "", "", "good, damaged", "สภาพตอนคืน"],
        ["return_condition_note", "text", true, "", "", "", "หมายเหตุสภาพตอนคืน"],
        ["return_checked_by", "uuid", true, "FK → profiles.id", "", "", "ผู้ดูแลที่ตรวจรับคืน"],
        ["return_checked_at", "timestamptz", true, "", "", "", "เวลาที่ตรวจรับคืน"],
        ["damage_cost", "numeric", true, "", "", "≥ 0", "ค่าเสียหาย (บาท)"],
        ["damage_note", "text", true, "", "", "", "รายละเอียดความเสียหาย"],
        ["auto_returned", "boolean", false, "", "false", "", "คืนอัตโนมัติเพราะไม่มีผู้ดูแลตรวจรับในเวลาที่กำหนดหรือไม่"],
        ["renew_count", "integer", false, "", "0", "", "จำนวนครั้งที่ยืมต่อ"],
        ["due_soon_notified_at", "timestamptz", true, "", "", "", "เวลาที่ส่งเตือนใกล้ครบกำหนด (กันส่งซ้ำ)"],
        ["overdue_notified_at", "timestamptz", true, "", "", "", "เวลาที่ส่งเตือนเกินกำหนด (กันส่งซ้ำ)"],
      ]),
      T("pickup_requests", "คำขอนัดรับอุปกรณ์", "คำขอยืมแบบนัดรับ ระบุรุ่นอุปกรณ์ (ไม่ระบุชิ้น) ผู้ดูแลนัดวัน-เวลา แล้วผู้ใช้สแกนรับชิ้นจริงตามนัด", [
        ["id", "uuid", false, "PK", UUID, "", "รหัสคำขอนัดรับ"],
        ["user_id", "uuid", false, "FK → profiles.id", "", "", "ผู้ขอนัดรับ"],
        ["item_prefix", "text", false, "", "", "", "รุ่นอุปกรณ์ที่ขอ (คำนำหน้ารหัส)"],
        ["location_id", "uuid", true, "FK → borrow_locations.id", "", "", "จุดนัดรับ"],
        ["days", "integer", false, "", "", "", "จำนวนวันที่ขอยืม"],
        ["note", "text", true, "", "", "", "หมายเหตุจากผู้ขอ"],
        ["status", "text", false, "", "'pending'", "pending, scheduled, picked_up, declined, expired, cancelled, no_show", "สถานะ: รอผู้ดูแลนัดเวลา / นัดแล้ว / รับของแล้ว / ถูกปฏิเสธ / หมดอายุ / ยกเลิกแล้ว / ไม่มาตามนัด"],
        ["pickup_at", "timestamptz", true, "", "", "", "วัน-เวลานัดรับ"],
        ["scheduled_by", "uuid", true, "FK → profiles.id", "", "", "ผู้ดูแลที่นัดเวลา"],
        ["decided_at", "timestamptz", true, "", "", "", "เวลาที่ผู้ดูแลตอบคำขอ"],
        ["decision_note", "text", true, "", "", "", "หมายเหตุจากผู้ดูแล"],
        ["picked_item_id", "uuid", true, "FK → items.id", "", "", "ชิ้นอุปกรณ์ที่รับไปจริง"],
        ["borrow_record_id", "uuid", true, "FK → borrow_records.id", "", "", "การยืมที่เกิดจากการรับตามนัด"],
        ["created_at", "timestamptz", false, "", NOW, "", "เวลาที่ส่งคำขอ"],
        ["expires_at", "timestamptz", false, "", "เวลาปัจจุบัน + 12 ชั่วโมง", "", "เวลาที่คำขอหมดอายุถ้ายังไม่มีผู้ดูแลนัด"],
      ]),
      T("item_inspections", "ผลตรวจสภาพอุปกรณ์ประจำภาคเรียน", "ผลการตรวจสภาพอุปกรณ์ IoT แต่ละชิ้นในแต่ละภาคเรียน", [
        ["id", "uuid", false, "PK", UUID, "", "รหัสผลตรวจ"],
        ["term", "text", false, "", "", "", "ภาคเรียน เช่น 2569/1"],
        ["item_id", "uuid", true, "FK → items.id", "", "", "อุปกรณ์ที่ตรวจ"],
        ["condition", "text", true, "", "'good'", "good, damaged, missing", "ผลตรวจ: ปกติ / ชำรุด / สูญหาย"],
        ["notes", "text", true, "", "", "", "หมายเหตุ"],
        ["inspector_id", "uuid", true, "FK → profiles.id", "", "", "ผู้ตรวจ"],
        ["inspected_at", "timestamptz", true, "", NOW, "", "เวลาที่ตรวจ"],
      ], ["ข้อจำกัดไม่ซ้ำ (item_id, term): อุปกรณ์ 1 ชิ้นมีผลตรวจได้ 1 รายการต่อภาคเรียน"]),
      T("item_alerts", "ประวัติการเตือนประกันและอายุอุปกรณ์", "บันทึกว่าส่งการเตือนเรื่องใดของอุปกรณ์ชิ้นใดไปแล้ว เพื่อไม่ให้ส่งซ้ำ", [
        ["item_id", "uuid", false, "PK, FK → items.id", "", "", "อุปกรณ์ที่เตือน"],
        ["kind", "text", false, "PK", "", "warranty_soon, warranty_expired, age_warn, age_replace", "เรื่องที่เตือน: ประกันใกล้หมด / ประกันหมด / อายุถึงเกณฑ์เฝ้าระวัง / อายุถึงเกณฑ์ควรเปลี่ยน"],
        ["alert_key", "text", false, "PK", "", "", "ตัวแยกครั้งการเตือน: วันหมดประกัน (เรื่องประกัน) หรือเกณฑ์ปี (เรื่องอายุ)"],
        ["sent_at", "timestamptz", false, "", NOW, "", "เวลาที่ส่งการเตือน"],
      ]),
      T("staff_presence", "ผู้ดูแลที่อยู่ห้อง", "ผู้ดูแล/TA ที่เช็กอินว่าอยู่ห้องตอนนี้ (1 แถวต่อคน ลบเมื่อเช็กเอาท์ และระบบเช็กเอาท์ให้อัตโนมัติ 17:00)", [
        ["user_id", "uuid", false, "PK, FK → profiles.id", "", "", "ผู้ดูแลที่เช็กอิน"],
        ["location_id", "uuid", true, "FK → borrow_locations.id", "", "", "จุดที่อยู่"],
        ["checked_in_at", "timestamptz", false, "", NOW, "", "เวลาที่เช็กอิน"],
      ]),
    ],
  },
  {
    title: "ระบบห้องคอมพิวเตอร์",
    tables: [
      T("rooms", "ห้อง", "ห้องคอมพิวเตอร์ที่ระบบดูแล", [
        ["id", "text", false, "PK", "", "ตัวพิมพ์ใหญ่ ตัวเลข และ - ยาว 2–20 ตัว", "รหัสห้อง เช่น CP9524"],
        ["building", "text", false, "", "'' (ว่าง)", "", "อาคาร"],
        ["floor", "text", true, "", "", "", "ชั้น"],
        ["sort_order", "integer", false, "", "0", "", "ลำดับการแสดงผล"],
        ["active", "boolean", false, "", "true", "", "เปิดใช้งานหรือไม่"],
        ["created_at", "timestamptz", false, "", NOW, "", "เวลาที่สร้าง"],
      ]),
      T("computer_stations", "เครื่องคอมพิวเตอร์", "เครื่องคอมพิวเตอร์ในห้อง แบ่งเป็นกลุ่ม (group_no) เช่น กลุ่ม 1 เครื่อง C1–C9", [
        ["id", "uuid", false, "PK", UUID, "", "รหัสเครื่อง"],
        ["room_id", "text", false, "FK → rooms.id", "", "", "ห้องที่ตั้ง"],
        ["name", "text", false, "", "", "", "ชื่อเครื่อง เช่น C1 (ห้ามซ้ำในกลุ่มเดียวกัน)"],
        ["group_no", "integer", false, "", "", "", "หมายเลขกลุ่มในห้อง"],
        ["status", "text", false, "", "'available'", "available, repair, broken", "สถานะ: ใช้งานได้ / กำลังซ่อม / เสีย"],
        ["created_at", "timestamptz", true, "", NOW, "", "เวลาที่เพิ่ม"],
        ["active", "boolean", false, "", "true", "", "ใช้งานอยู่หรือไม่ (เครื่องที่มีประวัติลบไม่ได้ ให้ปิดใช้งานแทน)"],
      ], ["ดัชนีไม่ซ้ำ (room_id, group_no, lower(name)): ชื่อเครื่องห้ามซ้ำในกลุ่มเดียวกัน"]),
      T("lan_ports", "LAN port", "ช่องเสียบสาย LAN ของแต่ละกลุ่ม (กลุ่มละ 12 port)", [
        ["id", "uuid", false, "PK", UUID, "", "รหัส port"],
        ["room_id", "text", false, "FK → rooms.id", "", "", "ห้องที่ตั้ง"],
        ["group_no", "integer", false, "", "", "", "หมายเลขกลุ่ม"],
        ["port_no", "integer", false, "", "", "1 – 12", "หมายเลข port"],
        ["label", "text", true, "", "", "", "ชื่อเรียกเพิ่มเติม"],
        ["status", "text", false, "", "'available'", "available, repair, broken", "สถานะ: ใช้งานได้ / กำลังซ่อม / เสีย"],
        ["created_at", "timestamptz", true, "", NOW, "", "เวลาที่เพิ่ม"],
      ], ["ข้อจำกัดไม่ซ้ำ (room_id, group_no, port_no): หมายเลข port ห้ามซ้ำในกลุ่มเดียวกัน"]),
      T("station_equipment", "อุปกรณ์ประจำเครื่อง", "เช็กลิสต์อุปกรณ์ต่อพ่วงของแต่ละเครื่อง (เมาส์ คีย์บอร์ด จอ)", [
        ["id", "uuid", false, "PK", UUID, "", "รหัสรายการ"],
        ["station_id", "uuid", false, "FK → computer_stations.id", "", "", "เครื่องที่อุปกรณ์อยู่"],
        ["equipment_type", "text", false, "", "", "mouse, keyboard, monitor", "ชนิดอุปกรณ์: เมาส์ / คีย์บอร์ด / จอ"],
        ["status", "text", false, "", "'present'", "present, missing, broken", "สถานะ: ครบ / หาย / ชำรุด"],
        ["updated_at", "timestamptz", true, "", NOW, "", "เวลาที่อัปเดตล่าสุด"],
        ["updated_by", "uuid", true, "FK → profiles.id", "", "", "ผู้อัปเดตล่าสุด"],
      ], ["ข้อจำกัดไม่ซ้ำ (station_id, equipment_type): เครื่องละ 1 รายการต่อชนิดอุปกรณ์"]),
      T("equipment_inspections", "ผลตรวจเครื่องคอมพิวเตอร์ประจำภาคเรียน", "ผลตรวจอุปกรณ์ประจำเครื่องในแต่ละภาคเรียน — บันทึกผลแล้วระบบอัปเดตเช็กลิสต์ (station_equipment) ให้อัตโนมัติ", [
        ["id", "uuid", false, "PK", UUID, "", "รหัสผลตรวจ"],
        ["term", "text", false, "", "", "", "ภาคเรียน เช่น 2569/1"],
        ["station_id", "uuid", true, "FK → computer_stations.id", "", "", "เครื่องที่ตรวจ"],
        ["inspector_id", "uuid", true, "FK → profiles.id", "", "", "ผู้ตรวจ"],
        ["equipment_type", "text", true, "", "", "mouse, keyboard, monitor", "ชนิดอุปกรณ์ที่ตรวจ"],
        ["condition", "text", false, "", "'good'", "good, damaged, missing", "ผลตรวจ: ปกติ / ชำรุด / สูญหาย"],
        ["notes", "text", true, "", "", "", "หมายเหตุ"],
        ["last_borrower_id", "uuid", true, "FK → profiles.id", "", "", "ผู้ใช้เครื่องคนล่าสุด (ถ้าทราบ)"],
        ["inspected_at", "timestamptz", true, "", NOW, "", "เวลาที่ตรวจ"],
      ], ["ข้อจำกัดไม่ซ้ำ (station_id, equipment_type, term): อุปกรณ์แต่ละชนิดของเครื่องตรวจได้ 1 ครั้งต่อภาคเรียน"]),
      T("repair_records", "งานซ่อม", "งานซ่อมเครื่องคอมพิวเตอร์ — เปิดงานแล้วเครื่องเป็นสถานะซ่อม ปิดงานแล้วกลับเป็นใช้งานได้ (สถานะงานย้อนกลับไม่ได้)", [
        ["id", "uuid", false, "PK", UUID, "", "รหัสงานซ่อม"],
        ["station_id", "uuid", true, "FK → computer_stations.id", "", "", "เครื่องที่ซ่อม"],
        ["description", "text", true, "", "", "", "อาการเสีย"],
        ["status", "text", false, "", "'pending'", "pending, in-repair, done", "สถานะ: รอซ่อม / กำลังซ่อม / ซ่อมเสร็จแล้ว"],
        ["reported_by", "uuid", true, "FK → profiles.id", "", "", "ผู้แจ้งซ่อม"],
        ["repaired_by", "uuid", true, "FK → profiles.id", "", "", "ผู้ซ่อม"],
        ["reported_at", "timestamptz", true, "", NOW, "", "เวลาที่แจ้งซ่อม"],
        ["repaired_at", "timestamptz", true, "", "", "", "เวลาที่ซ่อมเสร็จ"],
        ["notes", "text", true, "", "", "", "บันทึกการซ่อม"],
      ]),
      T("room_reports", "คำแจ้งปัญหาห้อง", "ปัญหาที่ผู้ใช้แจ้งเกี่ยวกับเครื่องหรือ LAN port รอผู้ดูแลรับเรื่องหรือปิดเรื่อง (ผู้ใช้แจ้งได้ไม่เกิน 5 ครั้งต่อวัน)", [
        ["id", "uuid", false, "PK", UUID, "", "รหัสคำแจ้ง"],
        ["kind", "text", false, "", "", "station, lan", "แจ้งเรื่อง: เครื่องคอมพิวเตอร์ / LAN port"],
        ["station_id", "uuid", true, "FK → computer_stations.id", "", "", "เครื่องที่แจ้ง (กรณีแจ้งเครื่อง)"],
        ["lan_port_id", "uuid", true, "FK → lan_ports.id", "", "", "port ที่แจ้ง (กรณีแจ้ง LAN)"],
        ["room_id", "text", false, "FK → rooms.id", "", "", "ห้องที่แจ้ง"],
        ["label", "text", false, "", "", "", "ชื่อตำแหน่งที่แจ้ง เช่น กลุ่ม 1 C9 / กลุ่ม 1 Port 5"],
        ["description", "text", false, "", "", "ยาว 3 – 500 ตัวอักษร", "รายละเอียดปัญหา"],
        ["status", "text", false, "", "'open'", "open, accepted, closed", "สถานะ: รอตรวจ / รับเป็นงานซ่อม / ปิดแล้ว"],
        ["reported_by", "uuid", false, "FK → profiles.id", "", "", "ผู้แจ้ง"],
        ["reported_at", "timestamptz", false, "", NOW, "", "เวลาที่แจ้ง"],
        ["handled_by", "uuid", true, "FK → profiles.id", "", "", "ผู้ดูแลที่พิจารณา"],
        ["handled_at", "timestamptz", true, "", "", "", "เวลาที่พิจารณา"],
        ["handle_note", "text", true, "", "", "", "หมายเหตุจากผู้ดูแล"],
        ["repair_id", "uuid", true, "FK → repair_records.id", "", "", "งานซ่อมที่เปิดจากคำแจ้งนี้ (ถ้ามี)"],
      ]),
      T("room_status_log", "ประวัติการเปลี่ยนสถานะ", "ประวัติการเปลี่ยนสถานะเครื่องและ LAN port ระบบบันทึกเองทุกครั้งที่สถานะเปลี่ยน (trigger)", [
        ["id", "bigint", false, "PK", "เลขลำดับอัตโนมัติ", "", "รหัสรายการ"],
        ["kind", "text", false, "", "", "station, lan", "ประเภท: เครื่องคอมพิวเตอร์ / LAN port"],
        ["station_id", "uuid", true, "FK → computer_stations.id", "", "", "เครื่องที่เปลี่ยนสถานะ"],
        ["lan_port_id", "uuid", true, "FK → lan_ports.id", "", "", "port ที่เปลี่ยนสถานะ"],
        ["room_id", "text", false, "", "", "", "ห้อง (อ้างถึง rooms.id — ไม่มี FK constraint)"],
        ["label", "text", false, "", "", "", "ชื่อตำแหน่ง ณ เวลานั้น"],
        ["from_status", "text", true, "", "", "", "สถานะเดิม"],
        ["to_status", "text", false, "", "", "", "สถานะใหม่"],
        ["source", "text", false, "", "'manual'", "manual, repair", "ที่มา: ผู้ดูแลเปลี่ยนเอง / มาจากงานซ่อม"],
        ["changed_by", "uuid", true, "FK → profiles.id", "", "", "ผู้เปลี่ยนสถานะ"],
        ["changed_at", "timestamptz", false, "", NOW, "", "เวลาที่เปลี่ยน"],
      ]),
    ],
  },
];

// ───────────── สร้างเอกสาร ─────────────
const W = [1850, 1100, 1750, 600, 3006]; // ชื่อ | ชนิด | คีย์ | Null | คำอธิบาย = 8306 (A4 ขอบซ้าย 1.5" ขวา 1")
const TABLE_W = W.reduce((a, b) => a + b, 0);
const BLUE = "1F4E9C", HEAD_BG = "DCE6F5", ZEBRA = "F5F8FD", LINE = "9DB2D6";
const border = { style: BorderStyle.SINGLE, size: 4, color: LINE };
const borders = { top: border, bottom: border, left: border, right: border };

const run = (text, o = {}) => new TextRun({ text, font: FONT, size: o.size || 28, bold: o.bold, italics: o.italics, color: o.color });
const para = (children, o = {}) => new Paragraph({ children: Array.isArray(children) ? children : [children], spacing: { before: o.before || 0, after: o.after || 0, line: o.line || 240 }, alignment: o.align, keepNext: o.keepNext, heading: o.heading });

function cell(content, width, o = {}) {
  const paras = (Array.isArray(content) ? content : [content]).map((c) => (c instanceof Paragraph ? c : para(run(c, { size: 26, bold: o.bold }), { align: o.align })));
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders,
    shading: o.fill ? { fill: o.fill, type: ShadingType.CLEAR, color: "auto" } : undefined,
    margins: { top: 40, bottom: 40, left: 90, right: 90 },
    children: paras,
  });
}

function descCell(col, width, fill) {
  const [, , , , def, allowed, desc] = col;
  const ps = [para(run(desc, { size: 26 }))];
  if (allowed) ps.push(para([run("ค่าที่ใช้ได้: ", { size: 24, bold: true, color: "444444" }), run(allowed, { size: 24, color: "444444" })]));
  if (def) ps.push(para([run("ค่าเริ่มต้น: ", { size: 24, bold: true, color: "444444" }), run(def, { size: 24, color: "444444" })]));
  return cell(ps, width, { fill });
}

function dataTable(t) {
  const header = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: ["ชื่อคอลัมน์", "ชนิดข้อมูล", "คีย์", "Null", "คำอธิบาย"].map((h, i) => cell(h, W[i], { bold: true, fill: HEAD_BG, align: i === 3 ? AlignmentType.CENTER : undefined })),
  });
  const rows = t.cols.map((c, i) => {
    const fill = i % 2 ? ZEBRA : undefined;
    return new TableRow({
      cantSplit: true,
      children: [
        cell(c[0], W[0], { fill, bold: c[3].startsWith("PK") }),
        cell(c[1], W[1], { fill }),
        cell(c[3] || "–", W[2], { fill }),
        cell(c[2] ? "ได้" : "ไม่ได้", W[3], { fill, align: AlignmentType.CENTER }),
        descCell(c, W[4], fill),
      ],
    });
  });
  return new Table({ width: { size: TABLE_W, type: WidthType.DXA }, columnWidths: W, layout: TableLayoutType.FIXED, rows: [header, ...rows] });
}

const children = [];
children.push(para(run("พจนานุกรมข้อมูล (Data Dictionary)", { size: 40, bold: true, color: BLUE }), { align: AlignmentType.CENTER, after: 80, heading: HeadingLevel.TITLE }));
children.push(para(run("ระบบ LabHub — ระบบจัดการห้องปฏิบัติการ IoT มหาวิทยาลัยขอนแก่น", { size: 30 }), { align: AlignmentType.CENTER, after: 240 }));
const total = GROUPS.reduce((n, g) => n + g.tables.length, 0);
for (const line of [
  `ฐานข้อมูล PostgreSQL บน Supabase (schema public) จำนวน ${total} ตาราง แบ่งเป็น 3 กลุ่มตามระบบ ข้อมูลชนิด คีย์ ค่า Null ค่าเริ่มต้น และค่าที่ใช้ได้ ตรงกับโครงสร้างฐานข้อมูลจริง ณ วันที่ 28 ตุลาคม 2569`,
  "คำอธิบายสัญลักษณ์: PK = คีย์หลัก (Primary Key) · FK → ตาราง.คอลัมน์ = คีย์นอก (Foreign Key) อ้างถึงตารางนั้น · UQ = ค่าห้ามซ้ำ (Unique) · Null \"ได้\" = เว้นว่างได้",
  "ชนิดข้อมูล: uuid = รหัสสุ่มไม่ซ้ำ 128 บิต · text = ข้อความ · integer / bigint = จำนวนเต็ม · numeric = ตัวเลขทศนิยม · boolean = จริง/เท็จ · date = วันที่ · timestamptz = วันและเวลาพร้อมเขตเวลา · jsonb = ข้อมูลรูปแบบ JSON",
]) children.push(para(run(line), { after: 120, line: 276 }));

let n = 0;
for (const [gi, g] of GROUPS.entries()) {
  children.push(para(run(`${gi + 1}. ${g.title}`, { size: 34, bold: true, color: BLUE }), { before: 360, after: 160, heading: HeadingLevel.HEADING_1, keepNext: true }));
  for (const t of g.tables) {
    n++;
    children.push(para([run(`ตารางที่ ${n}  `, { bold: true }), run(t.name, { bold: true, color: BLUE }), run(`  ${t.th}`, { bold: true })], { before: 240, after: 60, heading: HeadingLevel.HEADING_2, keepNext: true }));
    children.push(para(run(t.desc), { after: 100, keepNext: true, line: 276 }));
    children.push(dataTable(t));
    for (const note of t.notes) children.push(para([run("หมายเหตุ: ", { size: 26, bold: true }), run(note, { size: 26 })], { before: 60 }));
  }
}

const doc = new Document({
  creator: "LabHub",
  title: "พจนานุกรมข้อมูล LabHub",
  styles: {
    default: { document: { run: { font: FONT, size: 28 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 34, bold: true, color: BLUE }, paragraph: { outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { font: FONT, size: 28, bold: true }, paragraph: { outlineLevel: 1 } },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1440, bottom: 1440, left: 2160, right: 1440 } } },
    headers: { default: new Header({ children: [para(run("พจนานุกรมข้อมูล — LabHub", { size: 22, color: "888888" }), { align: AlignmentType.RIGHT })] }) },
    footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 24 })] })] }) },
    children,
  }],
});

const out = path.join(__dirname, "..", "data-dictionary.docx");
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf);
  // ส่งออกข้อมูลไว้ให้สคริปต์ตรวจเทียบกับฐานข้อมูล
  fs.writeFileSync(path.join(__dirname, "data-dictionary.json"), JSON.stringify(GROUPS.flatMap((g) => g.tables.map((t) => ({ name: t.name, cols: t.cols.map((c) => ({ col: c[0], type: c[1], nul: c[2], key: c[3] })) }))), null, 1));
  console.log(`ok: ${total} ตาราง ${GROUPS.reduce((s, g) => s + g.tables.reduce((x, t) => x + t.cols.length, 0), 0)} คอลัมน์ → ${out}`);
});
