import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Text, TextInput } from "../components/AppText";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import supabase from "../lib/supabase";
import { setRememberLogin } from "../lib/session";
import { notify } from "../lib/notify";
import { getAllowedDomains, isAllowedEmail, isStaffEmail, isUniEmail as isUniAddress, oauthReturned, signInWithGoogle, uniEmailTypoFix, webRedirectError } from "../lib/googleAuth";
import { W, NG, TOP_INSET } from "../lib/theme";
import InstallBanner, { INSTALL_BANNER_SPACE } from "../components/InstallBanner";
import { useInstallMode } from "../lib/web/installApp";

const KKU = { brick: "#A8341C", orange: "#D97A1E", shadow: "#7A2412" };

// พื้นไล่สีอ่อนๆ (สว่างกว่านิดเดียวด้านบน) — ไม่มีแสงมัน (เจ้าของโปรเจกต์ว่าปุ่มนูนไม่สวย 12 ต.ค. 2569) · วางเป็นลูกแรกของปุ่ม
// kku = ปุ่ม KKU Mail (สีอิฐ มีแถบส้มล่าง) / ไม่ใส่ = ปุ่มเข้าสู่ระบบสีฟ้าของแอป
function Shine({ kku }: { kku?: boolean }) {
  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={kku ? ["#B23B21", KKU.brick, "#9E3019"] : ["#3170EE", "#2563EB", "#215CE0"]}
        locations={[0, 0.5, 1]}
        style={[styles.shineFill, kku && styles.shineFillKku]}
      />
    </>
  );
}

