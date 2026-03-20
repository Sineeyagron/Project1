import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  ScrollView
} from "react-native";
import { useRouter } from "expo-router";
import { useState, useEffect } from "react";
import RoomCard from "../components/RoomCard";

const API = "http://192.168.0.244:5000"; // 🔥 เปลี่ยน IP

export default function AdminHome() {

  const router = useRouter();

  const [search, setSearch] = useState("");
  const [rooms, setRooms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [newRoom, setNewRoom] = useState("");

  // ✅ โหลดห้องจาก DB
  useEffect(() => {
    fetchRooms();
  }, []);

  async function fetchRooms() {
    try {
      setLoading(true);

      const res = await fetch(`${API}/api/room`);
      const data = await res.json();

      setRooms(data.map((r: any) => r.name));

    } catch (err) {
      console.log("โหลดห้องไม่ได้", err);
    } finally {
      setLoading(false);
    }
  }

  // ✅ เพิ่มห้อง
  async function addRoom() {
    if (newRoom.trim() === "") return;

    try {
      const res = await fetch(`${API}/api/room`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: newRoom }),
      });

      const data = await res.json();

      setRooms(prev => [...prev, data.name]);
      setNewRoom("");
      setModalVisible(false);

    } catch (err) {
      console.log(err);
    }
  }

  // 🔍 filter
  const filteredRooms = rooms.filter((room) =>
    room.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>

      <Text style={styles.title}>จัดการห้องเรียน</Text>

      {/* 🔍 search */}
      <View style={styles.searchRow}>
        <TextInput
          placeholder="ค้นหา"
          value={search}
          onChangeText={setSearch}
          style={styles.search}
        />

        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setModalVisible(true)}
        >
          <Text style={{ color: "#fff" }}>เพิ่มห้อง</Text>
        </TouchableOpacity>
      </View>

      {/* 🏫 list ห้อง */}
      <ScrollView>

        {loading && <Text>กำลังโหลด...</Text>}

        {filteredRooms.map((room, index) => (
          <RoomCard
            key={index}
            name={room}
            onPress={() =>
              router.push(`./admin/room/${room.toLowerCase()}`)
            }
          />
        ))}

      </ScrollView>

      {/* 🔻 navbar */}
      <View style={styles.navbar}>
        <TouchableOpacity onPress={() => router.push("/admin/home")}>
          <Text>ห้องเรียน</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/admin/scan")}>
          <Text>สแกน</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/admin/borrow")}>
          <Text>การยืม</Text>
        </TouchableOpacity>
      </View>

      {/* 🟢 Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalBg}>
          <View style={styles.modalBox}>
            <Text style={{ fontSize: 18 }}>เพิ่มห้อง</Text>

            <TextInput
              placeholder="ชื่อห้อง"
              value={newRoom}
              onChangeText={setNewRoom}
              style={styles.input}
            />

            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.okBtn} onPress={addRoom}>
                <Text style={{ color: "#fff" }}>เพิ่ม</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setModalVisible(false)}
              >
                <Text>ยกเลิก</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({

  container:{
    flex:1,
    backgroundColor:"#eee",
    padding:20
  },

  title:{
    fontSize:28,
    textAlign:"center",
    marginBottom:20
  },

  searchRow:{
    flexDirection:"row",
    marginBottom:20
  },

  search:{
    flex:1,
    backgroundColor:"#c7d8e6",
    padding:10,
    borderRadius:10,
    marginRight:10
  },

  addBtn:{
    backgroundColor:"#ff8c8c",
    padding:10,
    borderRadius:10
  },

  navbar:{
    position:"absolute",
    bottom:0,
    width:"100%",
    flexDirection:"row",
    justifyContent:"space-around",
    backgroundColor:"#c7d8e6",
    padding:15
  },

  modalBg:{
    flex:1,
    backgroundColor:"rgba(0,0,0,0.5)",
    justifyContent:"center",
    alignItems:"center"
  },

  modalBox:{
    backgroundColor:"#fff",
    padding:20,
    borderRadius:10,
    width:"80%"
  },

  input:{
    borderWidth:1,
    padding:10,
    marginVertical:10,
    borderRadius:8
  },

  modalRow:{
    flexDirection:"row",
    justifyContent:"space-between"
  },

  okBtn:{
    backgroundColor:"green",
    padding:10,
    borderRadius:8
  },

  cancelBtn:{
    padding:10
  }

});