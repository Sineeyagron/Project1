import React, { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet
} from "react-native";
import { useRouter } from "expo-router";

export default function Signup() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Signup</Text>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.replace("/login")}
      >
        <Text style={{ color: "#fff" }}>Back Login</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container:{flex:1,justifyContent:"center",alignItems:"center"},
  btn:{backgroundColor:"green",padding:15,borderRadius:10},
  title:{fontSize:24}
});