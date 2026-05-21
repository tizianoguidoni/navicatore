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

import WebAdBanner from "../../src/components/WebAdBanner";

export default function Login() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setErr("Please enter a valid email address");
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace("/(tabs)/map");
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      if (typeof detail === "string") {
        setErr(detail);
      } else if (Array.isArray(detail)) {
        setErr(detail[0]?.msg || "Invalid credentials");
      } else {
        setErr("Login failed. Check your connection.");
      }
    } finally {
      setLoading(false);
    }
  };

  const isWeb = Platform.OS === 'web';

  return (
    <SafeAreaView style={styles.safe} testID="login-screen">
      <View style={isWeb ? styles.webContainer : { flex: 1 }}>
        {isWeb && <View style={styles.sidebar}><WebAdBanner type="sidebar" /></View>}
        
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={isWeb ? styles.authCard : { flex: 1 }}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity 
              onPress={() => router.canGoBack() ? router.back() : router.replace("/onboarding")} 
              style={styles.back} 
              testID="login-back"
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
              WELCOME BACK
            </Text>
            <Text 
              style={styles.title}
              accessibilityRole="header"
              aria-level="2"
            >
              SIGN{"\n"}IN
            </Text>
            <Text style={styles.sub}>Resume your route. Defend your XP.</Text>

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
              <Text style={styles.label}>EMAIL</Text>
              <TextInput
                style={[styles.input, err?.toLowerCase().includes("email") && styles.inputError]}
                placeholder="driver@vyro.app"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                testID="login-email"
                accessibilityLabel="Indirizzo Email"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>PASSWORD</Text>
              <TextInput
                style={[styles.input, err?.toLowerCase().includes("password") && styles.inputError]}
                placeholder="••••••••"
                placeholderTextColor={theme.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                testID="login-password"
                accessibilityLabel="Inserisci la tua password"
              />
            </View>

            <TouchableOpacity
              style={[styles.cta, loading && { opacity: 0.7 }]}
              onPress={submit}
              disabled={loading}
              testID="login-submit"
              accessibilityRole="button"
              accessibilityLabel="Accedi"
            >
              {loading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.ctaText}>SIGN IN</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => router.push("/auth/signup")} 
              style={styles.switch} 
              testID="login-goto-signup"
              accessibilityRole="link"
              accessibilityLabel="Nuovo utente? Crea account"
            >
              <Text style={styles.switchText}>
                New recruit? <Text style={{ color: theme.primary }}>Create account</Text>
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>

        {isWeb && <View style={styles.sidebar}><WebAdBanner type="sidebar" /></View>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  scroll: { padding: 24, paddingTop: 8 },
  back: { padding: 8, marginLeft: -8, alignSelf: "flex-start", marginBottom: 24 },
  overline: {
    color: theme.primary,
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
  webContainer: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start', // Allinea in alto
    gap: 60, // Più spazio tra i componenti
    paddingHorizontal: 40,
    paddingTop: 100, // Allinea l'inizio delle ads con il modulo
  },
  authCard: {
    width: Platform.OS === 'web' ? 450 : '100%',
    maxWidth: '100%',
  },
  sidebar: {
    display: Platform.OS === 'web' ? 'flex' : 'none',
    width: 250,
  }
});
