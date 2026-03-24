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
@@ -1,64 +1,110 @@
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from "react-native";
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
import { Ionicons } from "@expo/vector-icons";

export default function Group1() {
  const router = useRouter();

  const inventory = [
    { id: "C01", name: "Core Router Alpha", serial: "AZ-9921-X", status: "ปกติ", time: "VERIFIED 2M AGO" },
    { id: "C02", name: "Switch Fabric B", serial: "AZ-8842-Y", status: "ปกติ", time: "VERIFIED 2M AGO" },
    { id: "C03", name: "Storage Array 01", serial: "AZ-7712-Z", status: "ซ่อมบำรุง", time: "SCHEDULED DOWN" },
    { id: "C04", name: "Compute Node G1", serial: "AZ-4451-A", status: "ปกติ", time: "VERIFIED 10M AGO" },
  ];

  return (
    <SafeAreaView style={styles.container}></SafeAreaView>