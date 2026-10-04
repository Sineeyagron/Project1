import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "../../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../../lib/supabase";
import { goBack } from "../../lib/nav";
import { confirmAction, notify } from "../../lib/notify";
import { W, NG } from "../../lib/theme";

// จัดการหมวดหมู่อุปกรณ์ (แผน 2.2.1): เพิ่ม / แก้ชื่อ / เลื่อนลำดับ / ปิด-เปิด / ลบ
// ลบหมวดที่มีของ (รวมของที่จำหน่ายแล้ว) ต้องเลือกหมวดปลายทางก่อน → ย้ายของทั้งหมดไป แล้วค่อยลบ ไม่มีของหลุดหมวด
// "อื่นๆ" เป็นหมวดสำรองของแอป (ของที่ไม่มีหมวดตกมาที่นี่) จึงแก้ชื่อ/ปิด/ลบไม่ได้

const C = {
  bg: "#EAF1FC",
  purple: "#2563EB",
  ink: "#172033",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#DCE6F5",
  red: "#dc2626",
};

const OTHER = "อื่นๆ";

type Category = { id: string; name: string; sort_order: number; active: boolean; inUse: number; total: number };

// ชื่อซ้ำ (ไม่สนตัวพิมพ์) ชน unique index → แปลข้อความให้อ่านรู้เรื่อง
function errorText(error: any) {
  return error?.code === "23505" ? "มีหมวดชื่อนี้อยู่แล้ว" : error?.message || "ลองใหม่อีกครั้ง";
}

