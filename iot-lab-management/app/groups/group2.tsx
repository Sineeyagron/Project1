import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";

export default function Group1(){

const router = useRouter();

const pcs = ["C01","C02","C03","C04","C05","C06"];

return(

<View style={styles.container}>

<Text style={styles.title}>กลุ่มที่ 1</Text>

<View style={styles.pcGrid}>

{pcs.map((pc)=>(
<TouchableOpacity
key={pc}
style={styles.pc}
onPress={()=>router.push(`./device/deviceList?pc=${pc}`)}
>
<Text>{pc}</Text>
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
fontSize:24,
textAlign:"center",
marginBottom:20
},

pcGrid:{
flexDirection:"row",
flexWrap:"wrap",
justifyContent:"space-between"
},

pc:{
width:"30%",
backgroundColor:"#ff8c2b",
padding:20,
borderRadius:10,
marginBottom:15,
alignItems:"center"
}

});