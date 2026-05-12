import React, { useEffect, useState } from "react";
import supabase from "../lib/supabase";
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, TextInput, Image, Alert, ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const TYPE_ICONS: { [key: string]: any } = {
  Microcontroller: "hardware-chip-outline",
  SBC:             "server-outline",
  Sensor:          "pulse-outline",
  Actuator:        "flash-outline",
  Module:          "cube-outline",
  Kit:             "color-wand-outline",
  Cable:           "git-branch-outline",
  Other:           "ellipsis-horizontal-outline",
};

const STATUS_BADGE: { [key: string]: { label: string; bg: string; color: string } } = {
  available: { label: "ว่าง",      bg: "#dcfce7", color: "#16a34a" },
  borrowed:  { label: "ถูกยืม",    bg: "#fee2e2", color: "#dc2626" },
  repair:    { label: "ซ่อมบำรุง", bg: "#fef3c7", color: "#b45309" },
};

export default function Equipment() {
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [borrowing, setBorrowing] = useState<string | null>(null);

  useEffect(() => { fetchItems(); }, []);

  const fetchItems = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("items").select("*").order("name");
    if (error) console.log(error);
    else setItems(data || []);
    setLoading(false);
  };

  const filtered = items.filter((item) =>
    item.name?.toLowerCase().includes(search.toLowerCase()) ||
    item.type?.toLowerCase().includes(search.toLowerCase())
  );

  const borrowItem = async (item: any) => {
    if (item.status !== "available") {
      Alert.alert(
        "ไม่สามารถยืมได้",
        item.status === "borrowed" ? "อุปกรณ์ถูกยืมไปแล้ว" : "อุปกรณ์กำลังซ่อมบำรุง"
      );
      return;
    }

    Alert.alert(
      "ยืนยันการยืม",
      `ยืม "${item.name}" ใช่ไหม?`,
      [
        { text: "ยกเลิก", style: "cancel" },
        {
          text: "ยืม",
          onPress: async () => {
            setBorrowing(item.id);
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { Alert.alert("กรุณาเข้าสู่ระบบก่อน"); setBorrowing(null); return; }

            const { error } = await supabase
              .from("borrow_records")
              .insert([{ user_id: user.id, item_id: item.id, status: "borrowed" }]);

            if (error) { Alert.alert("ยืมไม่สำเร็จ", error.message); setBorrowing(null); return; }

            await supabase.from("items").update({ status: "borrowed" }).eq("id", item.id);

            Alert.alert("ยืมสำเร็จ 🎉", `ยืม ${item.name} แล้ว`);
            fetchItems();
            setBorrowing(null);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>อุปกรณ์ IoT</Text>
        <Text style={styles.headerSub}>{items.length} รายการทั้งหมด</Text>
      </View>

      {/* SEARCH */}
      <View style={styles.searchBox}>
        <Ionicons name="search-outline" size={18} color="#94a3b8" />
        <TextInput
          placeholder="ค้นหาชื่อหรือประเภท..."
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholderTextColor="#94a3b8"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={18} color="#94a3b8" />
          </TouchableOpacity>
        )}
      </View>

      {/* MY BORROW shortcut */}
      <TouchableOpacity style={styles.borrowCard} onPress={() => router.push("./borrow")}>
        <View style={styles.borrowLeft}>
          <Ionicons name="cube-outline" size={24} color="#fff" />
          <View>
            <Text style={styles.borrowTitle}>รายการยืมของฉัน</Text>
            <Text style={styles.borrowSub}>ดูประวัติยืม-คืน และการจองห้อง</Text>
          </View>
        </View>
        <Ionicons name="arrow-forward" size={20} color="#fff" />
      </TouchableOpacity>

      {/* TITLE ROW */}
      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>รายการอุปกรณ์</Text>
        {search.length > 0 && (
          <Text style={styles.resultCount}>{filtered.length} รายการ</Text>
        )}
      </View>

      {/* LIST */}
      {loading ? (
        <ActivityIndicator size="large" color="#1e3a8a" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="search-outline" size={40} color="#cbd5e1" />
              <Text style={styles.emptyText}>ไม่พบอุปกรณ์ที่ค้นหา</Text>
            </View>
          ) : (
            filtered.map((item: any) => {
              const badge = STATUS_BADGE[item.status] || STATUS_BADGE.available;
              const iconName = TYPE_ICONS[item.type] || "cube-outline";
              const isBorrowing = borrowing === item.id;

              return (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.item, item.status !== "available" && styles.itemDim]}
                  onPress={() => borrowItem(item)}
                  disabled={isBorrowing}
                >
                  {/* รูปภาพ หรือ icon */}
                  {item.image_url ? (
                    <Image
                      source={{ uri: item.image_url }}
                      style={styles.itemImage}
                      resizeMode="cover"
                    />
                  ) : (
                    <View style={[styles.iconBox, item.status !== "available" && { backgroundColor: "#f1f5f9" }]}>
                      <Ionicons name={iconName} size={22} color={item.status === "available" ? "#1e3a8a" : "#94a3b8"} />
                    </View>
                  )}

                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                    {item.type ? (
                      <Text style={styles.itemType}>{item.type}</Text>
                    ) : null}
                    {item.description ? (
                      <Text style={styles.itemDesc} numberOfLines={1}>{item.description}</Text>
                    ) : null}
                  </View>

                  <View style={styles.itemRight}>
                    <View style={[styles.badge, { backgroundColor: badge.bg }]}>
                      <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                    </View>
                    {isBorrowing ? (
                      <ActivityIndicator size="small" color="#1e3a8a" style={{ marginTop: 4 }} />
                    ) : item.status === "available" ? (
                      <Ionicons name="add-circle-outline" size={20} color="#1e3a8a" style={{ marginTop: 4 }} />
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}

      {/* BOTTOM TAB */}
      <View style={styles.tab}>
        <TouchableOpacity style={styles.tabItem} onPress={() => router.push("/home")}>
          <Ionicons name="home-outline" size={20} color="#94a3b8" />
          <Text style={styles.tabText}>หน้าหลัก</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem}>
          <Ionicons name="cube" size={20} color="#1e3a8a" />
          <Text style={[styles.tabText, styles.tabActive]}>อุปกรณ์</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => router.push("./notifications")}>
          <Ionicons name="notifications-outline" size={20} color="#94a3b8" />
          <Text style={styles.tabText}>แจ้งเตือน</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.tabItem} onPress={() => router.push("./profile")}>
          <Ionicons name="person-outline" size={20} color="#94a3b8" />
          <Text style={styles.tabText}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f1f5f9" },

  header: {
    backgroundColor: "#1e3a8a",
    paddingTop: 54, paddingBottom: 16, paddingHorizontal: 20,
  },
  headerTitle: { color: "#fff", fontSize: 22, fontWeight: "bold" },
  headerSub: { color: "#93c5fd", fontSize: 12, marginTop: 2 },

  searchBox: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 12,
    margin: 16, paddingHorizontal: 14, paddingVertical: 10,
    gap: 8, borderWidth: 1, borderColor: "#e2e8f0",
  },
  searchInput: { flex: 1, fontSize: 14, color: "#1e293b" },

  borrowCard: {
    backgroundColor: "#0f3a6d", borderRadius: 14,
    marginHorizontal: 16, marginBottom: 16,
    padding: 16, flexDirection: "row",
    justifyContent: "space-between", alignItems: "center",
  },
  borrowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  borrowTitle: { color: "#fff", fontSize: 15, fontWeight: "700" },
  borrowSub: { color: "#93c5fd", fontSize: 11, marginTop: 2 },

  titleRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 16, marginBottom: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: "#1e293b" },
  resultCount: { fontSize: 12, color: "#94a3b8" },

  list: { flex: 1, paddingHorizontal: 16 },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { color: "#94a3b8", fontSize: 14 },

  item: {
    backgroundColor: "#fff", borderRadius: 14, padding: 12,
    marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12,
    borderWidth: 1, borderColor: "#f1f5f9",
  },
  itemDim: { opacity: 0.75 },

  itemImage: {
    width: 52, height: 52, borderRadius: 10, backgroundColor: "#f1f5f9",
  },
  iconBox: {
    width: 52, height: 52, borderRadius: 10,
    backgroundColor: "#eff6ff",
    justifyContent: "center", alignItems: "center",
  },

  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, fontWeight: "700", color: "#1e293b" },
  itemType: { fontSize: 11, color: "#64748b", marginTop: 2 },
  itemDesc: { fontSize: 10, color: "#94a3b8", marginTop: 2 },

  itemRight: { alignItems: "center" },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  badgeText: { fontSize: 10, fontWeight: "700" },

  // Tab Bar
  tab: {
    flexDirection: "row", backgroundColor: "#fff",
    borderTopWidth: 1, borderTopColor: "#e2e8f0",
    paddingBottom: 20, paddingTop: 10,
  },
  tabItem: { flex: 1, alignItems: "center", gap: 3 },
  tabText: { fontSize: 10, color: "#94a3b8" },
  tabActive: { color: "#1e3a8a", fontWeight: "700" },
});
