import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import supabase from "../../lib/supabase";
import { fetchPeople, who } from "../../lib/people";
import { goBack as navBack, useRefreshOnFocus } from "../../lib/nav";
import { W } from "../../lib/theme";
import ScreenHeader from "../../components/ScreenHeader";
import SearchBar from "../../components/SearchBar";
import TimelineDays from "../../components/TimelineDays";
import { PAGE_DAYS, TimelineFilter, buildEvents, filterEvents, groupByDay, sinceIso } from "../../lib/timeline";

// ประวัติยืม-คืน (Admin/TA) — F3 แบบแอปธนาคาร: จัดกลุ่มตามวัน แต่ละแถว = เวลา · ชนิด · ของ · ใคร · รายละเอียด
// ดึงทีละช่วง (60 วันล่าสุด + โหลดเพิ่ม) ไม่ดึงทั้งตาราง

const C = {
  bg: "#EAF1FC",
  purple: "#2563EB",
  blue: "#1e4fae",
  ink: "#172033",
  muted: "#475569",
  faint: "#64748B",
  orange: "#f59e0b",
  red: "#ef4444",
  green: "#10B981",
  violet: "#7C3AED",
};

const FILTERS: { key: TimelineFilter; label: string; color: string }[] = [
  { key: "all", label: "ทั้งหมด", color: C.blue },
  { key: "borrow", label: "ยืมออก", color: C.purple },
  { key: "return", label: "คืนเข้า", color: C.green },
  { key: "overdue", label: "เกินกำหนด", color: C.red },
  { key: "other", label: "อื่น ๆ", color: C.violet },
];

