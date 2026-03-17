import { View, Text, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { ScrollView } from "react-native";

export default function Group1(){

const router = useRouter();

return(

<ScrollView style={styles.container}>

<Text style={styles.title}>กลุ่มที่ 1</Text>

<Image
source={require("../../assets/images/rack.png")}
style={styles.rack}
/>

<Image
source={require("../../assets/images/c03.png")}
style={styles.rack}
/>

<View style={styles.card}>

<Text style={styles.pcTitle}>C01</Text>

<View style={styles.statusRow}>
<Text style={styles.ok}>ปกติ</Text>
<Text style={styles.fix}>ซ่อมบำรุง</Text>
</View>

<Text style={styles.history}>
ประวัติการซ่อม  
22/05/69 - 25/05/69
</Text>

</View>

<TouchableOpacity
style={styles.back}
onPress={()=>router.push("./roommap")}
>
<Text style={{color:"#fff"}}>กลับหน้า home</Text>
</TouchableOpacity>

</ScrollView>

);
}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:"#eee",
alignItems:"center",
paddingTop:40
},

title:{
fontSize:24,
marginBottom:20
},

rack:{
width:200,
height:350,
resizeMode:"contain"
},

pc:{
width:250,
height:150,
resizeMode:"contain",
marginTop:20
},

list:{
marginTop:20
},

back:{
backgroundColor:"#1f5a96",
padding:12,
borderRadius:10,
marginTop:20
}

});
