import { useEffect } from "react";
import { useRouter } from "expo-router";

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    router.replace("./admin/home"); // เข้า Admin ทันที
  }, []);

  return null;
}