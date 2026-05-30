import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Svg, { Path } from "react-native-svg";
import supabase from "../../lib/supabase";

function SignaturePreview({ svgString }: { svgString: string }) {
  if (!svgString || !svgString.startsWith("<svg")) return null;
  const paths: { d: string; stroke: string; sw: number }[] = [];
  const re = /d="([^"]+)"[^/]*stroke="([^"]+)"[^/]*stroke-width="([^"]+)"/g;
  let match;
  while ((match = re.exec(svgString)) !== null) {
    paths.push({ d: match[1], stroke: match[2], sw: parseFloat(match[3]) });
  }
  return (
    <Svg width="100%" height={72} viewBox="0 0 320 180" style={s.signatureCanvas}>
      {paths.map((path, index) => (
        <Path
          key={index}
          d={path.d}
          stroke={path.stroke}
          strokeWidth={path.sw}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </Svg>
  );
}

const C = {
  bg: "#eef3f8",
  purple: "#7c3aed",
  blue: "#1e4fae",
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  card: "#ffffff",
  orange: "#f59e0b",
  red: "#ef4444",
  green: "#22c55e",
};

const FILTERS = [
  { key: "all", label: "ทั้งหมด", color: C.blue },
  { key: "borrowed", label: "กำลังยืม", color: C.orange },
  { key: "overdue", label: "เกินกำหนด", color: C.red },
  { key: "returned", label: "คืนแล้ว", color: C.green },
] as const;

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
}

function daysLeft(due?: string) {
  if (!due) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(due).getTime() - today.getTime()) / 86400000);
}

function isActiveBorrow(record: any) {
  return record.status === "borrowed" || record.status === "pending_return";
}

function isOverdue(record: any) {
  const left = daysLeft(record.due_date);
  return isActiveBorrow(record) && left !== null && left < 0;
}

function statusConfig(record: any) {
  if (record.status === "returned") {
    return { label: "คืนแล้ว", color: "#16a34a", bg: "#dcfce7", icon: "server-outline", iconBg: "#dcfce7" };
  }
  if (isOverdue(record)) {
    return { label: "เกินกำหนด", color: "#dc2626", bg: "#fee2e2", icon: "hardware-chip-outline", iconBg: "#fef3c7" };
  }
  return { label: "กำลังยืม", color: "#b45309", bg: "#fef3c7", icon: "hardware-chip-outline", iconBg: "#fef3c7" };
}

function itemIcon(name: string, status: string) {
  const key = (name || "").toLowerCase();
  if (status === "returned" && key.includes("rasp")) return "server-outline";
  if (key.includes("sensor")) return "pulse-outline";
  if (key.includes("servo")) return "flash-outline";
  return "hardware-chip-outline";
}

