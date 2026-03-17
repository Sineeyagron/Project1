import { View, Text, StyleSheet } from "react-native";
import { Camera } from "expo-camera";

export default function Scan(){

return(

<View style={styles.container}>

<Text style={styles.title}>สแกน</Text>

<View style={styles.camera}>
<Text>กล้อง</Text>
</View>

</View>

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
fontSize:28,
marginBottom:20
},

camera:{
width:250,
height:250,
backgroundColor:"#ccc",
justifyContent:"center",
alignItems:"center"
}

});