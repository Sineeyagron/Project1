import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import supabase from "../../lib/supabase";
import { ITEM_STATUS } from "../../lib/status";
import { goBack, useRefreshOnFocus } from "../../lib/nav";
import { notify } from "../../lib/notify";
import { ageMonths, ageText, warrantyInfo } from "../../lib/itemInfo";
import { W, gradient, tint } from "../../lib/theme";

// Stock Report (แผนเฟส 2 ข้อ 1): นับจำนวนชิ้นตามสถานะ แยกตามหมวด + อายุ + ประกันรายชิ้น
// กลุ่ม "ต้องดูแล" ใช้เกณฑ์ปีจาก app_settings (age_warn_years / age_replace_years) ที่ Admin ตั้งเอง

const C = {
  bg: "#EAF1FC",
  purple: "#2563EB",
  ink: "#172033",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#DCE6F5",
  green: "#047857",
  orange: "#c2410c",
  red: "#dc2626",
};

const OTHER = "อื่นๆ";

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  ...ITEM_STATUS,
};
const STATUS_KEYS = ["available", "borrowed", "reserved", "repair", "retired"];

type Item = {
  id: string;
  item_code: string | null;
  name: string;
  status: string;
  created_at: string;
  warranty_expires_at: string | null;
  category: string;
};

type WatchKey = "soon" | "expired" | "ageWarn" | "ageReplace";

function countBy(list: Item[]) {
  const out: Record<string, number> = {};
  list.forEach((i) => { out[i.status] = (out[i.status] || 0) + 1; });
  return out;
}

