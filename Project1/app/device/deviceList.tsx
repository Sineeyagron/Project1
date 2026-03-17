import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";

export default function DeviceList(){

const {pc} = useLocalSearchParams();

const devices = [
{ name:"Raspberry Pi", status:"available"},
{ name:"ESP32", status:"borrowed"},
{ name:"Arduino", status:"available"},
{ name:"Sensor Kit", status:"available"}
];

return(

<View style={styles.container}>

<Text style={styles.title}>อุปกรณ์ของ {pc}</Text>

{devices.map((d,i)=>(

<View key={i} style={styles.device}>

<Text>{d.name}</Text>

<TouchableOpacity
style={[
styles.btn,
{backgroundColor:d.status==="available"?"green":"red"}
]}
>
<Text style={{color:"#fff"}}>
{d.status==="available"?"ยืม":"ถูกยืม"}
</Text>
</TouchableOpacity>

</View>

))}

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
marginBottom:20
},

device:{
flexDirection:"row",
justifyContent:"space-between",
backgroundColor:"#fff",
padding:15,
borderRadius:10,
marginBottom:10
},

btn:{
padding:8,
borderRadius:6
}

});