
@@ -0,0 +1,90 @@
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity
} from "react-native";
import { useRouter } from "expo-router";

export default function Settings(){

  const router = useRouter();

  return(

<View style={styles.container}>

{/* 🔙 back */}
<TouchableOpacity onPress={()=>router.back()}>
  <Text style={styles.back}>←</Text>
</TouchableOpacity>

<Text style={styles.title}>Settings</Text>

<view style={styles.profileBox}>
  <Text style={styles.name}>Kittisak Azure</Text>
  <Text style={styles.role}>Inventory Manager</Text>
</view>

{/* ⚙️ menu */}
<View style={styles.menu}>
  <Text>Edit Profile</Text>
</View>

{/* 🔴 logout */}
<TouchableOpacity style={styles.logout}>
  <Text style={{color:"red"}}>LOGOUT</Text>
</TouchableOpacity>

</View>

  );
}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:"#f4f6f8",
padding:20
},