export default function AdminHistory() {
  const router = useRouter();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from("borrow_records")
      .select("*");

    if (error) {
      console.error("history fetch error:", error.message);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const rows = data || [];
    const itemIds = [...new Set(rows.map((row: any) => row.item_id).filter(Boolean))];
    const userIds = [...new Set(rows.map((row: any) => row.user_id).filter(Boolean))];
    const itemMap: Record<string, string> = {};
    const emailMap: Record<string, string> = {};

    if (itemIds.length > 0) {
      const { data: items } = await supabase.from("items").select("id, name").in("id", itemIds);
      (items || []).forEach((item: any) => { itemMap[item.id] = item.name; });
    }

    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, email").in("id", userIds);
      (profiles || []).forEach((profile: any) => { emailMap[profile.id] = profile.email; });
    }

    const merged = rows.map((row: any) => ({
      ...row,
      itemName: itemMap[row.item_id] || "อุปกรณ์",
      email: emailMap[row.user_id] || "-",
    }));

    merged.sort((a: any, b: any) => {
      const aDate = a.borrow_date || a.created_at || a.due_date || "";
      const bDate = b.borrow_date || b.created_at || b.due_date || "";
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    setRecords(merged);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const filtered = useMemo(() => {
    if (activeFilter === "all") return records;
    if (activeFilter === "borrowed") return records.filter((record) => isActiveBorrow(record) && !isOverdue(record));
    if (activeFilter === "overdue") return records.filter(isOverdue);
    return records.filter((record) => record.status === "returned");
  }, [activeFilter, records]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchHistory();
  };

  const goBack = () => router.replace("/admin/home");

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={goBack} activeOpacity={0.82}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>ประวัติยืม-คืน</Text>
          <Text style={s.headerSub}>{records.length} รายการทั้งหมด</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.purple} style={{ marginTop: 60 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.purple} />}
          showsVerticalScrollIndicator={false}
        >
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

          {filtered.length === 0 ? (
            <View style={s.empty}>
              <Ionicons name="document-outline" size={42} color="#cbd5e1" />
              <Text style={s.emptyText}>ไม่พบรายการ</Text>
            </View>
          ) : (
            filtered.map((record) => {
              const cfg = statusConfig(record);
              const left = daysLeft(record.due_date);
              const expanded = expandedId === record.id;
              const icon = itemIcon(record.itemName, record.status);

              return (
                <TouchableOpacity
                  key={record.id}
                  style={s.card}
                  activeOpacity={0.88}
                  onPress={() => setExpandedId((current) => current === record.id ? null : record.id)}
                >
                  <View style={s.cardMain}>
                    <View style={[s.iconBox, { backgroundColor: cfg.iconBg }]}>
                      <Ionicons name={icon as any} size={24} color={cfg.color} />
                    </View>
                    <View style={s.cardBody}>
                      <Text style={s.cardName} numberOfLines={1}>{record.itemName}</Text>
                      <Text style={s.cardEmail} numberOfLines={1}>{record.email}</Text>
                    </View>
                    <View style={[s.statusPill, { backgroundColor: cfg.bg }]}>
                      <Text style={[s.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                  </View>

                  {isOverdue(record) ? (
                    <View style={s.overdueBox}>
                      <Ionicons name="alert-circle-outline" size={14} color="#b45309" />
                      <Text style={s.overdueText}>เกินกำหนดคืน — ยืม {Math.abs(left || 0)} วัน</Text>
                    </View>
                  ) : (
                    <View style={s.dateRow}>
                      <Ionicons name="calendar-outline" size={13} color={C.faint} />
                      <Text style={s.dateText}>ยืม {formatDate(record.borrow_date || record.created_at)}</Text>
                      {record.status === "returned" && (
                        <>
                          <Ionicons name="checkmark" size={13} color={C.green} />
                          <Text style={s.dateText}>คืน {formatDate(record.returned_at)}</Text>
                        </>
                      )}
                    </View>
                  )}

                  {expanded && (
                    <View style={s.expanded}>
                      <View style={s.expandedLine} />
                      <View style={s.detailRow}>
                        <Text style={s.detailLabel}>กำหนดคืน</Text>
                        <Text style={s.detailValue}>{formatDate(record.due_date)}</Text>
                      </View>
                      <View style={s.detailRow}>
                        <Text style={s.detailLabel}>สถานะ</Text>
                        <Text style={[s.detailValue, { color: cfg.color }]}>{cfg.label}</Text>
                      </View>
                      <View style={s.signatureRow}>
                        <View style={s.signatureBox}>
                          <Text style={s.signatureLabel}>ลายเซ็นยืม</Text>
                          {record.borrow_signature_url?.startsWith("<svg") ? (
                            <SignaturePreview svgString={record.borrow_signature_url} />
                          ) : (
                            <Text style={s.signatureEmpty}>ไม่มีลายเซ็น</Text>
                          )}
                        </View>
                        <View style={s.signatureBox}>
                          <Text style={s.signatureLabel}>ลายเซ็นคืน</Text>
                          {record.return_signature_url?.startsWith("<svg") ? (
                            <SignaturePreview svgString={record.return_signature_url} />
                          ) : (
                            <Text style={s.signatureEmpty}>{record.status === "returned" ? "ไม่มีลายเซ็น" : "ยังไม่ได้คืน"}</Text>
                          )}
                        </View>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    minHeight: 122,
    backgroundColor: C.purple,
    paddingTop: 58,
    paddingHorizontal: 35,
    paddingBottom: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.20)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 25,
    fontWeight: "900",
    lineHeight: 29,
  },
  headerSub: {
    color: "#ddd6fe",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },
  body: {
    paddingHorizontal: 35,
    paddingTop: 18,
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
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#94a3b8",
    shadowOpacity: 0.16,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  cardMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    color: C.ink,
    fontSize: 14.5,
    fontWeight: "900",
  },
  cardEmail: {
    color: C.muted,
    fontSize: 11.5,
    fontWeight: "700",
    marginTop: 2,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 10.5,
    fontWeight: "900",
  },
  overdueBox: {
    minHeight: 31,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 8,
    backgroundColor: "#fef3c7",
    borderWidth: 1,
    borderColor: "#fbbf24",
    paddingHorizontal: 12,
    marginTop: 10,
  },
  overdueText: {
    color: "#b45309",
    fontSize: 12,
    fontWeight: "900",
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 11,
  },
  dateText: {
    color: C.muted,
    fontSize: 11.5,
    fontWeight: "800",
  },
  expanded: {
    marginTop: 12,
  },
  expandedLine: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginBottom: 10,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  detailLabel: {
    color: C.faint,
    fontSize: 11.5,
    fontWeight: "800",
  },
  detailValue: {
    color: C.ink,
    fontSize: 11.5,
    fontWeight: "900",
  },
  signatureRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  signatureBox: {
    flex: 1,
    minHeight: 84,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 8,
    justifyContent: "center",
  },
  signatureLabel: {
    color: C.muted,
    fontSize: 10.5,
    fontWeight: "900",
    marginBottom: 5,
  },
  signatureEmpty: {
    color: C.faint,
    fontSize: 10.5,
    fontWeight: "800",
    textAlign: "center",
  },
  signatureCanvas: {
    backgroundColor: "#f8fafc",
    borderRadius: 8,
  },
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
