import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import { useRouter } from "expo-router";

export default function RoomMap(){

const router = useRouter();

return(

<View style={styles.container}>

<Text style={styles.title}>ผังห้อง</Text>

<View style={styles.mapBox}>

<Image
source={require("../assets/images/c01.png")}
style={styles.map}
/>

{/* C01 */}
<TouchableOpacity
style={[styles.pc,{top:260,left:90}]}
onPress={()=>alert("C01")}
>
<Text style={styles.pcText}>C01</Text>
</TouchableOpacity>

{/* C02 */}
<TouchableOpacity
style={[styles.pc,{top:260,left:160}]}
onPress={()=>alert("C02")}
>
<Text style={styles.pcText}>C02</Text>
</TouchableOpacity>

{/* C03 */}
<TouchableOpacity
style={[styles.pc,{top:200,left:210}]}
onPress={()=>alert("C03")}
>
<Text style={styles.pcText}>C03</Text>
</TouchableOpacity>

{/* C04 */}
<TouchableOpacity
style={[styles.pc,{top:120,left:210}]}
onPress={()=>alert("C04")}
>
<Text style={styles.pcText}>C04</Text>
</TouchableOpacity>

{/* C05 */}
<TouchableOpacity
style={[styles.pc,{top:120,left:140}]}
onPress={()=>alert("C05")}
>
<Text style={styles.pcText}>C05</Text>
</TouchableOpacity>

{/* C06 */}
<TouchableOpacity
style={[styles.pc,{top:120,left:70}]}
onPress={()=>alert("C06")}
>
<Text style={styles.pcText}>C06</Text>
</TouchableOpacity>

</View>


{/* ปุ่มกลุ่ม */}

<View style={styles.groupGrid}>

{[1,2,3,4,5,6,7,8].map((g)=>(

<TouchableOpacity
key={g}
style={styles.groupBtn}
onPress={()=>router.push(`./groups/group${g}`)}
>

<Text>กลุ่มที่ {g}</Text>

</TouchableOpacity>

))}

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
fontSize:26,
textAlign:"center",
marginBottom:10
},

mapBox:{
height:380,
backgroundColor:"#ddd",
borderRadius:10,
overflow:"hidden",
position:"relative",
marginBottom:20
},

map:{
width:"100%",
height:"100%",
resizeMode:"contain"
},

pc:{
position:"absolute",
backgroundColor:"#4da3ff",
padding:6,
borderRadius:8
},

pcText:{
color:"#fff",
fontWeight:"bold"
},

groupGrid:{
flexDirection:"row",
flexWrap:"wrap",
justifyContent:"space-between"
},

groupBtn:{
backgroundColor:"#9fb6d8",
padding:15,
borderRadius:12,
width:"48%",
marginBottom:12,
alignItems:"center"
}

});