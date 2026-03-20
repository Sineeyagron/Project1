import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView
} from "react-native";
import { useState } from "react";

type DeviceItem = {
  id: string;
  name: string;
  show: boolean;
};

export default function Device(){

const [search,setSearch] = useState("");
const [modal,setModal] = useState(false);
const [editModal,setEditModal] = useState(false);

const [newItem,setNewItem] = useState("");
const [editItem,setEditItem] = useState("");
const [editIndex,setEditIndex] = useState<number | null>(null);

const [devices,setDevices] = useState<DeviceItem[]>([
  {id:"A001",name:"Arduino",show:false},
  {id:"A002",name:"Sensor",show:false}
]);

const filtered = devices.filter(d =>
d.name.toLowerCase().includes(search.toLowerCase())
);

// ✅ toggle แบบปลอดภัย
function toggle(id: string){
const newData = devices.map(item =>
item.id === id ? {...item, show: !item.show} : item
);
setDevices(newData);
}

// ➕ เพิ่ม
function addDevice(){
if(newItem==="") return;

setDevices([
...devices,
{id:Date.now().toString(),name:newItem,show:false}
]);

setNewItem("");
setModal(false);
}

// ✏️ แก้ไข
function openEdit(index: number){
setEditIndex(index);
setEditItem(devices[index].name);
setEditModal(true);
}

function saveEdit(){
if(editIndex === null) return;

const newData = [...devices];
newData[editIndex].name = editItem;

setDevices(newData);
setEditModal(false);
}

// ❌ ลบ
function deleteItem(index: number){
const newData = devices.filter((_,i)=>i!==index);
setDevices(newData);
}

return(

<View style={styles.container}>

<Text style={styles.title}>จัดการอุปกรณ์</Text>

<View style={styles.row}>

<TextInput
placeholder="ค้นหา"
value={search}
onChangeText={setSearch}
style={styles.search}
/>

<TouchableOpacity
style={styles.addBtn}
onPress={()=>setModal(true)}
>
<Text style={{color:"#fff"}}>เพิ่ม</Text>
</TouchableOpacity>

</View>

<ScrollView>

{filtered.map((item,index)=>(

<View key={item.id} style={styles.card}>

<TouchableOpacity onPress={()=>toggle(item.id)}>
<Text>{item.id}   {item.name}</Text>
</TouchableOpacity>

{item.show && (
<View style={{marginTop:10}}>

<Text>สถานะ: ปกติ</Text>

<TouchableOpacity
style={styles.editBtn}
onPress={()=>openEdit(index)}
>
<Text style={{color:"#fff"}}>แก้ไข</Text>
</TouchableOpacity>

<TouchableOpacity
style={styles.deleteBtn}
onPress={()=>deleteItem(index)}
>
<Text style={{color:"#fff"}}>ลบ</Text>
</TouchableOpacity>

</View>
)}

</View>

))}

</ScrollView>

{/* เพิ่ม */}
<Modal visible={modal} transparent>
<View style={styles.modalBg}>
<View style={styles.modalBox}>
<Text>เพิ่มอุปกรณ์</Text>

<TextInput
value={newItem}
onChangeText={setNewItem}
style={styles.input}
/>

<TouchableOpacity style={styles.okBtn} onPress={addDevice}>
<Text style={{color:"#fff"}}>เพิ่ม</Text>
</TouchableOpacity>
</View>
</View>
</Modal>

{/* แก้ไข */}
<Modal visible={editModal} transparent>
<View style={styles.modalBg}>
<View style={styles.modalBox}>
<Text>แก้ไขอุปกรณ์</Text>

<TextInput
value={editItem}
onChangeText={setEditItem}
style={styles.input}
/>

<TouchableOpacity style={styles.okBtn} onPress={saveEdit}>
<Text style={{color:"#fff"}}>บันทึก</Text>
</TouchableOpacity>
</View>
</View>
</Modal>

</View>
);
}

const styles = StyleSheet.create({
container:{flex:1,padding:20,backgroundColor:"#eee"},
title:{fontSize:24,textAlign:"center",marginBottom:10},
row:{flexDirection:"row"},
search:{flex:1,backgroundColor:"#c7d8e6",padding:10,borderRadius:10,marginRight:10},
addBtn:{backgroundColor:"#ff8c8c",padding:10,borderRadius:10},
card:{backgroundColor:"#bcd0df",padding:20,borderRadius:15,marginTop:10},
editBtn:{backgroundColor:"red",padding:10,marginTop:10,borderRadius:10,alignItems:"center"},
deleteBtn:{backgroundColor:"#333",padding:10,marginTop:10,borderRadius:10,alignItems:"center"},
modalBg:{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"center",alignItems:"center"},
modalBox:{backgroundColor:"#fff",padding:20,borderRadius:10,width:"80%"},
input:{borderWidth:1,marginVertical:10,padding:10},
okBtn:{backgroundColor:"green",padding:10,borderRadius:10,alignItems:"center"}
});