export default function AdminHistory() {
  const [records, setRecords] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [pickups, setPickups] = useState<any[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [people, setPeople] = useState<Record<string, string>>({});
  const [days, setDays] = useState(PAGE_DAYS);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [activeFilter, setActiveFilter] = useState<TimelineFilter>("all");
  const [query, setQuery] = useState("");

  const fetchHistory = useCallback(async (range: number) => {
    const since = sinceIso(range);
    const [recRes, reqRes, pkRes] = await Promise.all([
      supabase
        .from("borrow_records")
        .select("id, user_id, item_id, status, borrow_date, return_date, due_date, renew_count, auto_returned, return_condition, damage_cost, borrow_request_id")
        // ในช่วงนี้ (ยืมหรือคืน) + ที่ยังยืมอยู่ทุกชิ้น (กันของเกินกำหนดเก่าหลุดจากชิป "เกินกำหนด")
        .or(`borrow_date.gte.${since},return_date.gte.${since},status.in.(borrowed,pending_return)`)
        .order("borrow_date", { ascending: false }),
      supabase
        .from("borrow_requests")
        .select("id, user_id, item_id, borrow_record_id, kind, status, days, created_at, expires_at, decided_at, decided_by, decision_note")
        .in("status", ["approved", "declined", "expired"])
        .gte("created_at", since)
        .order("created_at", { ascending: false }),
      // F2 นัดรับ (นัดแล้ว / รับแล้ว / ไม่มาตามนัด)
      supabase
        .from("pickup_requests")
        .select("id, user_id, item_prefix, days, status, pickup_at, decided_at")
        .in("status", ["scheduled", "picked_up", "no_show"])
        .gte("decided_at", since),
    ]);

    if (recRes.error || reqRes.error) {
      setError((recRes.error || reqRes.error)!.message);
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
      return;
    }
    const recs = recRes.data || [];
    const reqs = reqRes.data || [];
    const pks = pkRes.data || [];

    const itemIds = [...new Set([...recs, ...reqs].map((r: any) => r.item_id).filter(Boolean))];
    const userIds = [...new Set([
      ...recs.map((r: any) => r.user_id),
      ...reqs.map((r: any) => r.user_id),
      ...reqs.map((r: any) => r.decided_by),
      ...pks.map((r: any) => r.user_id),
    ].filter(Boolean))];
    const [itemsRes, profiles] = await Promise.all([
      itemIds.length ? supabase.from("items").select("id, name, item_code").in("id", itemIds) : Promise.resolve({ data: [] as any[] }),
      fetchPeople(userIds),
    ]);
    const itemMap: Record<string, string> = {};
    (itemsRes.data || []).forEach((it: any) => { itemMap[it.id] = it.item_code || it.name; });
    const peopleMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => { peopleMap[p.id] = who(p); });

    setError("");
    setRecords(recs);
    setRequests(reqs);
    setPickups(pks);
    setNames(itemMap);
    setPeople(peopleMap);
    setLoading(false);
    setRefreshing(false);
    setLoadingMore(false);
  }, []);

  useEffect(() => { fetchHistory(days); }, [fetchHistory]);
  // กลับมาหน้านี้ (ปุ่ม ← / สลับแท็บ) → โหลดข้อมูลใหม่
  useRefreshOnFocus(() => { fetchHistory(days); });

  const events = useMemo(() => {
    const approverOf: Record<string, string> = {};
    requests.forEach((q) => { if (q.decided_by && people[q.decided_by]) approverOf[q.id] = people[q.decided_by].split(" · ")[0]; });
    return buildEvents(records, requests, {
      itemName: (id) => (id && names[id]) || "อุปกรณ์",
      approver: (reqId) => (reqId ? approverOf[reqId] || null : null),
    }, pickups);
  }, [records, requests, pickups, names, people]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const searched = q
      ? events.filter((e) => e.itemName.toLowerCase().includes(q) || (people[e.userId] || "").toLowerCase().includes(q))
      : events;
    return groupByDay(filterEvents(searched, activeFilter));
  }, [events, activeFilter, query, people]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory(days);
  };
  const loadMore = () => {
    const next = days + PAGE_DAYS;
    setDays(next);
    setLoadingMore(true);
    fetchHistory(next);
  };

  return (
    <View style={s.container}>
      <ScreenHeader
        title={"ประวัติยืม-คืน"}
        subtitle={`${events.length} รายการ · ${days} วันล่าสุด`}
        onBack={() => navBack("/admin/home")}
      />

      {loading ? (
        <ActivityIndicator size="large" color={C.purple} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purple} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <SearchBar value={query} onChangeText={setQuery} placeholder="ค้นหาชื่อ รหัส นศ. หรืออุปกรณ์" style={{ marginBottom: 12 }} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filterRow}>
            {FILTERS.map((filter) => {
              const active = activeFilter === filter.key;
              return (
                <TouchableOpacity
                  key={filter.key}
                  style={[
                    s.filterBtn,
                    { borderColor: filter.color },
                    active && { backgroundColor: filter.color },
                  ]}
                  onPress={() => setActiveFilter(filter.key)}
                  activeOpacity={0.82}
                >
                  <Text style={[s.filterText, { color: active ? "#fff" : filter.color }]}>{filter.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {!!error && (
            <View style={s.errorBox}>
              <Ionicons name="cloud-offline-outline" size={18} color="#b91c1c" />
              <Text style={s.errorText} numberOfLines={2}>โหลดไม่สำเร็จ: {error}</Text>
              <TouchableOpacity onPress={onRefresh} activeOpacity={0.85}>
                <Text style={s.retryText}>ลองใหม่</Text>
              </TouchableOpacity>
            </View>
          )}

          {groups.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="document-outline" size={42} color="#cbd5e1" />
              <Text style={s.emptyText}>ไม่พบรายการ</Text>
            </View>
          ) : (
            <TimelineDays groups={groups} showCount person={(id) => people[id] || "-"} />
          )}

          <TouchableOpacity style={s.moreBtn} onPress={loadMore} disabled={loadingMore} activeOpacity={0.85}>
            {loadingMore ? (
              <ActivityIndicator color={C.purple} />
            ) : (
              <Text style={s.moreText}>โหลดเพิ่ม (ย้อนหลังอีก {PAGE_DAYS} วัน)</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    ...W.page,
    flex: 1,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 34,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 10,
    marginBottom: 16,
  },
  filterBtn: {
    minHeight: 32,
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  filterText: {
    fontSize: 13,
    fontWeight: "900",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 14,
    backgroundColor: "#fee2e2",
    padding: 12,
    marginBottom: 12,
  },
  errorText: { flex: 1, color: "#991b1b", fontSize: 13, fontWeight: "700" },
  retryText: { color: "#b91c1c", fontSize: 13, fontWeight: "900" },
  moreBtn: {
    ...W.small,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  moreText: { color: "#1D4ED8", fontSize: 14, fontWeight: "700" },
  empty: {
    alignItems: "center",
    paddingTop: 70,
    gap: 10,
  },
  emptyText: {
    color: C.faint,
    fontSize: 14,
    fontWeight: "800",
  },
});
