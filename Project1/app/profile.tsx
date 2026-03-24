@ -0,0 +1,152 @@
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image
} from "react-native";
import { useRouter } from "expo-router";

export default function Profile() {

  const router = useRouter();

  return (

<View style={styles.container}>

{/* 🔵 Header */}
<View style={styles.header}>
  <Text style={styles.headerText}>Profile</Text>

  <TouchableOpacity onPress={()=>router.push("./settings")}>
    <Text style={styles.gear}>⚙️</Text>
  </TouchableOpacity>
</View>

{/* 🧑 Profile */}
<View style={styles.profileBox}>

<Image
source={{uri:"https://cdn-icons-png.flaticon.com/512/149/149071.png"}}
style={styles.avatar}
/>

<Text style={styles.name}>Alex Thompson</Text>
<Text style={styles.email}>a.thompson@azure-inventory.com</Text>

</View>

{/* 📊 Stat */}
<View style={styles.stats}>

<View style={styles.card}>
<Text style={styles.number}>24</Text>
<Text>Total Borrows</Text>
</View>

<View style={styles.card}>
<Text style={styles.number}>02</Text>
<Text>Active Loans</Text>
</View>

</View>

{/* 📜 History */}
<Text style={styles.historyTitle}>Borrowing History</Text>

<View style={styles.item}>
<Text>Temperature Sensor (AA)</Text>
<Text style={styles.blue}>คืนแล้ว</Text>
</View>

<View style={styles.item}>
<Text>IoT Gateway Hub v2</Text>
<Text style={styles.red}>ล่าช้า</Text>
</View>

</View>
  );
}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:"#f4f6f8",
padding:20
},

header:{
flexDirection:"row",
justifyContent:"space-between",
alignItems:"center"
},

headerText:{
fontSize:24,
fontWeight:"bold"
},

gear:{
fontSize:24
},

profileBox:{
alignItems:"center",
marginVertical:20
},

avatar:{
width:120,
height:120,
borderRadius:60,
marginBottom:10
},

name:{
fontSize:22,
fontWeight:"bold"
},

email:{
color:"gray"
},

stats:{
flexDirection:"row",
justifyContent:"space-between"
},

card:{
backgroundColor:"#e3e7ec",
padding:20,
borderRadius:15,
width:"48%",
alignItems:"center"
},

number:{
fontSize:24,
fontWeight:"bold"
},

historyTitle:{
marginTop:20,
fontSize:18,
fontWeight:"bold"
},

item:{
backgroundColor:"#fff",
padding:15,
borderRadius:12,
marginTop:10,
flexDirection:"row",
justifyContent:"space-between"
},

blue:{color:"blue"},
red:{color:"red"}

});