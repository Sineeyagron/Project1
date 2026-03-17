import { View,Text,Image,TouchableOpacity,StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import { useState } from "react"

export default function Group1(){

const router = useRouter()

const [rack,setRack] = useState(require("../../../assets/images/rack.png"))
const [desk,setDesk] = useState(require("../../../assets/images/c01.png"))

async function pickRack(){

const result = await ImagePicker.launchImageLibraryAsync({})

if(!result.canceled){
setRack({uri:result.assets[0].uri})
}

}

async function pickDesk(){

const result = await ImagePicker.launchImageLibraryAsync({})

if(!result.canceled){
setDesk({uri:result.assets[0].uri})
}

}

return(

<View style={styles.container}>

<Text style={styles.title}>กลุ่มที่ 1</Text>

<Image source={rack} style={styles.rack}/>

<TouchableOpacity style={styles.editBtn} onPress={pickRack}>
<Text>แก้ไข</Text>
</TouchableOpacity>

<Image source={desk} style={styles.desk}/>

<TouchableOpacity style={styles.editBtn} onPress={pickDesk}>
<Text>แก้ไข</Text>
</TouchableOpacity>

<View style={styles.list}>

<Text>C01 ปกติ</Text>
<Text>C02 ปกติ</Text>
<Text style={{color:"red"}}>C03 ซ่อมบำรุง</Text>
<Text>C04 ปกติ</Text>
<Text style={{color:"red"}}>C05 ซ่อมบำรุง</Text>
<Text>C06 ปกติ</Text>

</View>

<TouchableOpacity
style={styles.statusBtn}
onPress={()=>router.push("./admin/status/editStatus")}
>
<Text style={{color:"#fff"}}>แก้ไขสถานะ</Text>
</TouchableOpacity>

</View>

)
}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:"#eee",
padding:20
},

title:{
fontSize:26,
textAlign:"center"
},

rack:{
width:"100%",
height:200,
resizeMode:"contain"
},

desk:{
width:"100%",
height:200,
resizeMode:"contain"
},

editBtn:{
backgroundColor:"red",
padding:10,
borderRadius:10,
alignSelf:"flex-end",
marginBottom:10
},

list:{
marginTop:20
},

statusBtn:{
backgroundColor:"red",
padding:15,
borderRadius:10,
marginTop:20,
alignItems:"center"
}

})