import { View,Text,StyleSheet,TouchableOpacity,ScrollView,Alert } from "react-native"
import { useState } from "react"
import { useRouter } from "expo-router"

export default function EditStatus(){

const router = useRouter()

const [computers,setComputers] = useState<any[]>([
{id:"c01",status:"ปกติ",history:["22/05/69 - เปลี่ยน RAM","25/05/69 - ล้างเครื่อง"]},
{id:"c02",status:"ปกติ",history:[]},
{id:"c03",status:"ซ่อมบำรุง",history:["22/05/69 - เปลี่ยน PSU"]},
{id:"c04",status:"ปกติ",history:[]},
{id:"c05",status:"ซ่อมบำรุง",history:[]},
{id:"c06",status:"ปกติ",history:[]}
])

function changeStatus(index:number,status:string){

const newData = [...computers]
newData[index].status = status
setComputers(newData)
}

function showHistory(history:string[]){

if(history.length === 0){
Alert.alert("ไม่มีประวัติซ่อม")

return
}
Alert.alert("ประวัติการซ่อม",history.join("\n"))

}

function saveStatus(){

Alert.alert("บันทึกสำเร็จ")

/*
ตรงนี้อนาคตจะส่งไป Backend

POST /computer-status
*/

}

return(

<ScrollView style={styles.container}>

<Text style={styles.title}>แก้ไขสถานะ กลุ่มที่ 1</Text>

{computers.map((item,index)=>(
<View key={item.id} style={styles.card}>

<View style={styles.row}>

<TouchableOpacity onPress={()=>showHistory(item.history)}>
<Text style={styles.comName}>{item.id.toUpperCase()}</Text>
</TouchableOpacity>

<View style={styles.btnRow}>

<TouchableOpacity
style={[
styles.statusBtn,
item.status==="ปกติ" && styles.activeNormal
]}
onPress={()=>changeStatus(index,"ปกติ")}
>
<Text>ปกติ</Text>
</TouchableOpacity>

<TouchableOpacity
style={[
styles.statusBtn,
item.status==="ซ่อมบำรุง" && styles.activeRepair
]}
onPress={()=>changeStatus(index,"ซ่อมบำรุง")}
>
<Text style={{color:"red"}}>ซ่อมบำรุง</Text>
</TouchableOpacity>

</View>

</View>

</View>
))}

<TouchableOpacity style={styles.saveBtn} onPress={saveStatus}>
<Text style={{color:"#fff"}}>บันทึก</Text>
</TouchableOpacity>

<TouchableOpacity
style={styles.homeBtn}
onPress={()=>router.push("./admin/home")}
>
<Text style={{color:"#fff"}}>กลับหน้า home</Text>
</TouchableOpacity>

</ScrollView>

)
}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:"#eee",
padding:20
},

title:{
fontSize:24,
textAlign:"center",
marginBottom:20
},

card:{
backgroundColor:"#bcd0df",
padding:15,
borderRadius:12,
marginBottom:15
},

row:{
flexDirection:"row",
justifyContent:"space-between",
alignItems:"center"
},

comName:{
fontSize:18
},

btnRow:{
flexDirection:"row"
},

statusBtn:{
backgroundColor:"#d8e3f1",
padding:8,
borderRadius:8,
marginLeft:10
},

activeNormal:{
backgroundColor:"#a6c3e5"
},

activeRepair:{
backgroundColor:"#ffdada"
},

saveBtn:{
backgroundColor:"green",
padding:15,
borderRadius:10,
alignItems:"center",
marginTop:20
},

homeBtn:{
backgroundColor:"#114d8b",
padding:15,
borderRadius:10,
alignItems:"center",
marginTop:15
}

})