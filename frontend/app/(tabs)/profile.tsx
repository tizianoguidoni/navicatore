import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { theme } from "../../src/theme";
import { useAuth } from "../../src/auth";
import { getLeaderboard, VyroUser, updateMe } from "../../src/api";

const BADGES = [
  { id: "rookie", label: "Rookie", icon: "medal", color: theme.accent },
  { id: "reporter", label: "Reporter", icon: "megaphone", color: theme.primary },
  { id: "trusted", label: "Trusted", icon: "shield-checkmark", color: theme.secondary },
  { id: "night", label: "Night Owl", icon: "moon", color: theme.info },
  { id: "scout", label: "Scout", icon: "eye", color: theme.warning },
  { id: "legend", label: "Legend", icon: "trophy", color: theme.danger },
];

export default function Profile() {
  const router = useRouter();
  const { user, logout, refresh } = useAuth();
  const [lb, setLb] = useState<VyroUser[]>([]);
  const [colorPicker, setColorPicker] = useState(false);
  const xpAnim = useRef(new Animated.Value(0)).current;

  const AVATAR_COLORS = [
    "#EAB308", "#84CC16", "#06B6D4", "#EF4444", 
    "#F97316", "#3B82F6", "#8B5CF6", "#EC4899"
  ];

  const load = useCallback(async () => {
    try {
      const r = await getLeaderboard();
      setLb(r.leaderboard);
    } catch {}
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (user) {
      const xpPct = (user.xp % 100) / 100;
      Animated.spring(xpAnim, {
        toValue: xpPct,
        tension: 20,
        friction: 5,
        useNativeDriver: false,
      }).start();
    }
  }, [user?.xp]);

  if (!user) return null;

  const xpToNext = 100 - (user.xp % 100);

  const onLogout = () => {
    Alert.alert("LOGOUT", "End this session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/auth/login");
        },
      },
    ]);
  };

  const changeColor = async (color: string) => {
    try {
      await updateMe({ avatar_color: color });
      await refresh();
      setColorPicker(false);
    } catch {
      Alert.alert("Error", "Failed to update color");
    }
  };

  return (
    <SafeAreaView style={styles.safe} testID="profile-screen">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Header card */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <TouchableOpacity 
              onPress={() => setColorPicker(true)}
              style={[styles.avatar, { backgroundColor: user.avatar_color }]}
              testID="profile-avatar-btn"
            >
              <Text style={styles.avatarText}>{user.username[0]?.toUpperCase()}</Text>
              <View style={styles.editBadge}>
                <Ionicons name="pencil" size={10} color="#000" />
              </View>
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.username}>{user.username}</Text>
              <Text style={styles.email}>{user.email}</Text>
              <View style={styles.badges}>
                <View style={[styles.miniBadge, { backgroundColor: theme.secondary + "22", borderColor: theme.secondary }]}>
                  <Ionicons name="shield-checkmark" size={10} color={theme.secondary} />
                  <Text style={[styles.miniBadgeText, { color: theme.secondary }]}>
                    TRUST {user.trust_score}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity onPress={onLogout} testID="profile-logout" style={styles.logout}>
              <Ionicons name="log-out-outline" size={22} color={theme.textMuted} />
            </TouchableOpacity>
          </View>

          {/* XP Bar */}
          <View style={styles.xpBlock}>
            <View style={styles.xpHead}>
              <Text style={styles.lvlBig}>LVL {user.level}</Text>
              <Text style={styles.xpMeta}>
                {user.xp} XP · {xpToNext} to next
              </Text>
            </View>
            <View style={styles.xpBar}>
              <Animated.View style={[styles.xpFill, { 
                width: xpAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0%", "100%"]
                })
              }]} />
            </View>
          </View>

          <View style={styles.statsRow}>
            <Stat label="XP" value={user.xp} color={theme.primary} />
            <Stat label="LEVEL" value={user.level} color={theme.secondary} />
            <Stat label="TRUST" value={user.trust_score} color={theme.accent} />
          </View>
        </View>

        {/* Badges */}
        <View style={styles.section}>
          <Text style={styles.secTitle}>BADGES</Text>
          <View style={styles.badgeGrid}>
            {BADGES.map((b) => {
              const earned = (user.badges || []).includes(b.id);
              return (
                <View
                  key={b.id}
                  style={[
                    styles.badgeCard,
                    earned && { borderColor: b.color + "88" },
                    !earned && { opacity: 0.4 },
                  ]}
                  testID={`badge-${b.id}`}
                >
                  <Ionicons
                    name={b.icon as any}
                    size={26}
                    color={earned ? b.color : theme.textMuted}
                  />
                  <Text style={styles.badgeLabel}>{b.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Leaderboard */}
        <View style={styles.section}>
          <Text style={styles.secTitle}>LEADERBOARD</Text>
          {lb.slice(0, 10).map((u, i) => (
            <View
              key={u.id}
              style={[
                styles.lbRow,
                u.id === user.id && { borderColor: theme.primary, backgroundColor: theme.primary + "10" },
              ]}
              testID={`lb-row-${i}`}
            >
              <Text
                style={[
                  styles.lbRank,
                  i === 0 && { color: theme.primary },
                  i === 1 && { color: theme.textSecondary },
                  i === 2 && { color: theme.warning },
                ]}
              >
                #{i + 1}
              </Text>
              <View style={[styles.lbAvatar, { backgroundColor: u.avatar_color || theme.primary }]}>
                <Text style={styles.lbAvatarText}>{u.username[0]?.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.lbName}>{u.username}</Text>
                <Text style={styles.lbMeta}>LVL {u.level} · Trust {u.trust_score}</Text>
              </View>
              <Text style={styles.lbXp}>{u.xp}</Text>
            </View>
          ))}
        </View>


        {/* Color Picker Modal */}
        {colorPicker && (
          <View style={styles.pickerOverlay}>
            <View style={styles.pickerCard}>
              <Text style={styles.pickerTitle}>SELECT AVATAR COLOR</Text>
              <View style={styles.colorGrid}>
                {AVATAR_COLORS.map(c => (
                  <TouchableOpacity
                    key={c}
                    onPress={() => changeColor(c)}
                    style={[styles.colorOption, { backgroundColor: c }, user.avatar_color === c && styles.colorActive]}
                  />
                ))}
              </View>
              <TouchableOpacity onPress={() => setColorPicker(false)} style={styles.pickerClose}>
                <Text style={styles.pickerCloseText}>CLOSE</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  headerCard: {
    margin: 16,
    padding: 20,
    backgroundColor: theme.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.border,
  },
  headerRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#000",
  },
  avatarText: { color: "#000", fontWeight: "900", fontSize: 24 },
  username: {
    color: theme.textPrimary,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  email: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
  badges: { flexDirection: "row", gap: 6, marginTop: 8 },
  miniBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  miniBadgeText: { fontWeight: "900", fontSize: 9, letterSpacing: 1 },
  logout: { padding: 8 },
  xpBlock: { marginTop: 20 },
  xpHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 8,
  },
  lvlBig: {
    color: theme.primary,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1,
  },
  xpMeta: { color: theme.textMuted, fontSize: 11, fontWeight: "600" },
  xpBar: {
    height: 8,
    backgroundColor: theme.surface2,
    borderRadius: 4,
    overflow: "hidden",
  },
  xpFill: {
    height: "100%",
    backgroundColor: theme.primary,
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 20,
    gap: 10,
  },
  stat: {
    flex: 1,
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: theme.surface2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statValue: { fontSize: 20, fontWeight: "900" },
  statLabel: {
    color: theme.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "800",
    marginTop: 2,
  },
  section: { paddingHorizontal: 24, marginTop: 8 },
  secTitle: {
    color: theme.textMuted,
    fontSize: 11,
    letterSpacing: 2.5,
    fontWeight: "900",
    marginBottom: 12,
  },
  badgeGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  badgeCard: {
    flexBasis: "30%",
    flexGrow: 1,
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surface,
    gap: 6,
    paddingVertical: 10,
  },
  badgeLabel: {
    color: theme.textSecondary,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
  },
  lbRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 8,
  },
  lbRank: {
    color: theme.textSecondary,
    fontWeight: "900",
    fontSize: 14,
    width: 36,
  },
  lbAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  lbAvatarText: { color: "#000", fontWeight: "900" },
  lbName: { color: theme.textPrimary, fontWeight: "700" },
  lbMeta: { color: theme.textMuted, fontSize: 11, marginTop: 2 },
  lbXp: {
    color: theme.primary,
    fontWeight: "900",
    fontSize: 16,
    fontVariant: ["tabular-nums"],
  },
  premium: {
    marginHorizontal: 24,
    marginTop: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 16,
    backgroundColor: theme.primary + "15",
    borderWidth: 1,
    borderColor: theme.primary + "66",
  },
  editBadge: {
    position: "absolute",
    bottom: -2,
    right: -2,
    backgroundColor: theme.primary,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: theme.surface,
  },
  pickerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  pickerCard: {
    backgroundColor: theme.surface,
    padding: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.border,
    width: "80%",
    alignItems: "center",
  },
  pickerTitle: {
    color: theme.textPrimary,
    fontWeight: "900",
    letterSpacing: 2,
    fontSize: 12,
    marginBottom: 20,
  },
  colorGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    justifyContent: "center",
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorActive: {
    borderColor: "#fff",
  },
  pickerClose: {
    marginTop: 24,
    padding: 10,
  },
  pickerCloseText: {
    color: theme.textMuted,
    fontWeight: "800",
    letterSpacing: 2,
    fontSize: 11,
  },
  premiumTitle: {
    color: theme.primary,
    fontWeight: "900",
    letterSpacing: 1.5,
    fontSize: 14,
  },
  premiumSub: { color: theme.textSecondary, fontSize: 12, marginTop: 2 },
});
