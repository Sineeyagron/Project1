import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function CP9524(){

const router = useRouter();

return(

<View style={styles.container}>

<Text style={styles.title}>ผังห้อง CP9524</Text>

<View style={styles.grid}>

{[1,2,3,4,5,6,7,8].map((g)=>(
<TouchableOpacity
key={g}
style={styles.group}
onPress={()=>router.push(`./groups/group${g}`)}
>
<Text>กลุ่ม {g}</Text>
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
marginBottom:20
},

grid:{
flexDirection:"row",
flexWrap:"wrap",
justifyContent:"space-between"
},

group:{
width:"48%",
backgroundColor:"#9fb6d8",
padding:25,
borderRadius:15,
marginBottom:15,
alignItems:"center"
}

});