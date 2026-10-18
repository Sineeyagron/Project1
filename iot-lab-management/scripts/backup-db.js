#!/usr/bin/env node
// สำรองข้อมูล LabHub ทุกตารางลงเครื่อง (JSON + CSV) — Supabase แพ็กเกจฟรีไม่มีระบบกู้คืนให้ ต้องเก็บเอง
// วิธีใช้ดู docs/MAINTENANCE.md · ต้องใช้ service role key (Dashboard → Project Settings → API) — ห้าม commit key
//   PowerShell:  $env:SUPABASE_URL="https://xxxx.supabase.co"; $env:SUPABASE_SERVICE_ROLE_KEY="..."; node scripts/backup-db.js
//   bash:        SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-db.js
// ผลลัพธ์: backups/<วันที่_เวลา>/<ตาราง>.json + .csv (+ _summary.json) — โฟลเดอร์ backups/ อยู่ใน .gitignore
// อ่านอย่างเดียว ไม่แก้ข้อมูลในฐานข้อมูล

const fs = require("fs");
const path = require("path");

const URL_BASE = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL_BASE || !KEY) {
  console.error("ต้องตั้ง SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ก่อน (ดู docs/MAINTENANCE.md)");
  process.exit(1);
}

// ตาราง: [ชื่อ, คอลัมน์เรียง (primary key)]
// ไม่สำรอง: push_subscriptions (เครื่องสมัครใหม่เองได้ + มีกุญแจเข้ารหัสของเครื่อง), client_errors (log ชั่วคราว)
const TABLES = [
  ["app_settings", "key"],
  ["profiles", "id"],
  ["categories", "id"],
  ["borrow_locations", "id"],
  ["item_code_counters", "prefix_key"],
  ["items", "id"],
  ["item_alerts", "item_id,kind,alert_key"],
  ["item_inspections", "id"],
  ["borrow_requests", "id"],
  ["borrow_records", "id"],
  ["pickup_requests", "id"],
  ["notifications", "id"],
  ["staff_presence", "user_id"],
  ["rooms", "id"],
  ["computer_stations", "id"],
  ["lan_ports", "id"],
  ["station_equipment", "id"],
  ["equipment_inspections", "id"],
  ["repair_records", "id"],
  ["room_reports", "id"],
  ["room_status_log", "id"],
];

const PAGE = 1000;

async function fetchAll(table, order) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const orderBy = order.split(",").map((c) => `${c}.asc`).join(",");
    const res = await fetch(`${URL_BASE}/rest/v1/${table}?select=*&order=${orderBy}`, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Range: `${from}-${from + PAGE - 1}`,
        "Range-Unit": "items",
      },
    });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < PAGE) return rows;
  }
}

function toCsv(rows) {
  if (rows.length === 0) return "";
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const cell = (v) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [cols.join(","), ...rows.map((r) => cols.map((c) => cell(r[c])).join(","))].join("\r\n");
}

(async () => {
  // ชื่อโฟลเดอร์ตามเวลาเครื่อง (ไทย) เช่น 2026-10-19_0615
  const d = new Date();
  const p2 = (n) => String(n).padStart(2, "0");
  const stamp = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}`;
  const dir = path.join(__dirname, "..", "backups", stamp);
  fs.mkdirSync(dir, { recursive: true });
  const summary = { created_at: new Date().toISOString(), project: URL_BASE, tables: {} };
  let failed = 0;

  for (const [table, order] of TABLES) {
    try {
      const rows = await fetchAll(table, order);
      fs.writeFileSync(path.join(dir, `${table}.json`), JSON.stringify(rows, null, 2));
      fs.writeFileSync(path.join(dir, `${table}.csv`), toCsv(rows));
      summary.tables[table] = rows.length;
      console.log(`✓ ${table.padEnd(22)} ${rows.length} แถว`);
    } catch (e) {
      failed += 1;
      summary.tables[table] = `ERROR: ${e.message}`;
      console.error(`✗ ${table}: ${e.message}`);
    }
  }

  fs.writeFileSync(path.join(dir, "_summary.json"), JSON.stringify(summary, null, 2));
  console.log(`\nบันทึกที่ ${dir}`);
  if (failed) {
    console.error(`มี ${failed} ตารางที่สำรองไม่สำเร็จ`);
    process.exitCode = 1; // ไม่ใช้ process.exit() — บน Windows ตัดการเชื่อมต่อค้างแล้ว Node ล้ม
  }
})();
