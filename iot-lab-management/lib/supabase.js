import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://enupmlxmajjwskvzgcdq.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVudXBtbHhtYWpqd3NrdnpnY2RxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM3NDIxMDUsImV4cCI6MjA4OTMxODEwNX0.px5ah-o_guGnQ8lTP7oJIwZXJEDiAcicuQTo3A_4aqE";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ใช้กับการอัปโหลดผ่าน REST ตรง (FileSystem.uploadAsync ในมือถือ)
export const SUPABASE_URL = supabaseUrl;
export const SUPABASE_ANON_KEY = supabaseAnonKey;

export default supabase;