// กรอบการ์ดมีไฟวิ่ง: แผ่นไล่สีน้ำเงิน (โทนทางการ) หมุนช้าๆ อยู่หลังการ์ด โผล่ให้เห็นแค่ขอบ
// หมุนด้วย native driver (ไม่กิน JS) / เว็บใช้ CSS animation · เครื่องเปิด "ลดภาพเคลื่อนไหว" = ขอบนิ่ง
function GlowFrame({ children }: { children: React.ReactNode }) {
  const [box, setBox] = useState({ w: 0, h: 0 });
  const spin = useRef(new Animated.Value(0)).current;
  // เว็บ: หมุนด้วย CSS animation (Animated.loop บนเว็บวนด้วย JS แล้วหยุดบน iPhone PWA)
  const [moving, setMoving] = useState(false);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active || reduce) return;
      if (Platform.OS === "web") { setMoving(true); return; }
      loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 6500, easing: Easing.linear, useNativeDriver: true }));
      loop.start();
    });
    return () => { active = false; loop?.stop(); };
  }, []);

  // แผ่นจัตุรัสกว้าง = เส้นทแยงการ์ด จุดหมุนอยู่กลางการ์ด → ลิ่มแสงยาวถึงขอบทุกมุม
  const d = Math.ceil(Math.hypot(box.w, box.h));
  // ความเร็วคงที่บนขอบ: หมุนมุมเท่ากันทุกช่วง = ตรงมุมการ์ด (ไกลจุดกลาง) แสงวิ่งเร็วขึ้น
  // → แบ่งเส้นรอบเป็นช่วงเท่าๆ กัน แล้วแปลงแต่ละจุดเป็นมุมที่ต้องหมุน (หัวลิ่มชี้ไปที่จุดนั้น)
  const stops = useMemo(() => {
    const { w, h } = box;
    if (!w || !h) return { input: [0, 1], output: ["0deg", "360deg"] };
    const per = 2 * (w + h);
    const N = 96;
    const input: number[] = [];
    const output: string[] = [];
    let prev = -Infinity;
    for (let i = 0; i <= N; i++) {
      // เริ่มกลางขอบบน วิ่งตามเข็มนาฬิกา
      let d0 = (i / N) * per;
      let x: number, y: number;
      if (d0 <= w / 2) { x = w / 2 + d0; y = 0; }
      else if ((d0 -= w / 2) <= h) { x = w; y = d0; }
      else if ((d0 -= h) <= w) { x = w - d0; y = h; }
      else if ((d0 -= w) <= h) { x = 0; y = h - d0; }
      else { d0 -= h; x = d0; y = 0; }
      // ทิศจากกลางการ์ด วัดตามเข็มจากทิศบน (องศา) — คลายให้เพิ่มขึ้นต่อเนื่อง
      let deg = (Math.atan2(x - w / 2, h / 2 - y) * 180) / Math.PI;
      while (deg < prev - 1e-6) deg += 360;
      prev = deg;
      input.push(i / N);
      output.push(`${deg - 90}deg`); // หัวลิ่มอยู่ที่ +90° จากแนวตั้งของแผ่น
    }
    return { input, output };
  }, [box.w, box.h]);
  const rotate = useMemo(() => spin.interpolate({ inputRange: stops.input, outputRange: stops.output }), [stops]);
  // เว็บ: จุดหมุนชุดเดียวกัน แปลงเป็น CSS keyframes (เส้นตรงระหว่างจุด = ความเร็วบนขอบคงที่เหมือนมือถือ)
  const webSpin = useMemo(() => {
    if (Platform.OS !== "web" || !moving) return null;
    const frames: Record<string, { transform: string }> = {};
    stops.input.forEach((t, i) => { frames[`${(t * 100).toFixed(3)}%`] = { transform: `rotate(${stops.output[i]})` }; });
    return StyleSheet.create({
      a: { animationDuration: "6500ms", animationTimingFunction: "linear", animationIterationCount: "infinite", animationKeyframes: [frames] } as any,
    }).a;
  }, [stops, moving]);
  return (
    <View style={styles.glowShadow}>
      <View style={styles.glowClip} onLayout={(e) => setBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
        {d > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              { position: "absolute", width: d, height: d, left: (box.w - d) / 2, top: (box.h - d) / 2 },
              Platform.OS === "web" ? webSpin : { transform: [{ rotate }] },
            ]}
          >
            {/* ลิ่มแสง = ควอดแรนต์ขวาบน (มุมอยู่กลางการ์ด) → หมุนแล้วแตะขอบตลอด ไม่กระโดดตอนผ่านด้านแคบ
                ไล่สีตามแนวทแยง ≈ ตามมุม: หางจาง → หัวสว่างด้านที่หมุนไป (ตามเข็มนาฬิกา) */}
            <LinearGradient
              colors={["rgba(37,99,235,0)", "rgba(30,58,138,0.55)", "#2563EB", "#93C5FD"]}
              locations={[0, 0.45, 0.82, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ position: "absolute", left: d / 2, top: 0, width: d / 2, height: d / 2 }}
            />
          </Animated.View>
        )}
        {children}
      </View>
    </View>
  );
}

