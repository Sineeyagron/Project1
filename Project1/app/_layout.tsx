import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";
import * as Linking from "expo-linking";
import supabase from "../lib/supabase";

export default function Layout() {
  const router = useRouter();

  useEffect(() => {
    const handleUrl = async (url: string) => {
      console.log("DEEPLINK:", url);

      const parsed = Linking.parse(url);

      const access_token = parsed.queryParams?.access_token;
      const refresh_token = parsed.queryParams?.refresh_token;

      if (access_token && refresh_token) {
        // ✅ แปลงให้เป็น string ก่อนส่งเข้า setSession
        const tokenA = Array.isArray(access_token) ? access_token[0] : access_token;
        const tokenR = Array.isArray(refresh_token) ? refresh_token[0] : refresh_token;

        await supabase.auth.setSession({
          access_token: tokenA,
          refresh_token: tokenR,
        });

        router.replace("/reset-password");
        return;
      }

      if (url.includes("reset-password")) {
        router.replace("/reset-password");
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const sub = Linking.addEventListener("url", ({ url }) => {
      handleUrl(url);
    });

    return () => sub.remove();
  }, []);

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
      <Stack.Screen name="forgot" />
      <Stack.Screen name="reset-password" />
    </Stack>
  );
}