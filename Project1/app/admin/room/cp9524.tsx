import { View,Text,Image,TouchableOpacity,StyleSheet } from "react-native"
import { useRouter } from "expo-router"
import * as ImagePicker from "expo-image-picker"
import { useState } from "react"

export default function CP9524(){

const router = useRouter()
const [roomImage,setRoomImage] = useState(require("../../../assets/images/room.png"))

async function pickImage(){

const result = await ImagePicker.launchImageLibraryAsync({
mediaTypes: ImagePicker.MediaTypeOptions.Images,
quality:1
})

if(!result.canceled){
setRoomImage({uri:result.assets[0].uri})
}

}

return(

<View style={styles.container}>

<Text style={styles.title}>ผังห้อง</Text>

<Image
source={roomImage}
style={styles.map}
/>

<TouchableOpacity style={styles.editBtn} onPress={pickImage}>
<Text style={{color:"#fff"}}>แก้ไข</Text>
</TouchableOpacity>

<View style={styles.grid}>

{[1,2,3,4,5,6,7,8].map((g)=>(
<TouchableOpacity
key={g}
style={styles.groupBtn}
onPress={()=>router.push(`./admin/group/group${g}`)}
>
<Text>กลุ่มที่ {g}</Text>
</TouchableOpacity>
))}

</View>

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
textAlign:"center",
marginBottom:20
},

map:{
width:"100%",
height:300,
resizeMode:"contain",
backgroundColor:"#ddd"
},

editBtn:{
backgroundColor:"red",
padding:10,
borderRadius:10,
alignSelf:"flex-end",
marginTop:10
},

grid:{
flexDirection:"row",
flexWrap:"wrap",
justifyContent:"space-between",
marginTop:30
},

groupBtn:{
backgroundColor:"#bcd0df",
padding:15,
borderRadius:12,
width:"45%",
marginBottom:10,
alignItems:"center"
}

})