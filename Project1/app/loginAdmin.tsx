import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";

export default function LoginAdmin(){

const router = useRouter();

return(

<View style={styles.container}>

<Image
source={require("../assets/images/logo.png")}
style={styles.logo}
/>

<Text style={styles.title}>Log in Admin</Text>

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
onPress={()=>router.push("./admin/home")}
>
<Text style={styles.btnText}>Log in</Text>
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
backgroundColor:"#c7d8e6",
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
}

});