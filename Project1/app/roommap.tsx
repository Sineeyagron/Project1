
@@ -1,153 +1,110 @@
import { View, Text, StyleSheet, TouchableOpacity, Image } from "react-native";
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from "react-native";
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