export default function Login() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<"email" | "password" | null>(null);
  const [fieldErrors, setFieldErrors] = useState({ email: "", password: "" });

  const [googleLoading, setGoogleLoading] = useState(false);
  const installMode = useInstallMode();
  // อีเมล มข. (@kkumail.com นศ. / @kku.ac.th บุคลากร) = บัญชี Google ของมหาวิทยาลัย → ซ่อนช่องรหัส ปุ่มหลักพาไปหน้า Google (แอปไม่รับรหัส มข.)
  const isUniEmail = isUniAddress(email);
  const canSubmit = email.trim().length > 0 && (isUniEmail || password.length > 0) && !isLoading && !googleLoading;
  // พิมพ์โดเมนผิดนิดหน่อย (เช่น @kkmail.com) → เสนอแก้เป็น @kkumail.com + ปุ่ม KKU Mail ส่งอีเมลที่แก้แล้วให้ Google
  const kkuFix = uniEmailTypoFix(email);

  // ล็อกอิน Google สำเร็จ → ตรวจโดเมนซ้ำ (ด่านจริงอยู่ที่ Auth Hook) แล้วไปต่อเหมือนล็อกอินปกติ
  const afterGoogle = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // เฉพาะโดเมนใน app_settings.allowed_email_domain (ว่าง = ทุกบัญชีผ่าน)
    //   เช็กเฉพาะบัญชีที่เข้าด้วย Google — เจ้าหน้าที่ที่ใช้อีเมล/รหัสผ่าน (session ค้างแล้วเปิดหน้านี้) ไม่โดนออก
    const viaGoogle = user.app_metadata?.provider === "google" || (user.identities || []).some((i) => i.provider === "google");
    const domains = viaGoogle ? await getAllowedDomains() : [];
    if (!isAllowedEmail(user.email, domains)) {
      await supabase.auth.signOut();
      showPopup("ใช้อีเมลนี้ไม่ได้", `ตอนนี้ระบบรับเฉพาะอีเมล ${domains.map((d) => "@" + d).join(", ")} (มหาวิทยาลัยขอนแก่น)`);
      return;
    }
    setIsLoading(true);
    await finishLogin(user, user.email || "");
  };

  // เว็บ: กลับมาจากหน้า Google → supabase-js อ่าน token จาก URL ให้แล้ว / มี error → แจ้ง
  //   เดิมดูแค่ URL — แต่ supabase-js ลบ token ออกจาก URL ก่อนหน้านี้แสดง (รอฟอนต์บนมือถือ) → บางครั้งเด้งกลับมาเฉย ๆ ไม่ล็อกอิน
  //   Android แบบติดตั้ง: หน้า Google เปิดเป็นหน้าต่างย่อย บางเครื่องล็อกอินเสร็จในหน้าต่างนั้น แล้วกลับมาหน้า login เดิมที่ไม่รู้ตัว
  //   ตอนนี้: มี session อยู่แล้ว (getSession รอ supabase-js อ่าน URL เสร็จ) = พาเข้าระบบ · กลับมาที่แอป = เช็กอีกรอบ
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const err = webRedirectError();
    oauthReturned(); // ล้างป้าย (ใช้ getSession ตัดสินแทน)
    if (err) {
      showPopup("เข้าสู่ระบบด้วย Google ไม่สำเร็จ", err);
      return;
    }
    let busy = false;
    const check = async () => {
      if (busy || document.visibilityState !== "visible") return;
      busy = true;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await afterGoogle();
      busy = false;
    };
    check();
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    return () => {
      document.removeEventListener("visibilitychange", check);
      window.removeEventListener("focus", check);
    };
  }, []);

  const handleGoogle = async (hint?: string) => {
    setGoogleLoading(true);
    const res = await signInWithGoogle(hint);
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
    if (isUniEmail) {
      setPassword("");
      await handleGoogle(normalizedEmail);
      return;
    }

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
    <View
      style={styles.screen}
    >
      {/* พื้นหลังเฉพาะหน้า login: โทนฟ้าเดียวกับทั้งแอป (W.page) แต่เข้มกว่า */}
      <LinearGradient colors={["#4F82EC", "#79A2F3", "#B0C9F8", "#DCE7FB"]} locations={[0, 0.32, 0.64, 1]} style={styles.topBand} />
      <KeyboardAwareScrollView bottomOffset={24}
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
            <Ionicons name="hardware-chip-outline" size={12} color="#1D4ED8" />
            <Text style={styles.appSubtitle}>ทุกอุปกรณ์ในห้องแล็บ รวมไว้ที่เดียว</Text>
          </View>
        </View>

        <GlowFrame>
        <View style={styles.card}>
          <Text style={styles.title}>เข้าสู่ระบบ</Text>
          <Text style={styles.description}>นักศึกษา/บุคลากร มข. เข้าด้วย Google · บัญชีอื่นใช้รหัสผ่าน</Text>

          <Text style={styles.label}>อีเมล</Text>
          <View style={[styles.inputBox, fieldErrors.email && styles.inputBoxError, focusedField === "email" && styles.inputBoxFocused]}>
            <View style={styles.inputIconBox}>
              <Ionicons name="mail-outline" size={18} color={focusedField === "email" ? "#2563EB" : "#7f8ea3"} />
            </View>
            <TextInput
              placeholder={focusedField === "email" ? "" : "Student@kkumail.com"}
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
          {!!kkuFix && (
            <TouchableOpacity style={styles.fixRow} onPress={() => updateEmail(kkuFix)} activeOpacity={0.7} accessibilityRole="button">
              <Ionicons name="help-circle-outline" size={15} color="#B45309" />
              <Text style={styles.fixText}>
                หมายถึง <Text style={styles.fixEmail}>{kkuFix}</Text> ใช่ไหม? <Text style={styles.fixAction}>แตะเพื่อแก้</Text>
              </Text>
            </TouchableOpacity>
          )}

          {isUniEmail ? (
            <View style={styles.uniBox}>
              <Ionicons name="school-outline" size={18} color="#1D4ED8" />
              <View style={{ flex: 1 }}>
                <Text style={styles.uniTitle}>{isStaffEmail(email) ? "บัญชีบุคลากร มข." : "บัญชี KKU Mail"}</Text>
                <Text style={styles.uniText}>ใส่รหัสผ่านที่หน้า Google</Text>
              </View>
            </View>
          ) : (
          <>
          <Text style={styles.label}>รหัสผ่าน</Text>

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
          </>
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
            style={[styles.loginBtn, isUniEmail && styles.kkuBtn, !canSubmit && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={!canSubmit}
          >
            {isLoading || (isUniEmail && googleLoading) ? (
              <ActivityIndicator color="#fff" />
            ) : isUniEmail ? (
              <>
                <Shine kku />
                <Ionicons name="logo-google" size={18} color="#ffffff" />
                <Text style={styles.loginText}>ดำเนินการต่อด้วย Google</Text>
              </>
            ) : (
              <>
                <Shine />
                <Text style={styles.loginText}>เข้าสู่ระบบ</Text>
                <Ionicons name="arrow-forward" size={18} color="#ffffff" />
              </>
            )}
          </TouchableOpacity>

          {/* อีเมล มข. → ปุ่มหลักเป็น Google แล้ว ซ่อนปุ่มซ้ำ */}
          {!isUniEmail && (
          <>
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>หรือ</Text>
            <View style={styles.dividerLine} />
          </View>

          <TouchableOpacity
            style={[styles.googleBtn, styles.kkuBtn, (googleLoading || isLoading) && styles.loginBtnDisabled]}
            onPress={() => handleGoogle(kkuFix || undefined)}
            disabled={googleLoading || isLoading}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <>
                <Shine kku />
                <Ionicons name="logo-google" size={18} color="#ffffff" />
                <Text style={styles.googleText}>เข้าสู่ระบบด้วยบัญชี มข.</Text>
              </>
            )}
          </TouchableOpacity>
          </>
          )}

          {/* ไม่มีลืมรหัสผ่าน/สมัครสมาชิกในแอป → บอกทางออกให้คนที่เข้าไม่ได้ */}
          <View style={styles.helpRow}>
            <Ionicons name="help-circle-outline" size={14} color="#64748B" />
            <Text style={styles.helpText}>มีปัญหาเข้าระบบ? ติดต่อผู้ดูแลห้องแล็บ</Text>
          </View>
        </View>
        </GlowFrame>

        {/* ไม่มีสมัครสมาชิกในแอป (ถอดออก 12 ต.ค. 2569) — นศ. เข้าด้วย Google @kkumail.com ครั้งแรก = สร้างบัญชีให้เอง */}
        <View style={styles.sslPill}>
          <Ionicons name="shield-checkmark" size={14} color="#047857" />
          <Text style={styles.sslText}>ปลอดภัย เข้ารหัส SSL</Text>
        </View>

        {/* มีแถบติดตั้งลอยล่างจอ → เว้นที่ให้เลื่อนขึ้นมาเห็นปุ่มล่างสุดได้ */}
        {installMode ? <View style={{ height: INSTALL_BANNER_SPACE }} /> : null}
      </KeyboardAwareScrollView>

      {/* เว็บมือถือที่ยังไม่ได้ติดตั้ง: แถบชวนเพิ่มลงหน้าจอโฮม ลอยติดล่างจอ (iPhone = บอกวิธี / Android = ปุ่มติดตั้ง) */}
      <InstallBanner />
    </View>
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
  googleText: { fontSize: 15, fontWeight: "800", color: "#ffffff", flexShrink: 1 },
  // ปุ่ม KKU Mail = สีมหาวิทยาลัย (อิฐ + แถบส้ม) — ข้อยกเว้นเดียวจากสีฟ้าของแอป (เจ้าของโปรเจกต์เลือก 12 ต.ค. 2569)
  kkuBtn: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 0,
    borderBottomWidth: 4,
    borderBottomColor: KKU.orange,
    backgroundColor: KKU.brick,
    shadowColor: KKU.shadow,
    shadowOpacity: 0.38,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 7,
  },
  shineFill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 14,
  },
  // ปุ่ม KKU มีแถบส้มหนา 4 ด้านล่าง → มุมล่างด้านในโค้งน้อยลง
  shineFillKku: { borderBottomLeftRadius: 10, borderBottomRightRadius: 10 },
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
    paddingTop: TOP_INSET - 4,
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
  // ป้ายขาวโปร่งรองคำโปรย — พื้นหลังหน้า login เข้มขึ้น ตัวเทาเดิมกลืน
  subtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: 5,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.9)",
  },
  appSubtitle: {
    color: "#1E3A8A",
    fontSize: 11.5,
    fontWeight: "700",
    textAlign: "center",
  },
  glowShadow: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    borderRadius: 24,
    boxShadow: (W.card as any).boxShadow,
  },
  glowClip: {
    borderRadius: 24,
    overflow: "hidden",
    padding: 1.5, // ความหนาขอบไฟ
    backgroundColor: "#BFD3F7", // ขอบน้ำเงินอ่อนตอนไฟไม่ผ่าน
  },
  card: {
    ...W.card,
    borderRadius: 22,
    borderWidth: 0,
    boxShadow: undefined,
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
    color: "#475569",
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
  uniBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#EFF5FF",
    borderWidth: 1,
    borderColor: "#BFD3F7",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 18, // เท่าช่องรหัสผ่านที่แทนที่ (แถว "จดจำ" ดึงขึ้น -4)
  },
  uniTitle: { color: "#1D4ED8", fontSize: 13.5, fontWeight: "800" },
  uniText: { color: "#1E40AF", fontSize: 12.5, marginTop: 1 },
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
  // เสนอแก้อีเมลที่พิมพ์โดเมนผิด (โทนเตือนสีส้มของ DESIGN.md)
  fixRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: -6,
    marginBottom: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  fixText: { flex: 1, color: "#92400E", fontSize: 12.5, lineHeight: 18 },
  fixEmail: { fontWeight: "800" },
  fixAction: { color: "#B45309", fontWeight: "800", textDecorationLine: "underline" },
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
    minHeight: 50,
    borderRadius: 14,
    shadowColor: "#1D4ED8",
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
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
  helpRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 16,
  },
  helpText: { color: "#64748B", fontSize: 12, fontWeight: "600" },
  dividerText: {
    color: "#a2aec0",
    fontSize: 11,
    fontWeight: "700",
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
    marginTop: 28, // เดิมมีแถว "สมัครสมาชิก" คั่น
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  sslText: {
    color: "#047857",
    fontSize: 10.5,
    fontWeight: "900",
  },
});
