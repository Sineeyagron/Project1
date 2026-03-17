import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useState } from "react";
import { useRouter } from "expo-router";

export default function Signup(){

const router = useRouter();

const [username,setUsername] = useState("");
const [email,setEmail] = useState("");
const [password,setPassword] = useState("");

const register = () => {

alert("สมัครสมาชิกสำเร็จ");

router.push("/home");

}

return(

<View style={styles.container}>

<Text style={styles.title}>Create Account</Text>

<TextInput
style={styles.input}
placeholder="Username"
onChangeText={setUsername}
/>

<TextInput
style={styles.input}
placeholder="Email"
onChangeText={setEmail}
/>

<TextInput
style={styles.input}
placeholder="Password"
secureTextEntry
onChangeText={setPassword}
/>

<TouchableOpacity style={styles.button} onPress={register}>
<Text style={styles.btnText}>Sign Up</Text>
</TouchableOpacity>

</View>

);

}

const styles = StyleSheet.create({

container:{
flex:1,
justifyContent:"center",
padding:30,
backgroundColor:"#F5F5F5"
},

title:{
fontSize:28,
textAlign:"center",
marginBottom:30,
fontWeight:"600"
},

input:{
backgroundColor:"#fff",
padding:15,
borderRadius:12,
marginBottom:15,
borderWidth:1,
borderColor:"#ddd"
},

button:{
backgroundColor:"#4CAF50",
padding:15,
borderRadius:12
},

btnText:{
color:"#fff",
textAlign:"center",
fontSize:16,
fontWeight:"600"
}

});