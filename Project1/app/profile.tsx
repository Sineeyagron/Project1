import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import supabase from "../lib/supabase";

export default function Profile() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [totalBorrows, setTotalBorrows] = useState(0);
  const [activeLoans, setActiveLoans] = useState(0);
  const [recentBorrows, setRecentBorrows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    // 1. ดึง user ที่ login อยู่
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // 2. ดึง email จาก profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .single();

    setEmail(profile?.email || user.email || "");

    // 3. ดึง borrow_records ของ user นี้
    const { data: borrows } = await supabase
      .from("borrow_records")
      .select(`
        id,
        status,
        borrow_date,
        items ( name )
      `)
      .eq("user_id", user.id)
      .order("borrow_date", { ascending: false });

    if (borrows) {
      setTotalBorrows(borrows.length);
      setActiveLoans(borrows.filter(b => b.status === "borrowed").length);
      setRecentBorrows(borrows.slice(0, 5)); // แสดงแค่ 5 รายการล่าสุด
    }

    setLoading(false);
  };

  // แปลง status เป็นข้อความไทย + สี
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "borrowed":       return { label: "กำลังยืม",    color: "#f97316" };
      case "pending_return": return { label: "รอคืน",       color: "#eab308" };
      case "returned":       return { label: "คืนแล้ว",     color: "#1e3a8a" };
      default:               return { label: status,         color: "#64748b" };
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>

      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerText}>Profile</Text>
        <TouchableOpacity onPress={() => router.push("./sittings")}>
          <Ionicons name="settings" size={24} color="#1e3a8a" />
        </TouchableOpacity>
      </View>

      {/* AVATAR */}
      <View style={styles.avatarWrapper}>
        <View style={styles.avatarCircle}>
          <Image
            source={{ uri: "https://cdn-icons-png.flaticon.com/512/149/149071.png" }}
            style={styles.avatar}
          />
        </View>
      </View>

      {/* EMAIL */}
      <Text style={styles.name}>{email.split("@")[0]}</Text>
      <Text style={styles.email}>{email}</Text>

      {/* STATS */}
      <View style={styles.stats}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalBorrows}</Text>
          <Text style={styles.statLabel}>TOTAL BORROWS</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{activeLoans}</Text>
          <Text style={styles.statLabel}>ACTIVE LOANS</Text>
        </View>
      </View>

      {/* HISTORY HEADER */}
      <View style={styles.historyHeader}>
        <Text style={styles.historyTitle}>Borrowing History</Text>
        <TouchableOpacity onPress={() => router.push("./borrow")}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      {/* HISTORY LIST */}
      {recentBorrows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>ยังไม่มีประวัติการยืม</Text>
        </View>
      ) : (
        recentBorrows.map((b) => {
          const st = getStatusStyle(b.status);
          return (
            <View
              key={b.id}
              style={[
                styles.item,
                b.status === "borrowed" && styles.orangeBorder,
              ]}
            >
              <Text style={styles.itemTitle}>
                {b.items?.name || b.items?.[0]?.name || "อุปกรณ์"}
              </Text>
              <Text style={{ color: st.color, fontWeight: "600" }}>
                {st.label}
              </Text>
            </View>
          );
        })
      )}

      {/* TAB */}
      <View style={styles.tab}>
        <TouchableOpacity onPress={() => router.push("./home")}>
          <Text>ชั้นเรียน</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("./equipment")}>
          <Text>อุปกรณ์</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push("./notifications")}>
          <Text>แจ้งเตือน</Text>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text style={styles.activeTab}>โปรไฟล์</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f1f5f9",
    padding: 20,
  },
  loadingBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1e3a8a",
  },
  avatarWrapper: {
    alignItems: "center",
    marginTop: 20,
  },
  avatarCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: "#1e3a8a",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fcd5b5",
  },
  avatar: {
    width: 80,
    height: 80,
  },
  name: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "bold",
    marginTop: 10,
    color: "#1e293b",
  },
  email: {
    textAlign: "center",
    color: "#64748b",
    marginBottom: 20,
  },
  stats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  statCard: {
    backgroundColor: "#e2e8f0",
    width: "48%",
    padding: 20,
    borderRadius: 15,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1e3a8a",
  },
  statLabel: {
    fontSize: 10,
    color: "#64748b",
    marginTop: 5,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 20,
    marginBottom: 4,
  },
  historyTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  viewAll: {
    color: "#1e3a8a",
  },
  item: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  orangeBorder: {
    borderLeftWidth: 4,
    borderLeftColor: "#f97316",
  },
  itemTitle: {
    fontWeight: "bold",
    flex: 1,
    marginRight: 8,
  },
  empty: {
    padding: 30,
    alignItems: "center",
  },
  emptyText: {
    color: "#94a3b8",
  },
  tab: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 30,
    padding: 20,
    backgroundColor: "#fff",
    borderRadius: 20,
  },
  activeTab: {
    color: "#1e3a8a",
    fontWeight: "bold",
  },
});
