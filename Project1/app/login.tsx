import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";

export default function Login(){

const router = useRouter();

return(

<View style={styles.container}>

<Image
source={require("../assets/images/logo.png")}
style={styles.logo}
/>

<Text style={styles.title}>Log in</Text>

<TextInput
placeholder="Email"
style={styles.input}
/>

<TextInput
placeholder="Password"
style={styles.input}
secureTextEntry
/>

<TouchableOpacity
style={styles.loginBtn}
onPress={()=>router.push("/home")}
>
<Text style={styles.btnText}>Log in</Text>
</TouchableOpacity>

<TouchableOpacity onPress={()=>router.push("./loginAdmin")}>
<Text style={styles.adminBtn}>Admin</Text>
</TouchableOpacity>

</View>

);
}

const styles = StyleSheet.create({

container:{
flex:1,
justifyContent:"center",
alignItems:"center",
backgroundColor:"#eee"
},

logo:{
width:140,
height:140,
marginBottom:20
},

title:{
fontSize:30,
marginBottom:20
},

input:{
width:"80%",
backgroundColor:"#b8cbe0",
padding:15,
borderRadius:12,
marginBottom:15
},

loginBtn:{
backgroundColor:"#114d8b",
padding:15,
borderRadius:12,
width:"80%",
alignItems:"center"
},

btnText:{
color:"#fff",
fontSize:20
},

adminBtn:{
position:"absolute",
top:60,
right:20,
backgroundColor:"#b8cbe0",
padding:10,
borderRadius:10
}

});