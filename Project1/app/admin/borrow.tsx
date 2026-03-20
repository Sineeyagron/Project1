import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal
} from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";
import { useEffect } from "react";

type BorrowItem = {
  id: string;
  item: string;
  date: string;
  returnDate: string;
  show: boolean;
};

export default function Borrow() {

  const router = useRouter();

  const [search,setSearch] = useState("");

  const [data,setData] = useState<BorrowItem[]>([
    {
      id:"65301234",
      item:"Arduino",
      date:"22/05/69",
      returnDate:"25/05/69",
      show:false
    },
    {
      id:"65301235",
      item:"Sensor",
      date:"22/05/69",
      returnDate:"25/05/69",
      show:false
    },
    {
      id:"65301231",
      item:"ESP32",
      date:"23/05/69",
      returnDate:"26/05/69",
      show:false
    }
  ]);

  // ✅ ต้องอยู่ใน function เท่านั้น
  const [editModal,setEditModal] = useState(false);
  const [editData,setEditData] = useState<BorrowItem | null>(null);

  const filtered = data.filter(d =>
    d.id.includes(search)
  );

  function toggle(id: string){
    const newData = data.map(item =>
      item.id === id ? {...item, show: !item.show} : item
    );
    setData(newData);
  }

  // ✅ เปิดแก้ไข
  function openEdit(item: BorrowItem){
    setEditData(item);
    setEditModal(true);
  }

  // ✅ บันทึก
  function saveEdit(){
    if(!editData) return;

    const newData = data.map(d =>
      d.id === editData.id ? editData : d
    );

    setData(newData);
    setEditModal(false);
  }

  return(

<View style={styles.container}>

<Text style={styles.title}>จัดการยืม</Text>

<View style={styles.row}>
<TextInput
placeholder="ค้นหา"
value={search}
onChangeText={setSearch}
style={styles.search}
/>

<TouchableOpacity
style={styles.btn}
onPress={()=>router.push("/admin/device")}
>
<Text style={{color:"#fff"}}>จัดการอุปกรณ์</Text>
</TouchableOpacity>
</View>

<ScrollView>

{filtered.map((item)=>(

<View key={item.id}>

<Text style={{marginTop:10}}>{item.date}</Text>

<TouchableOpacity
style={styles.card}
onPress={()=>toggle(item.id)}
>

<Text>{item.id}   {item.item}</Text>

{item.show && (
<View>

<Text>วันที่ยืม: {item.date}</Text>
<Text>วันที่คืน: {item.returnDate}</Text>

{/* 🔥 ปุ่มแก้ไข */}
<TouchableOpacity
style={styles.editBtn}
onPress={()=>openEdit(item)}
>
<Text style={{color:"#fff"}}>แก้ไข</Text>
</TouchableOpacity>

</View>
)}

</TouchableOpacity>

</View>

))}

</ScrollView>

{/* 🔻 navbar */}
<View style={styles.navbar}>
<TouchableOpacity onPress={()=>router.push("/admin/home")}>
<Text>ห้องเรียน</Text>
</TouchableOpacity>

<TouchableOpacity onPress={()=>router.push("/admin/scan")}>
<Text>สแกน</Text>
</TouchableOpacity>

<TouchableOpacity onPress={()=>router.push("/admin/borrow")}>
<Text>การยืม</Text>
</TouchableOpacity>
</View>

{/* 🔥 Modal แก้ไข */}
<Modal visible={editModal} transparent>

<View style={styles.modalBg}>
<View style={styles.modalBox}>

<Text style={{fontSize:18}}>แก้ไขข้อมูล</Text>

<TextInput
value={editData?.item}
onChangeText={(text)=>
setEditData({...editData!,item:text})
}
style={styles.input}
/>

<TextInput
value={editData?.date}
onChangeText={(text)=>
setEditData({...editData!,date:text})
}
style={styles.input}
/>

<TextInput
value={editData?.returnDate}
onChangeText={(text)=>
setEditData({...editData!,returnDate:text})
}
style={styles.input}
/>

<TouchableOpacity style={styles.okBtn} onPress={saveEdit}>
<Text style={{color:"#fff"}}>บันทึก</Text>
</TouchableOpacity>

<TouchableOpacity
onPress={()=>setEditModal(false)}
style={{marginTop:10}}
>
<Text>ยกเลิก</Text>
</TouchableOpacity>

</View>
</View>

</Modal>

</View>
);
}

const styles = StyleSheet.create({
container:{flex:1,backgroundColor:"#eee",padding:20},
title:{fontSize:26,textAlign:"center",marginBottom:10},
row:{flexDirection:"row",marginBottom:10},
search:{flex:1,backgroundColor:"#c7d8e6",padding:10,borderRadius:10,marginRight:10},
btn:{backgroundColor:"#ff8c8c",padding:10,borderRadius:10},
card:{backgroundColor:"#bcd0df",padding:20,borderRadius:15,marginTop:10},

editBtn:{
backgroundColor:"red",
padding:10,
borderRadius:10,
marginTop:10,
alignItems:"center"
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
marginVertical:10
},

okBtn:{
backgroundColor:"green",
padding:10,
borderRadius:10,
alignItems:"center"
}

});