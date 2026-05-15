import supabase from "./supabase";

const BUCKET = "signatures";
const SUPABASE_URL = "https://enupmlxmajjwskvzgcdq.supabase.co";
const ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudXBtbHhtYWpqd3NrdnpnY2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDIxMDUsImV4cCI6MjA4OTMxODEwNX0.px5ah-o_guGnQ8lTP7oJIwZXJEDiAcicuQTo3A_4aqE";

export async function uploadSignature(
  svgString: string,
  prefix: "borrow" | "return",
  borrowRecordId: string
): Promise<string> {
  const filename = `${prefix}_${borrowRecordId}_${Date.now()}.svg`;
  const path = filename;

  // ใช้ access token ของ user ที่ login อยู่ เพื่อผ่าน RLS
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token ?? ANON_KEY;

  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "image/svg+xml",
      "x-upsert": "true",
    },
    body: svgString,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload signature failed: ${text}`);
  }

  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}
