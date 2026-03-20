import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function Scan(){

const [permission, requestPermission] = useCameraPermissions();
const router = useRouter();

useEffect(()=>{
requestPermission();
},[]);

if(!permission?.granted){
return <Text>ขอ permission กล้อง...</Text>;
}

async function handleScan({ data }: any){

// data = deviceId จาก QR
const studentId = "65301234"; // 🔥 เดี๋ยวค่อยทำ input จริง

await fetch("http://YOUR_IP:5000/api/borrow",{
method:"POST",
headers:{"Content-Type":"application/json"},
body: JSON.stringify({
studentId,
deviceId:data,
deviceName:"ESP32"
})
});

alert("ยืมสำเร็จ");

}

return(

<View style={styles.container}>

<Text style={styles.title}>สแกน</Text>

<CameraView
style={styles.camera}
onBarcodeScanned={handleScan}
/>

<TouchableOpacity
style={styles.addBtn}
onPress={()=>router.push("./admin/addDevice")}
>
<Text style={{color:"#fff"}}>เพิ่มอุปกรณ์</Text>
</TouchableOpacity>

<View style={styles.navbar}>
<Text>ห้องเรียน</Text>
<Text>สแกน</Text>
<Text>การยืม</Text>
</View>

</View>
);
}

const styles = StyleSheet.create({
container:{flex:1,backgroundColor:"#eee",padding:20},
title:{fontSize:26,textAlign:"center"},
camera:{height:300,marginVertical:20},
addBtn:{
backgroundColor:"#888",
padding:15,
borderRadius:10,
alignItems:"center"
},
navbar:{
position:"absolute",
bottom:0,
width:"100%",
flexDirection:"row",
justifyContent:"space-around",
backgroundColor:"#c7d8e6",
padding:15
}
});