export default function StockReport() {
  const router = useRouter();
  // มาจากแจ้งเตือน → เปิดกลุ่มนั้นไว้เลย
  const params = useLocalSearchParams<{ watch?: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const [catOrder, setCatOrder] = useState<string[]>([]);
  const [warnYears, setWarnYears] = useState(3);
  const [replaceYears, setReplaceYears] = useState(4);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [warnDays, setWarnDays] = useState(30);
  const [watch, setWatch] = useState<WatchKey | null>(
    ["soon", "expired", "ageWarn", "ageReplace"].includes(String(params.watch)) ? (params.watch as WatchKey) : null
  );

  useEffect(() => {
    load();
  }, []);
  // กลับมาหน้านี้ (ปุ่ม ← / สลับแท็บ) → โหลดข้อมูลใหม่
  useRefreshOnFocus(() => { load(); });

  const load = async () => {
    const [{ data, error }, { data: cats }, { data: settings }] = await Promise.all([
      supabase.from("items").select("id, item_code, name, type, status, category_id, created_at, warranty_expires_at"),
      // รายงานนับทุกหมวด รวมหมวดที่ปิดอยู่ (ของยังมีจริง)
      supabase.from("categories").select("id, name").order("sort_order").order("name"),
      supabase.from("app_settings").select("key, value").in("key", ["age_warn_years", "age_replace_years", "warranty_warn_days"]),
    ]);
    if (error) notify("โหลดรายงานไม่สำเร็จ", error.message);

    const catList = cats || [];
    const byId: Record<string, string> = {};
    catList.forEach((c: any) => { byId[c.id] = c.name; });
    const categoryOf = (item: any) =>
      byId[item.category_id] ||
      catList.find((c: any) => c.name.toLowerCase() === String(item.type || "").trim().toLowerCase())?.name ||
      OTHER;

    (settings || []).forEach((r: any) => {
      const n = Number(r.value);
      if (!Number.isFinite(n) || n <= 0) return;
      if (r.key === "age_warn_years") setWarnYears(n);
      if (r.key === "age_replace_years") setReplaceYears(n);
      if (r.key === "warranty_warn_days") setWarnDays(n);
    });

    setCatOrder([...catList.map((c: any) => c.name), OTHER].filter((n, i, a) => a.indexOf(n) === i));
    setItems((data || []).map((i: any) => ({ ...i, category: categoryOf(i) })));
    setLoading(false);
    setRefreshing(false);
  };

  const active = items.filter((i) => i.status !== "retired");
  const totals = countBy(items);

  // กลุ่มต้องดูแล (ไม่นับของที่จำหน่ายแล้ว)
  const watchList: Record<WatchKey, Item[]> = {
    soon: active.filter((i) => warrantyInfo(i.warranty_expires_at, warnDays).state === "soon"),
    expired: active.filter((i) => warrantyInfo(i.warranty_expires_at).state === "expired"),
    ageWarn: active.filter((i) => {
      const m = ageMonths(i.created_at);
      return m >= warnYears * 12 && m < replaceYears * 12;
    }),
    ageReplace: active.filter((i) => ageMonths(i.created_at) >= replaceYears * 12),
  };
  const WATCH: { key: WatchKey; label: string; icon: any; color: string }[] = [
    { key: "soon", label: `ประกันเหลือ ≤ ${warnDays} วัน`, icon: "time-outline", color: C.orange },
    { key: "expired", label: "หมดประกันแล้ว", icon: "shield-outline", color: C.red },
    { key: "ageWarn", label: `ใช้มา ${warnYears} ปีขึ้นไป (ควรตรวจ)`, icon: "eye-outline", color: C.orange },
    { key: "ageReplace", label: `ใช้มา ${replaceYears} ปีขึ้นไป (ควรเปลี่ยน)`, icon: "refresh-outline", color: C.red },
  ];

  const byCategory = catOrder
    .map((name) => ({ name, list: items.filter((i) => i.category === name) }))
    .filter((g) => g.list.length > 0);

  const sortItems = (list: Item[]) =>
    [...list].sort((a, b) => String(a.item_code || a.name).localeCompare(String(b.item_code || b.name), "th", { numeric: true }));

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => goBack("/admin/home")} activeOpacity={0.82}>
          <Ionicons name="chevron-back" size={22} color="#172033" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>รายงานสต็อก</Text>
          <Text style={s.headerSub}>จำนวนชิ้นตามสถานะ อายุ และประกัน</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.purple} style={{ marginTop: 44 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.purple} />}
        >
          {/* ภาพรวม */}
          <View style={s.statGrid}>
            <Stat label="มีอยู่ (ไม่รวมจำหน่าย)" value={active.length} color={C.ink} wide />
            {STATUS_KEYS.map((k) => (
              <Stat key={k} label={STATUS[k].label} value={totals[k] || 0} color={STATUS[k].color} />
            ))}
          </View>

          {/* ต้องดูแล */}
          <Text style={s.section}>ต้องดูแล</Text>
          <View style={s.card}>
            {WATCH.map((w, idx) => {
              const n = watchList[w.key].length;
              const opened = watch === w.key;
              return (
                <View key={w.key}>
                  <TouchableOpacity
                    style={[s.row, idx > 0 && s.rowDivider]}
                    onPress={() => setWatch(opened ? null : w.key)}
                    disabled={n === 0}
                    activeOpacity={0.75}
                  >
                    <Ionicons name={w.icon} size={18} color={n ? w.color : C.faint} />
                    <Text style={[s.rowLabel, !n && { color: C.faint }]}>{w.label}</Text>
                    <Text style={[s.rowCount, { color: n ? w.color : C.faint }]}>{n}</Text>
                    {n > 0 && <Ionicons name={opened ? "chevron-up" : "chevron-down"} size={16} color={C.faint} />}
                  </TouchableOpacity>
                  {opened && sortItems(watchList[w.key]).map((i) => <ItemRow key={i.id} item={i} showCategory warnDays={warnDays} />)}
                </View>
              );
            })}
          </View>

          {/* แยกตามหมวด */}
          <Text style={s.section}>แยกตามหมวด</Text>
          <View style={s.card}>
            {byCategory.length === 0 && <Text style={s.empty}>ยังไม่มีอุปกรณ์</Text>}
            {byCategory.map((g, idx) => {
              const counts = countBy(g.list);
              const have = g.list.length - (counts.retired || 0);
              const opened = openCat === g.name;
              return (
                <View key={g.name}>
                  <TouchableOpacity
                    style={[s.catRow, idx > 0 && s.rowDivider]}
                    onPress={() => setOpenCat(opened ? null : g.name)}
                    activeOpacity={0.75}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={s.catName}>{g.name}</Text>
                      <View style={s.pills}>
                        {STATUS_KEYS.filter((k) => counts[k]).map((k) => (
                          <View key={k} style={[s.pill, { backgroundColor: STATUS[k].bg }]}>
                            <Text style={[s.pillText, { color: STATUS[k].color }]}>{STATUS[k].label} {counts[k]}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <View style={s.catTotal}>
                      <Text style={s.catTotalNum}>{counts.available || 0}/{have}</Text>
                      <Text style={s.catTotalLabel}>ว่าง/มีอยู่</Text>
                    </View>
                    <Ionicons name={opened ? "chevron-up" : "chevron-down"} size={16} color={C.faint} />
                  </TouchableOpacity>
                  {opened && sortItems(g.list).map((i) => <ItemRow key={i.id} item={i} warnDays={warnDays} />)}
                </View>
              );
            })}
          </View>

          <Text style={s.hint}>
            อายุนับจากวันที่เพิ่มเข้าระบบ · เกณฑ์ {warnYears} / {replaceYears} ปี ตั้งได้ในหน้า "ตั้งค่าระบบ"
          </Text>
        </ScrollView>
      )}
    </View>
  );
}