export default function AdminCategories() {
  const router = useRouter();
  const [list, setList] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [moveFromId, setMoveFromId] = useState<string | null>(null);

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    const [{ data: cats, error }, { data: items }] = await Promise.all([
      supabase.from("categories").select("id, name, sort_order, active").order("sort_order").order("name"),
      supabase.from("items").select("category_id, status"),
    ]);
    if (error) notify("โหลดหมวดหมู่ไม่สำเร็จ", error.message);
    const inUse: Record<string, number> = {};
    const total: Record<string, number> = {};
    (items || []).forEach((i: any) => {
      if (!i.category_id) return;
      total[i.category_id] = (total[i.category_id] || 0) + 1;
      if (i.status !== "retired") inUse[i.category_id] = (inUse[i.category_id] || 0) + 1;
    });
    setList((cats || []).map((c: any) => ({ ...c, inUse: inUse[c.id] || 0, total: total[c.id] || 0 })));
    setLoading(false);
    setRefreshing(false);
  };

  const run = async (task: () => PromiseLike<{ error: any }>, failTitle: string) => {
    setBusy(true);
    const { error } = await task();
    setBusy(false);
    if (error) {
      notify(failTitle, errorText(error));
      return false;
    }
    await load();
    return true;
  };

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    const nextOrder = Math.max(0, ...list.map((c) => c.sort_order)) + 1;
    const ok = await run(() => supabase.from("categories").insert({ name, sort_order: nextOrder }), "เพิ่มหมวดไม่สำเร็จ");
    if (ok) setNewName("");
  };

  const startEdit = (c: Category) => {
    setEditId(c.id);
    setEditName(c.name);
  };

  const saveEdit = async (c: Category) => {
    const name = editName.trim();
    if (!name || name === c.name) {
      setEditId(null);
      return;
    }
    // ของเก่าบางชิ้นจับหมวดจากช่อง type → แก้ตามด้วย ชื่อหมวดบนการ์ดจะได้ตรงกัน
    const ok = await run(async () => {
      const res = await supabase.from("categories").update({ name }).eq("id", c.id);
      if (res.error) return res;
      return supabase.from("items").update({ type: name }).eq("category_id", c.id);
    }, "แก้ชื่อไม่สำเร็จ");
    if (ok) setEditId(null);
  };

  // สลับลำดับกับหมวดข้างเคียง
  const move = (index: number, dir: -1 | 1) => {
    const a = list[index];
    const b = list[index + dir];
    if (!a || !b) return;
    // ลำดับเดิมอาจซ้ำกัน (เช่น 0 ทั้งคู่) → ใช้ตำแหน่งในรายการแทน
    run(async () => {
      const r1 = await supabase.from("categories").update({ sort_order: index + dir }).eq("id", a.id);
      if (r1.error) return r1;
      return supabase.from("categories").update({ sort_order: index }).eq("id", b.id);
    }, "เลื่อนลำดับไม่สำเร็จ");
  };

  const toggleActive = (c: Category) => {
    if (c.active) {
      confirmAction(
        `ปิดหมวด ${c.name}?`,
        "หมวดจะหายจากชิปและฟอร์มเพิ่มอุปกรณ์ ของที่อยู่ในหมวดนี้จะไปแสดงใน \"อื่นๆ\" เปิดกลับได้ทุกเมื่อ",
        "ปิดหมวด",
        () => run(() => supabase.from("categories").update({ active: false }).eq("id", c.id), "ปิดหมวดไม่สำเร็จ"),
        true
      );
    } else {
      run(() => supabase.from("categories").update({ active: true }).eq("id", c.id), "เปิดหมวดไม่สำเร็จ");
    }
  };

  const remove = (c: Category) => {
    if (c.total > 0) {
      // มีของอยู่ → เปิดแถวเลือกหมวดปลายทางใต้การ์ด
      setEditId(null);
      setMoveFromId(moveFromId === c.id ? null : c.id);
      return;
    }
    confirmAction(
      `ลบหมวด ${c.name}?`,
      "หมวดนี้ไม่มีอุปกรณ์ ลบแล้วกู้คืนไม่ได้",
      "ลบ",
      () => run(() => supabase.from("categories").delete().eq("id", c.id), "ลบหมวดไม่สำเร็จ"),
      true
    );
  };

  const moveAndRemove = (from: Category, to: Category) => {
    confirmAction(
      `ย้ายไป ${to.name} แล้วลบ ${from.name}?`,
      `อุปกรณ์ ${from.total} ชิ้นในหมวด ${from.name} (รวมของที่จำหน่ายแล้ว) จะย้ายไปหมวด ${to.name} จากนั้นหมวด ${from.name} จะถูกลบ กู้คืนไม่ได้`,
      "ย้ายและลบ",
      async () => {
        const ok = await run(async () => {
          const moved = await supabase.from("items").update({ category_id: to.id, type: to.name }).eq("category_id", from.id);
          if (moved.error) return moved;
          return supabase.from("categories").delete().eq("id", from.id);
        }, "ย้ายและลบไม่สำเร็จ");
        if (ok) setMoveFromId(null);
      },
      true
    );
  };

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={s.header}>
        <TouchableOpacity style={s.iconBtn} onPress={() => goBack("/admin/home")} activeOpacity={0.82}>
          <Ionicons name="chevron-back" size={22} color="#172033" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>หมวดหมู่อุปกรณ์</Text>
          <Text style={s.headerSub}>เพิ่ม แก้ชื่อ เรียงลำดับ หรือปิดหมวด</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={C.purple} style={{ marginTop: 44 }} />
      ) : (
        <ScrollView
          contentContainerStyle={s.body}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.purple} />}
        >
          <View style={s.addRow}>
            <TextInput
              style={s.input}
              value={newName}
              onChangeText={setNewName}
              placeholder="ชื่อหมวดใหม่ เช่น Actuator"
              placeholderTextColor={C.faint}
              returnKeyType="done"
              onSubmitEditing={add}
            />
            <TouchableOpacity
              style={[s.addBtn, (!newName.trim() || busy) && { opacity: 0.4 }]}
              disabled={!newName.trim() || busy}
              onPress={add}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={s.addBtnText}>เพิ่ม</Text>
            </TouchableOpacity>
          </View>

          {list.map((c, index) => {
            const locked = c.name === OTHER;
            const editing = editId === c.id;
            return (
              <View key={c.id} style={[s.cardWrap, !c.active && moveFromId !== c.id && s.cardOff]}>
              <View style={s.card}>
                <View style={s.orderCol}>
                  <TouchableOpacity disabled={index === 0 || busy} onPress={() => move(index, -1)} hitSlop={6}>
                    <Ionicons name="chevron-up" size={18} color={index === 0 ? "#cbd5e1" : C.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity disabled={index === list.length - 1 || busy} onPress={() => move(index, 1)} hitSlop={6}>
                    <Ionicons name="chevron-down" size={18} color={index === list.length - 1 ? "#cbd5e1" : C.muted} />
                  </TouchableOpacity>
                </View>

                {editing ? (
                  <View style={s.editRow}>
                    <TextInput
                      style={[s.input, { flex: 1 }]}
                      value={editName}
                      onChangeText={setEditName}
                      autoFocus
                      returnKeyType="done"
                      onSubmitEditing={() => saveEdit(c)}
                    />
                    <TouchableOpacity style={s.smallBtn} onPress={() => saveEdit(c)} disabled={busy}>
                      <Ionicons name="checkmark" size={18} color={C.purple} />
                    </TouchableOpacity>
                    <TouchableOpacity style={s.smallBtn} onPress={() => setEditId(null)}>
                      <Ionicons name="close" size={18} color={C.muted} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={{ flex: 1 }}>
                      <Text style={s.name}>{c.name}</Text>
                      <Text style={s.meta}>
                        {c.inUse} ชิ้น{!c.active ? " · ปิดอยู่" : ""}{locked ? " · หมวดสำรอง" : ""}
                      </Text>
                    </View>
                    {!locked && (
                      <>
                        <TouchableOpacity style={s.smallBtn} onPress={() => startEdit(c)} disabled={busy}>
                          <Ionicons name="pencil-outline" size={17} color={C.purple} />
                        </TouchableOpacity>
                        <TouchableOpacity style={s.smallBtn} onPress={() => toggleActive(c)} disabled={busy}>
                          <Ionicons name={c.active ? "eye-off-outline" : "eye-outline"} size={17} color={C.muted} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[s.smallBtn, moveFromId === c.id && s.smallBtnActive]}
                          onPress={() => remove(c)}
                          disabled={busy}
                        >
                          <Ionicons name="trash-outline" size={17} color={C.red} />
                        </TouchableOpacity>
                      </>
                    )}
                  </>
                )}
              </View>

              {moveFromId === c.id && (
                <View style={s.moveBox}>
                  <Text style={s.moveTitle}>
                    มีอุปกรณ์ {c.total} ชิ้น เลือกหมวดที่จะย้ายไปก่อนลบ
                  </Text>
                  <View style={s.moveChips}>
                    {list.filter((t) => t.id !== c.id).map((t) => (
                      <TouchableOpacity
                        key={t.id}
                        style={s.moveChip}
                        onPress={() => moveAndRemove(c, t)}
                        disabled={busy}
                        activeOpacity={0.8}
                      >
                        <Text style={s.moveChipText}>{t.name}{!t.active ? " (ปิดอยู่)" : ""}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TouchableOpacity onPress={() => setMoveFromId(null)} style={s.moveCancel}>
                    <Text style={s.moveCancelText}>ยกเลิก</Text>
                  </TouchableOpacity>
                </View>
              )}
              </View>
            );
          })}

          <Text style={s.hint}>
            ไอคอนตา = ปิด/เปิดหมวด (ซ่อนชั่วคราว) · ถังขยะ = ลบ ถ้ามีของต้องเลือกหมวดที่จะย้ายไปก่อน · เปลี่ยนหมวดของอุปกรณ์ได้ที่หน้าจัดการอุปกรณ์ (กดการ์ด)
          </Text>
        </ScrollView>
      )}

      {busy && (
        <View style={s.busyOverlay} pointerEvents="none">
          <ActivityIndicator color={C.purple} />
        </View>
      )}
    </KeyboardAvoidingView>
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
    ...W.small, width: 44, height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { color: "#172033", fontSize: 21, fontWeight: "900" },
  headerSub: { color: "#475569", fontSize: 12, fontWeight: "700", marginTop: 2 },
  body: { padding: 16, gap: 10 },
  addRow: { flexDirection: "row", gap: 8, marginBottom: 6 },
  input: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: C.ink,
  },
  addBtn: {
    ...W.primarySolid,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 15,
    paddingHorizontal: 16,
  },
  addBtnText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  cardWrap: {
    ...W.card,
    overflow: "hidden",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  smallBtnActive: { ...NG, backgroundColor: "#fee2e2" },
  moveBox: { borderTopWidth: 1, borderTopColor: C.line, backgroundColor: "#fff7f7", padding: 12, gap: 10 },
  moveTitle: { fontSize: 13.5, fontWeight: "700", color: C.red },
  moveChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  moveChip: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.purple,
    backgroundColor: "#fff",
  },
  moveChipText: { fontSize: 14, fontWeight: "700", color: C.purple },
  moveCancel: { alignSelf: "flex-start", paddingVertical: 6 },
  moveCancelText: { fontSize: 13.5, fontWeight: "700", color: C.muted },
  cardOff: { opacity: 0.55 },
  orderCol: { gap: 2 },
  editRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 16, fontWeight: "800", color: C.ink },
  meta: { fontSize: 12.5, color: C.muted, marginTop: 2 },
  smallBtn: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#f8fafc",
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { fontSize: 12, color: C.faint, lineHeight: 18, marginTop: 6 },
  busyOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.35)",
  },
});
