import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Text, TextInput } from "../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import supabase from "../lib/supabase";
import { setRememberLogin } from "../lib/session";
import { notify } from "../lib/notify";
import { getAllowedDomain, isAllowedEmail, signInWithGoogle, webRedirectError, ALLOWED_DOMAIN } from "../lib/googleAuth";
import { W, NG } from "../lib/theme";

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isLoading;
  const [googleLoading, setGoogleLoading] = useState(false);

  // ล็อกอิน Google สำเร็จ → ตรวจโดเมนซ้ำ (ด่านจริงอยู่ที่ Auth Hook) แล้วไปต่อเหมือนล็อกอินปกติ
  const afterGoogle = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // สวิตช์ปิดอยู่ (ช่วงพัฒนา) = ทุกบัญชีผ่าน / เปิดตอน Final Project = เฉพาะโดเมนที่ตั้ง
    const domain = await getAllowedDomain();
    if (!isAllowedEmail(user.email, domain)) {
      await supabase.auth.signOut();
      showPopup("ใช้อีเมลนี้ไม่ได้", `ตอนนี้ระบบรับเฉพาะอีเมล @${domain} (มหาวิทยาลัยขอนแก่น)`);
      return;
    }
    setIsLoading(true);
    await finishLogin(user, user.email || "");
  };

  // เว็บ: กลับมาจากหน้า Google → supabase-js อ่าน token จาก URL ให้แล้ว / มี error → แจ้ง
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const err = webRedirectError();
    if (err) {
      showPopup("เข้าสู่ระบบด้วย Google ไม่สำเร็จ", err);
      return;
    }
    if (/access_token|[?&]code=/.test(window.location.href)) afterGoogle();
  }, []);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    const res = await signInWithGoogle();
    setGoogleLoading(false);
    if (res.error) {
      showPopup("เข้าสู่ระบบด้วย Google ไม่สำเร็จ", res.error);
      return;
    }
    if (res.ok && Platform.OS !== "web") await afterGoogle();
  };

  // หน้าต่างแจ้งของแอปเอง (window.alert ถูกซ่อนในบางเบราว์เซอร์/แผงพรีวิว)
  const showPopup = (title: string, message: string) => notify(title, message);

  const updateEmail = (value: string) => {
    setEmail(value);
    if (fieldErrors.email || fieldErrors.password) {
      setFieldErrors({ email: "", password: "" });
    }
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    if (fieldErrors.email || fieldErrors.password) {
      setFieldErrors({ email: "", password: "" });
    }
  };

  const handleLogin = async () => {
    const normalizedEmail = email.trim();

    if (!normalizedEmail || !password) {
      const nextErrors = {
        email: !normalizedEmail ? "กรุณากรอกอีเมล" : "",
        password: !password ? "กรุณากรอกรหัสผ่าน" : "",
      };
      setFieldErrors(nextErrors);
      showPopup("กรอกข้อมูลให้ครบ", "กรุณากรอกอีเมลและรหัสผ่านก่อนเข้าสู่ระบบ");
      return;
    }

    setFieldErrors({ email: "", password: "" });
    setIsLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      console.log(error);
      setFieldErrors({
        email: "อีเมลอาจไม่ถูกต้อง",
        password: "รหัสผ่านอาจไม่ถูกต้อง",
      });
      showPopup("เข้าสู่ระบบไม่สำเร็จ", "อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่อีกครั้ง");
      setIsLoading(false);
      return;
    }

    const user = data.user;

    if (!user) {
      setFieldErrors({
        email: "ไม่พบบัญชีผู้ใช้นี้",
        password: "กรุณาตรวจสอบรหัสผ่าน",
      });
      showPopup("ไม่พบผู้ใช้", "ไม่พบบัญชีผู้ใช้ หรือข้อมูลเข้าสู่ระบบไม่ถูกต้อง");
      setIsLoading(false);
      return;
    }

    await finishLogin(user, normalizedEmail);
  };

  // หลังล็อกอินสำเร็จ (รหัสผ่าน / Google): โหลดสิทธิ์ แล้วพาไปหน้าตามบทบาท
  const finishLogin = async (user: any, fallbackEmail: string) => {
    await setRememberLogin(rememberMe);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.log(profileError);
      showPopup(
        "โหลดสิทธิ์ผู้ใช้ไม่สำเร็จ",
        profileError.message || "กรุณาลองเข้าสู่ระบบอีกครั้ง"
      );
      setIsLoading(false);
      return;
    }

    if (!profile) {
      const { error: createProfileError } = await supabase
        .from("profiles")
        .upsert(
          [{
            id: user.id,
            role: "user",
            email: user.email || fallbackEmail,
          }],
          { onConflict: "id" }
        );

      if (createProfileError) {
        console.log(createProfileError);
        showPopup(
          "ตั้งค่าบัญชีไม่สำเร็จ",
          createProfileError.message || "บัญชีนี้ยังไม่มีข้อมูลสิทธิ์ผู้ใช้"
        );
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      router.replace("/home");
      return;
    }

    setIsLoading(false);

    // admin และ TA เข้าหน้าผู้ดูแล (TA เห็นเมนูเท่าที่มีสิทธิ์)
    if (profile.role === "admin" || profile.role === "ta") {
      router.replace("/admin/home");
    } else {
      router.replace("/home");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.topBand} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandBlock}>
          <View style={styles.logoWrap}>
            <View style={styles.logoInner}>
              <Ionicons name="flask-outline" size={42} color="#ffffff" />
            </View>
            <View style={styles.logoBadge}>
              <Ionicons name="sparkles" size={14} color="#ffffff" />
            </View>
          </View>
          <Text style={styles.appName}>
            LabHub
          </Text>
          <View style={styles.subtitleRow}>
            <Ionicons name="time-outline" size={11} color="#2563EB" />
            <Text style={styles.appSubtitle}>ทุกอุปกรณ์ในห้องแล็บ รวมไว้ที่เดียว</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>เข้าสู่ระบบ</Text>
          <Text style={styles.description}>ยินดีต้อนรับกลับ! กรุณาเข้าสู่ระบบเพื่อใช้งาน</Text>

          <Text style={styles.label}>อีเมล</Text>
          <View style={[styles.inputBox, fieldErrors.email && styles.inputBoxError, focusedField === "email" && styles.inputBoxFocused]}>
            <View style={styles.inputIconBox}>
              <Ionicons name="mail-outline" size={18} color={focusedField === "email" ? "#2563EB" : "#7f8ea3"} />
            </View>
            <TextInput
              placeholder={focusedField === "email" ? "" : "student@iotlab.ac.th"}
              placeholderTextColor="#94a3b8"
              style={styles.input}
              value={email}
              onChangeText={updateEmail}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              selectionColor="#2563EB"
            />
          </View>
          {!!fieldErrors.email && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color="#ef4444" />
              <Text style={styles.errorText}>{fieldErrors.email}</Text>
            </View>
          )}

          <View style={styles.passwordHeader}>
            <Text style={styles.label}>รหัสผ่าน</Text>
            <TouchableOpacity onPress={() => router.push("/forgot")} disabled={isLoading}>
              <Text style={styles.forgot}>ลืมรหัสผ่าน?</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.inputBox, fieldErrors.password && styles.inputBoxError, focusedField === "password" && styles.inputBoxFocused]}>
            <View style={styles.inputIconBox}>
              <Ionicons name="lock-closed-outline" size={18} color={focusedField === "password" ? "#2563EB" : "#7f8ea3"} />
            </View>
            <TextInput
              placeholder={focusedField === "password" ? "" : "กรอกรหัสผ่าน"}
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              style={styles.input}
              value={password}
              onChangeText={updatePassword}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              textContentType="password"
              selectionColor="#2563EB"
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={10}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color="#7f8ea3" />
            </TouchableOpacity>
          </View>
          {!!fieldErrors.password && (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle-outline" size={14} color="#ef4444" />
              <Text style={styles.errorText}>{fieldErrors.password}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.rememberRow}
            onPress={() => setRememberMe((value) => !value)}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe && <Ionicons name="checkmark" size={14} color="#ffffff" />}
            </View>
            <Text style={styles.rememberText}>จดจำการเข้าสู่ระบบ</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.loginBtn, !canSubmit && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={!canSubmit}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.loginText}>เข้าสู่ระบบ</Text>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>หรือเข้าใช้ระบบ</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleBtn, (googleLoading || isLoading) && styles.loginBtnDisabled]}
            onPress={handleGoogle}
            disabled={googleLoading || isLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color="#172033" />
            ) : (
              <>
                <Ionicons name="logo-google" size={18} color="#ea4335" />
                <Text style={styles.googleText}>เข้าสู่ระบบด้วย Google (@{ALLOWED_DOMAIN})</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.signupRow}>
          <Text style={styles.signupHint}>ยังไม่มีบัญชี?</Text>
          <TouchableOpacity onPress={() => router.push("/signup")} disabled={isLoading}>
            <Text style={styles.signup}>สมัครสมาชิก</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sslPill}>
          <Ionicons name="shield-checkmark" size={14} color="#047857" />
          <Text style={styles.sslText}>ปลอดภัย เข้ารหัส SSL</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DCE6F5",
    backgroundColor: "#ffffff",
    marginTop: 4,
  },
  googleText: { fontSize: 14, fontWeight: "600", color: "#172033", flexShrink: 1 },
  screen: {
    ...W.page,
    flex: 1,
  },
  topBand: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 48,
    paddingBottom: 28,
  },
  brandBlock: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    alignItems: "center",
    marginBottom: 28,
  },
  logoWrap: {
    width: 98,
    height: 98,
    borderRadius: 24,
    backgroundColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.80)",
    shadowColor: "#2563EB",
    shadowOpacity: 0.2,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  logoInner: {
    width: 66,
    height: 66,
    borderRadius: 15,
    backgroundColor: "#2563eb",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#60a5fa",
  },
  logoBadge: {
    ...NG,
    position: "absolute",
    top: -5,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#fb923c",
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  appName: {
    color: "#172033",
    fontSize: 31,
    fontWeight: "900",
    textAlign: "center",
    letterSpacing: 0,
  },
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 4,
  },
  appSubtitle: {
    color: "#475569",
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "center",
  },
  card: {
    ...W.card,
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 20,
  },
  title: {
    color: "#172033",
    fontSize: 20,
    fontWeight: "900",
  },
  description: {
    color: "#7b8aa0",
    fontSize: 12.5,
    lineHeight: 19,
    marginTop: 7,
    marginBottom: 17,
    fontWeight: "500",
  },
  label: {
    color: "#334155",
    fontSize: 12.5,
    fontWeight: "700",
    marginBottom: 8,
  },
  inputBox: {
    minHeight: 47,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#d6e0ec",
    borderRadius: 11,
    paddingHorizontal: 11,
    marginBottom: 16,
    shadowColor: "#172033",
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  inputBoxFocused: {
    ...NG,
    borderColor: "#2563EB",
    backgroundColor: "#ffffff",
    shadowColor: "#2563EB",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  inputBoxError: {
    ...NG,
    borderColor: "#fca5a5",
    backgroundColor: "#fff7f7",
  },
  inputIconBox: {
    width: 31,
    height: 31,
    borderRadius: 8,
    backgroundColor: "#EEF5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    flex: 1,
    color: "#172033",
    fontSize: 14,
    paddingVertical: 12,
    fontWeight: "500",
  },
  passwordHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: -10,
    marginBottom: 12,
  },
  errorText: {
    color: "#ef4444",
    fontSize: 11.5,
    fontWeight: "700",
  },
  forgot: {
    color: "#475569",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 7,
  },
  rememberRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 7,
    marginTop: -4,
    marginBottom: 16,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    ...NG,
    backgroundColor: "#2563EB",
  },
  rememberText: {
    color: "#475569",
    fontSize: 12.5,
    fontWeight: "700",
  },
  loginBtn: {
    ...W.primarySolid,
    minHeight: 44,
    borderRadius: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 0,
  },
  loginBtnDisabled: {
    opacity: 0.55,
  },
  loginText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#DCE6F5",
  },
  dividerText: {
    color: "#a2aec0",
    fontSize: 11,
    fontWeight: "700",
  },
  signupRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 28,
  },
  signupHint: {
    color: "#64748b",
    fontSize: 12.5,
    fontWeight: "700",
  },
  signup: {
    color: "#1D4ED8",
    fontSize: 12.5,
    fontWeight: "900",
  },
  sslPill: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#ffffff",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 16,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  sslText: {
    color: "#047857",
    fontSize: 10.5,
    fontWeight: "900",
  },
});
