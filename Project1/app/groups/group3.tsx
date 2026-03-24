
@@ -0,0 +1,110 @@
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function Group1() {
  const router = useRouter();

  const inventory = [
    { id: "C01", name: "Core Router Alpha", serial: "AZ-9921-X", status: "ปกติ", time: "VERIFIED 2M AGO" },
    { id: "C02", name: "Switch Fabric B", serial: "AZ-8842-Y", status: "ปกติ", time: "VERIFIED 2M AGO" },
    { id: "C03", name: "Storage Array 01", serial: "AZ-7712-Z", status: "ซ่อมบำรุง", time: "SCHEDULED DOWN" },
    { id: "C04", name: "Compute Node G1", serial: "AZ-4451-A", status: "ปกติ", time: "VERIFIED 10M AGO" },
  ];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#063970" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>กลุ่มที่ 3</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.subTitle}>INFRASTRUCTURE VIEW</Text>
        <Text style={styles.mainTitle}>กลุ่มที่ 3</Text>
        <View style={styles.onlineStatus}>
          <View style={styles.dot} />
          <Text style={styles.onlineText}>SYSTEM ONLINE</Text>
        </View>

        {/* Dashboard Card */}
        <View style={styles.dashboardCard}>
          <View style={styles.dashHeader}>
             <View style={styles.dashIconBox}><Ionicons name="server-outline" size={20} color="#fff" /></View>
             <View>
                <Text style={styles.dashZone}>ZONE A-12</Text>
                <Text style={styles.dashTitle}>Main Distribution</Text>
             </View>