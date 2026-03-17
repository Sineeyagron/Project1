import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useState } from "react";

export default function Home(){

const router = useRouter();
const [tab,setTab] = useState("room");

return(

<View style={styles.container}>

<Text style={styles.title}>
{tab === "room" ? "ห้องเรียน" : "การยืม"}
</Text>

<TouchableOpacity
style={styles.roomBtn}
onPress={()=>router.push("./roommap")}
>
<Text style={styles.roomText}>CP9524</Text>
</TouchableOpacity>

<TouchableOpacity
style={styles.roomBtn}
onPress={()=>router.push("./roommap")}
>
<Text style={styles.roomText}>SC9604</Text>
</TouchableOpacity>


<View style={styles.bottomBar}>

<TouchableOpacity
style={styles.tab}
onPress={()=>setTab("room")}
>
<Text>ห้องเรียน</Text>
</TouchableOpacity>

<TouchableOpacity
style={styles.tab}
onPress={()=>setTab("borrow")}
>
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
justifyContent:"center",
alignItems:"center"
},

title:{
fontSize:28,
marginBottom:40
},

roomBtn:{
backgroundColor:"#9fb6d8",
width:250,
padding:30,
borderRadius:20,
marginBottom:20,
alignItems:"center"
},

roomText:{
fontSize:24
},

bottomBar:{
position:"absolute",
bottom:0,
flexDirection:"row",
width:"100%"
},

tab:{
flex:1,
backgroundColor:"#9fb6d8",
padding:20,
alignItems:"center",
borderWidth:0.5
}

});