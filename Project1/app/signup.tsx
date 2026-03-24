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

});@ -1,94 +1,149 @@
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { useState } from "react";
import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform} from "react-native";
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

import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

export default function Signup() {
  const router = useRouter();

  // สร้าง State สำหรับเก็บค่า input
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSignup = () => {
    // เมื่อสมัครสำเร็จ ให้เปลี่ยนหน้าไปที่ Home ทันที
    router.replace("/home"); 
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Logo Section */}
          <View style={styles.logoBox}>
            <Ionicons name="grid" size={30} color="#fff" />
          </View>

          <View style={styles.headerSection}>
            <Text style={styles.brandTitle}>INTELLIGENT LEDGER</Text>
            <Text style={styles.brandSubtitle}>BEGIN YOUR CURATORIAL JOURNEY</Text>
          </View>

          {/* Form Section */}
          <View style={styles.form}>
            
            <Text style={styles.label}>FULL NAME</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#94a3b8" style={styles.icon} />
              <TextInput
                placeholder="Alex Sterling"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                onChangeText={setFullName}
              />
            </View>

            <Text style={styles.label}>EMAIL ADDRESS</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="at-outline" size={20} color="#94a3b8" style={styles.icon} />
              <TextInput
                placeholder="alex@ledger.ai"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                keyboardType="email-address"
                autoCapitalize="none"
                onChangeText={setEmail}
              />
            </View>

            <Text style={styles.label}>PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="lock-closed-outline" size={20} color="#94a3b8" style={styles.icon} />
              <TextInput
                placeholder="••••••••••••"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                secureTextEntry
                onChangeText={setPassword}
              />
              <Ionicons name="eye-outline" size={20} color="#94a3b8" />
            </View>

            <Text style={styles.label}>CONFIRM PASSWORD</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#94a3b8" style={styles.icon} />
              <TextInput
                placeholder="••••••••••••"
                placeholderTextColor="#94a3b8"
                style={styles.input}
                secureTextEntry
                onChangeText={setConfirmPassword}
              />
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity style={styles.signupBtn} onPress={handleSignup}>
              <Text style={styles.btnText}>Sign Up</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.agreementText}>
              By creating an account, you agree to our{" "}
              <Text style={styles.linkText}>Terms of Service</Text> and{" "}
              <Text style={styles.linkText}>Privacy Policy</Text>.
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.push("/login")}>
              <Text style={styles.loginLink}>Log In</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.poweredText}>POWERED BY INTEGRATED CORE SYSTEMS</Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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

  container: { flex: 1, backgroundColor: "#f8fafc" },
  scrollContent: { paddingHorizontal: 30, paddingTop: 40, paddingBottom: 40, alignItems: "center" },
  logoBox: {
    width: 60, height: 60, backgroundColor: "#063970", borderRadius: 15,
    justifyContent: "center", alignItems: "center", marginBottom: 25,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 5, elevation: 5,
  },
  headerSection: { alignItems: "center", marginBottom: 35 },
  brandTitle: { fontSize: 24, fontWeight: "bold", color: "#063970", letterSpacing: -0.5 },
  brandSubtitle: { fontSize: 10, color: "#94a3b8", letterSpacing: 1, marginTop: 5, fontWeight: "600" },
  form: { width: "100%" },
  label: { fontSize: 10, fontWeight: "bold", color: "#64748b", marginBottom: 8, marginLeft: 2 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#f1f5f9",
    borderRadius: 15, paddingHorizontal: 15, height: 55, marginBottom: 20,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: "#1e293b" },
  signupBtn: {
    backgroundColor: "#063970", height: 60, borderRadius: 15,
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    marginTop: 10, gap: 10, shadowColor: "#063970", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
  },
  btnText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
  agreementText: { textAlign: "center", fontSize: 11, color: "#64748b", lineHeight: 18, marginTop: 20, paddingHorizontal: 10 },
  linkText: { color: "#063970", fontWeight: "bold" },
  footer: { flexDirection: "row", marginTop: 35, alignItems: "center" },
  footerText: { color: "#64748b", fontSize: 14 },
  loginLink: { color: "#063970", fontWeight: "bold", fontSize: 14 },
  poweredText: { marginTop: 40, fontSize: 9, color: "#cbd5e1", letterSpacing: 1.5, fontWeight: "bold" },
});