import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="home" />
      <Stack.Screen name="roommap" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="sittings" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="borrow" />
    </Stack>
  );
}