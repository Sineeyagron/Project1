import {
View,
Text,
TextInput,
TouchableOpacity,
StyleSheet,
Image
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";

export default function AddDevice(){

const [name,setName] = useState("");
const [qty,setQty] = useState("");
const [image,setImage] = useState<any>(null);

async function pickImage(){
const result = await ImagePicker.launchImageLibraryAsync({
mediaTypes: ImagePicker.MediaTypeOptions.Images,
quality:1
});

if(!result.canceled){
setImage(result.assets[0].uri);
}
}

async function saveDevice(){

const data = {
name,
qty,
image
};

await fetch("http://YOUR_IP:5000/api/device",{
method:"POST",
headers:{"Content-Type":"application/json"},
body: JSON.stringify(data)
});

alert("เพิ่มสำเร็จ");
}

return(

<View style={styles.container}>

<Text style={styles.title}>เพิ่มอุปกรณ์</Text>

<TouchableOpacity onPress={pickImage}>
{image ? (
<Image source={{uri:image}} style={styles.img}/>
) : (
<View style={styles.img}><Text>เลือกรูป</Text></View>
)}
</TouchableOpacity>

<TextInput
placeholder="ชื่ออุปกรณ์"
value={name}
onChangeText={setName}
style={styles.input}
/>

<TextInput
placeholder="จำนวน"
value={qty}
onChangeText={setQty}
style={styles.input}
/>

<View style={styles.row}>

<TouchableOpacity style={styles.cancel}>
<Text style={{color:"#fff"}}>ยกเลิก</Text>
</TouchableOpacity>

<TouchableOpacity style={styles.ok} onPress={saveDevice}>
<Text style={{color:"#fff"}}>เพิ่ม</Text>
</TouchableOpacity>

</View>

</View>
);
}

const styles = StyleSheet.create({
container:{flex:1,padding:20,backgroundColor:"#eee"},
title:{fontSize:24,textAlign:"center"},
img:{height:150,backgroundColor:"#ccc",marginVertical:20,justifyContent:"center",alignItems:"center"},
input:{backgroundColor:"#c7d8e6",padding:10,marginVertical:10},
row:{flexDirection:"row",justifyContent:"space-between"},
cancel:{backgroundColor:"red",padding:15},
ok:{backgroundColor:"#0b3c6f",padding:15}
});