function Stat({ label, value, color, wide }: { label: string; value: number; color: string; wide?: boolean }) {
  return (
    <View style={[s.stat, wide && s.statWide, gradient(`linear-gradient(160deg, #FFFFFF 0%, ${tint(/^#(172033|64748b|94a3b8|475569)$/i.test(color) ? "#2563EB" : color)} 100%)`)]}>
      <Text style={[s.statNum, { color }]}>{value}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  );
}

function ItemRow({ item, showCategory, warnDays }: { item: Item; showCategory?: boolean; warnDays: number }) {
  const st = STATUS[item.status] || STATUS.available;
  const w = warrantyInfo(item.warranty_expires_at, warnDays);
  return (
    <View style={s.itemRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.itemCode}>{item.item_code || item.name}</Text>
        <Text style={s.itemMeta}>
          {showCategory ? `${item.category} · ` : ""}ใช้มา {ageText(item.created_at)}
        </Text>
        <Text style={[s.itemMeta, { color: w.color }]}>{w.text}</Text>
      </View>
      <View style={[s.pill, { backgroundColor: st.bg }]}>
        <Text style={[s.pillText, { color: st.color }]}>{st.label}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { ...W.page, flex: 1 },
  header: {
    paddingTop: 52,
    paddingBottom: 16,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBtn: {
    ...W.iconBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#172033", fontSize: 21, fontWeight: "900" },
  headerSub: { color: "#475569", fontSize: 12, fontWeight: "700", marginTop: 2 },
  body: { padding: 16, gap: 10, paddingBottom: 40 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stat: {
    ...W.card,
    flexGrow: 1,
    flexBasis: "30%",
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  statWide: { flexBasis: "100%" },
  statNum: { fontSize: 26, fontWeight: "700" },
  statLabel: { fontSize: 12, color: C.muted, marginTop: 0 },
  section: { fontSize: 15, fontWeight: "900", color: C.ink, marginTop: 8 },
  card: { ...W.card, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, minHeight: 50 },
  rowDivider: { borderTopWidth: 1, borderTopColor: C.line },
  rowLabel: { flex: 1, fontSize: 14.5, fontWeight: "700", color: C.ink },
  rowCount: { fontSize: 17, fontWeight: "900" },
  catRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  catName: { fontSize: 15.5, fontWeight: "800", color: C.ink },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  pill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: "800" },
  catTotal: { alignItems: "flex-end" },
  catTotalNum: { fontSize: 17, fontWeight: "900", color: C.ink },
  catTotalLabel: { fontSize: 11, color: C.faint, fontWeight: "700" },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#f8fafc",
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  itemCode: { fontSize: 14.5, fontWeight: "800", color: C.ink },
  itemMeta: { fontSize: 12.5, color: C.muted, marginTop: 2 },
  empty: { padding: 16, color: C.faint, textAlign: "center" },
  hint: { fontSize: 12, color: C.faint, lineHeight: 18, marginTop: 4 },
});
