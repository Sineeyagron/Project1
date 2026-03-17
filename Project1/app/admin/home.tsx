import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

export default function AdminHome(){

const router = useRouter();

return(

<View style={styles.container}>

<Text style={styles.title}>จัดการห้องเรียน</Text>

<View style={styles.searchRow}>
<Text>ค้นหา</Text>
<TouchableOpacity style={styles.addBtn}>
<Text>เพิ่มห้อง</Text>
</TouchableOpacity>
</View>

<TouchableOpacity
style={styles.room}
onPress={()=>router.push("./admin/room")}
>
<Text style={styles.roomText}>CP9524</Text>
</TouchableOpacity>

<TouchableOpacity
style={styles.room}
onPress={()=>router.push("./admin/room")}
>
<Text style={styles.roomText}>SC9604</Text>
</TouchableOpacity>

<View style={styles.navbar}>

<TouchableOpacity onPress={()=>router.push("./admin/home")}>
<Text>ห้องเรียน</Text>
</TouchableOpacity>

<TouchableOpacity onPress={()=>router.push("./admin/scan")}>
<Text>สแกน</Text>
</TouchableOpacity>

<TouchableOpacity onPress={()=>router.push("./admin/borrow")}>
<Text>การยืม</Text>
</TouchableOpacity>

</View>

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
justifyContent:"space-between",
marginBottom:20
},

addBtn:{
backgroundColor:"#ff8c8c",
padding:10,
borderRadius:10
},

room:{
backgroundColor:"#bcd0df",
padding:40,
borderRadius:20,
marginBottom:20,
alignItems:"center"
},

roomText:{
fontSize:28
},

navbar:{
position:"absolute",
bottom:0,
width:"100%",
flexDirection:"row",
justifyContent:"space-around",
backgroundColor:"#c7d8e6",
padding:15
}

});