import { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "../src/theme";

const PERKS = [
  { icon: "flash", title: "Advanced AI Routing", desc: "Multi-factor routing tuned to your vehicle" },
  { icon: "shield-checkmark", title: "Priority Verification", desc: "Your reports weighted 2x in validation" },
  { icon: "sparkles", title: "Premium Avatars", desc: "Exclusive 3D driver characters" },
  { icon: "ban", title: "No Ads", desc: "Uninterrupted navigation experience" },
  { icon: "analytics", title: "Fleet Analytics", desc: "B2B dashboard for team drivers" },
  { icon: "headset", title: "Priority Support", desc: "24/7 response from the VYRO crew" },
];

export default function Premium() {
  const router = useRouter();
  const [success, setSuccess] = useState(false);

  const subscribe = () => {
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      router.back();
    }, 2000);
  };

  return (
    <SafeAreaView style={styles.safe} testID="premium-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 60 }}>
        <TouchableOpacity onPress={() => router.back()} style={styles.close} testID="premium-close">
          <Ionicons name="close" size={24} color={theme.textPrimary} />
        </TouchableOpacity>

        <Image
          source={{
            uri: "https://images.pexels.com/photos/5322558/pexels-photo-5322558.jpeg",
          }}
          style={styles.hero}
          resizeMode="cover"
        />

        <View style={styles.heroOverlay}>
          <Text style={styles.brand}>VYRO</Text>
          <Text style={styles.pro}>PRO</Text>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>UPGRADE YOUR RIDE</Text>
          <Text style={styles.sub}>
            Unlock the full VYRO ecosystem. Drive smarter. Earn faster. Dominate the leaderboard.
          </Text>

          <View style={styles.perks}>
            {PERKS.map((p, i) => (
              <View key={i} style={styles.perk} testID={`perk-${i}`}>
                <View style={styles.perkIcon}>
                  <Ionicons name={p.icon as any} size={20} color={theme.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.perkTitle}>{p.title}</Text>
                  <Text style={styles.perkDesc}>{p.desc}</Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.cta} testID="premium-subscribe" onPress={subscribe}>
            <Text style={styles.ctaText}>ACTIVATE FULL ACCESS</Text>
          </TouchableOpacity>
        </View>

        {success && (
          <View style={styles.successOverlay}>
            <View style={styles.successCard}>
              <Ionicons name="checkmark-circle" size={60} color={theme.secondary} />
              <Text style={styles.successTitle}>WELCOME PRO</Text>
              <Text style={styles.successSub}>Your engine is now optimized.</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  close: {
    position: "absolute",
    top: 12,
    right: 16,
    zIndex: 20,
    padding: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 999,
  },
  hero: { width: "100%", height: 220, opacity: 0.55 },
  heroOverlay: {
    position: "absolute",
    top: 80,
    left: 24,
    flexDirection: "row",
    gap: 10,
    alignItems: "baseline",
  },
  brand: { color: theme.textPrimary, fontSize: 44, fontWeight: "900", letterSpacing: 3 },
  pro: { color: theme.primary, fontSize: 32, fontWeight: "900", letterSpacing: 4 },
  content: { padding: 24 },
  title: {
    color: theme.textPrimary,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  sub: {
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  perks: { marginTop: 24, gap: 12 },
  perk: {
    flexDirection: "row",
    gap: 14,
    alignItems: "center",
    padding: 14,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
  },
  perkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.primary + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  perkTitle: { color: theme.textPrimary, fontWeight: "800", fontSize: 14 },
  perkDesc: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
  pricing: { flexDirection: "row", gap: 10, marginTop: 28 },
  plan: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.surface,
  },
  planSelected: { borderColor: theme.primary, backgroundColor: theme.primary + "10" },
  planTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  planLabel: {
    color: theme.textSecondary,
    fontWeight: "900",
    letterSpacing: 2,
    fontSize: 11,
  },
  planSave: {
    backgroundColor: theme.secondary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  planSaveText: { color: "#000", fontWeight: "900", fontSize: 9, letterSpacing: 1 },
  planPrice: {
    color: theme.textPrimary,
    fontSize: 24,
    fontWeight: "900",
    marginTop: 8,
  },
  planPeriod: { fontSize: 12, color: theme.textMuted, fontWeight: "700" },
  planBreak: { color: theme.textMuted, fontSize: 11, marginTop: 2 },
  cta: {
    backgroundColor: theme.primary,
    marginTop: 24,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
  },
  ctaText: { color: "#000", fontWeight: "900", letterSpacing: 2, fontSize: 14 },
  fine: {
    color: theme.textMuted,
    fontSize: 11,
    marginTop: 12,
    textAlign: "center",
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.9)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  successCard: {
    alignItems: "center",
  },
  successTitle: {
    color: theme.textPrimary,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 16,
  },
  successSub: {
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: 4,
  },
});
