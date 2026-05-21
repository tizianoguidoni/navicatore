import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../src/auth";
import { theme } from "../../src/theme";
import { useTranslation, Language } from "../../src/i18n";

export default function Signup() {
  const router = useRouter();
  const { signup } = useAuth();
  const { t, lang, changeLang } = useTranslation();
  
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const LANGS: { code: Language; flag: string; label: string }[] = [
    { code: "it", flag: "🇮🇹", label: "ITA" },
    { code: "en", flag: "🇺🇸", label: "ENG" },
    { code: "es", flag: "🇪🇸", label: "ESP" },
    { code: "fr", flag: "🇫🇷", label: "FRA" },
  ];

  const submit = async () => {
    setErr(null);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErr("Please enter a valid email address");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    try {
      await signup(email.trim(), password, username.trim());
      router.replace("/(tabs)/map");
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (typeof detail === "string") {
        setErr(detail);
      } else if (Array.isArray(detail)) {
        setErr(detail[0]?.msg || "Invalid data provided");
      } else {
        setErr("Signup failed. Please check your data.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="signup-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <TouchableOpacity 
            onPress={() => router.canGoBack() ? router.back() : router.replace("/onboarding")} 
            style={styles.back} 
            testID="signup-back"
            accessibilityRole="button"
            accessibilityLabel="Torna indietro"
          >
            <Ionicons name="chevron-back" size={24} color={theme.textPrimary} />
          </TouchableOpacity>

          <Text 
            style={styles.overline}
            accessibilityRole="header"
            aria-level="1"
          >
            {t("welcome")}
          </Text>
          <Text 
            style={styles.title}
            accessibilityRole="header"
            aria-level="2"
          >
            {t("signup")}
          </Text>
          <Text style={styles.sub}>Start earning XP. Build your trust score.</Text>

          {/* Region Picker */}
          <View style={styles.regionSelector}>
            <Text style={styles.label}>REGION / LINGUA</Text>
            <View style={styles.langRow}>
              {LANGS.map((l) => (
                <TouchableOpacity
                  key={l.code}
                  style={[styles.langBtn, lang === l.code && styles.langBtnActive]}
                  onPress={() => changeLang(l.code)}
                  accessibilityRole="button"
                  accessibilityLabel={`Seleziona lingua ${l.label}`}
                >
                  <Text style={styles.flag}>{l.flag}</Text>
                  <Text style={[styles.langLabel, lang === l.code && styles.langLabelActive]}>{l.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {err ? (
            <View 
              style={styles.errContainer} 
              accessibilityRole="alert"
              accessibilityLabel={`Errore: ${err}`}
            >
              <Ionicons name="alert-circle" size={18} color={theme.danger} />
              <Text style={styles.errText}>{err}</Text>
            </View>
          ) : null}

          <View style={styles.field}>
            <Text style={styles.label}>{t("callsign")}</Text>
            <TextInput
              style={[styles.input, err?.toLowerCase().includes("username") && styles.inputError]}
              placeholder="e.g. NightRider"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
              testID="signup-username"
              accessibilityLabel={t("callsign")}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("email")}</Text>
            <TextInput
              style={[styles.input, err?.toLowerCase().includes("email") && styles.inputError]}
              placeholder="driver@vyro.app"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              testID="signup-email"
              accessibilityLabel={t("email")}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>{t("password")}</Text>
            <TextInput
              style={[styles.input, err?.toLowerCase().includes("password") && styles.inputError]}
              placeholder="min. 6 characters"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              testID="signup-password"
              accessibilityLabel={t("password")}
            />
          </View>

          <TouchableOpacity
            style={[styles.cta, loading && { opacity: 0.7 }]}
            onPress={submit}
            disabled={loading}
            testID="signup-submit"
            accessibilityRole="button"
            accessibilityLabel={t("signup")}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.ctaText}>{t("signup")}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => router.push("/auth/login")} 
            style={styles.switch} 
            testID="signup-goto-login"
            accessibilityRole="link"
            accessibilityLabel={t("signin")}
          >
            <Text style={styles.switchText}>
              Already onboard? <Text style={{ color: theme.primary }}>{t("signin")}</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 24, paddingTop: 8 },
  back: { padding: 8, marginLeft: -8, alignSelf: "flex-start", marginBottom: 24 },
  overline: {
    color: theme.secondary,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "900",
    marginBottom: 12,
  },
  title: {
    color: theme.textPrimary,
    fontSize: 56,
    fontWeight: "900",
    letterSpacing: -2,
    lineHeight: 58,
  },
  sub: { color: theme.textSecondary, marginTop: 8, fontSize: 14, marginBottom: 32 },
  errContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#2a0f0f",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.danger + "66",
    marginBottom: 20,
  },
  errText: {
    color: theme.danger,
    fontSize: 13,
    fontWeight: "700",
    flex: 1,
  },
  inputError: {
    borderColor: theme.danger,
    backgroundColor: "#2a0f0f44",
  },
  field: { marginBottom: 16 },
  regionSelector: {
    marginBottom: 24,
    marginTop: 8,
  },
  langRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  langBtn: {
    flex: 1,
    backgroundColor: theme.surface,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: theme.border,
  },
  langBtnActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + "15",
    ...theme.glows?.primary,
  },
  flag: { fontSize: 20, marginBottom: 4 },
  langLabel: { color: theme.textMuted, fontSize: 10, fontWeight: "900" },
  langLabelActive: { color: theme.textPrimary },
  label: {
    color: theme.textMuted,
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.textPrimary,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    fontSize: 15,
  },
  cta: {
    backgroundColor: theme.primary,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 16,
  },
  ctaText: { color: "#000", fontWeight: "900", fontSize: 14, letterSpacing: 2 },
  switch: { marginTop: 24, alignItems: "center" },
  switchText: { color: theme.textSecondary, fontSize: 14 },
});
