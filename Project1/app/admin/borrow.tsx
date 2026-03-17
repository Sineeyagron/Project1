import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";

export default function Borrow(){

return(

<ScrollView style={styles.container}>

<Text style={styles.title}>จัดการยืม</Text>

<View style={styles.row}>
<Text>ค้นหา</Text>
<TouchableOpacity style={styles.deviceBtn}>
<Text>จัดการอุปกรณ์</Text>
</TouchableOpacity>
</View>

<Text style={styles.date}>22/05/69</Text>

<View style={styles.card}>
<Text>65301234   Arduino</Text>
</View>

<View style={styles.card}>
<Text>65301235   Sensor</Text>
</View>

<Text style={styles.date}>23/05/69</Text>

<View style={styles.card}>
<Text>65301231   ESP32</Text>
</View>

</ScrollView>

);
}

const styles = StyleSheet.create({

container:{
flex:1,
backgroundColor:"#eee",
padding:20
},

title:{
fontSize:28,
textAlign:"center",
marginBottom:20
},

row:{
flexDirection:"row",
justifyContent:"space-between",
marginBottom:20
},

deviceBtn:{
backgroundColor:"#ff8c8c",
padding:10,
borderRadius:10
},

date:{
marginTop:20,
marginBottom:10
},

card:{
backgroundColor:"#c7d8e6",
padding:20,
borderRadius:12,
marginBottom:10
}

});