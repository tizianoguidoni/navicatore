import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { theme, reportColors, reportLabels, reportIcons } from "../../src/theme";
import { listReports, ReportItem, listChatHistory } from "../../src/api";
import { useAuth } from "../../src/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

function timeAgo(iso: string) {
  if (!iso) return "";
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export default function Community() {
  const [tab, setTab] = useState<"intel" | "chat">("chat");
  const [items, setItems] = useState<ReportItem[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [msgInput, setMsgInput] = useState("");
  const { user } = useAuth();
  
  const ws = useRef<WebSocket | null>(null);
  const flatListRef = useRef<FlatList>(null);

  const connectChat = async () => {
    const token = await AsyncStorage.getItem("vyro_token");
    if (!token) return;

    const baseUrl = process.env.EXPO_PUBLIC_BACKEND_URL || "";
    const wsUrl = baseUrl.replace("http", "ws") + `/ws/chat/${token}`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "error") {
        Alert.alert("GRID MODERATOR", data.content);
      } else {
        setMessages((prev) => [...prev, data]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }
    };
    ws.current.onclose = () => setTimeout(connectChat, 3000);
  };

  useEffect(() => {
    if (tab === "chat") {
      listChatHistory().then(res => setMessages(res.messages));
      connectChat();
    }
    return () => ws.current?.close();
  }, [tab]);

  const sendMsg = () => {
    if (!msgInput.trim() || !ws.current) return;
    ws.current.send(JSON.stringify({ content: msgInput.trim() }));
    setMsgInput("");
  };

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const r = await listReports();
      setItems(r.reports);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (tab === "intel") loadReports();
  }, [tab, loadReports]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.overline}>OPERATIONS</Text>
        <Text style={styles.title}>TUTTO IL MONDO DI VYRO</Text>
        
        <View style={styles.tabBar}>
          <TouchableOpacity style={[styles.tab, tab === "chat" && styles.tabActive]} onPress={() => setTab("chat")}>
            <Ionicons name="chatbubbles" size={18} color={tab === "chat" ? "#000" : theme.textMuted} />
            <Text style={[styles.tabText, tab === "chat" && { color: "#000" }]}>GRID: PARLIAMO DI TUTTO</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === "intel" && styles.tabActive]} onPress={() => setTab("intel")}>
            <Ionicons name="radio" size={18} color={tab === "intel" ? "#000" : theme.textMuted} />
            <Text style={[styles.tabText, tab === "intel" && { color: "#000" }]}>LIVE INTEL</Text>
          </TouchableOpacity>
        </View>
      </View>

      {tab === "chat" ? (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }} keyboardVerticalOffset={100}>
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(m, i) => m.id || `msg-${i}`}
            contentContainerStyle={{ padding: 16 }}
            renderItem={({ item }) => (
              <View style={[styles.msgBox, item.type === "system" && styles.msgSystem, item.is_admin && styles.msgAdmin]}>
                {item.type !== "system" && (
                  <View style={styles.msgHeader}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.msgUser, { color: item.avatar_color || theme.primary }]}>{item.username}</Text>
                      {item.is_admin && <Ionicons name="shield-checkmark" size={12} color={theme.secondary} />}
                    </View>
                    <Text style={styles.msgTime}>{timeAgo(item.time)}</Text>
                  </View>
                )}
                <Text style={[styles.msgText, item.type === "system" && styles.msgSystemText, item.is_admin && styles.msgAdminText]}>
                  {item.content}
                </Text>
              </View>
            )}
          />

          <View style={styles.inputArea}>
            <TextInput style={styles.input} placeholder="Broadcast to grid..." placeholderTextColor={theme.textMuted} value={msgInput} onChangeText={setMsgInput} multiline />
            <TouchableOpacity style={styles.sendBtn} onPress={sendMsg}>
              <Ionicons name="send" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadReports} tintColor={theme.primary} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <View style={[styles.badge, { borderColor: reportColors[item.type] }]}>
                  <Text style={[styles.badgeText, { color: reportColors[item.type] }]}>{reportLabels[item.type].toUpperCase()}</Text>
                </View>
                <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
              </View>
              <Text style={styles.user}>{item.username}</Text>
              <Text style={styles.note}>{item.note}</Text>
            </View>
          )}
        />
      )}

      {user?.is_admin && (
        <TouchableOpacity style={styles.adminPanel} onPress={() => Alert.alert("ADMIN CONSOLE", "Accessing Grid Management Tools...")}>
           <Ionicons name="shield" size={24} color="#000" />
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  overline: { color: theme.secondary, fontSize: 11, letterSpacing: 3, fontWeight: "900" },
  title: { color: theme.textPrimary, fontSize: 40, fontWeight: "900", letterSpacing: -1, marginTop: 4 },
  tabBar: { flexDirection: "row", gap: 12, marginTop: 20 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: theme.surface, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.border },
  tabActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  tabText: { color: theme.textMuted, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  msgBox: { backgroundColor: theme.surface, padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: theme.border },
  msgSystem: { backgroundColor: "transparent", borderColor: theme.secondary + "22", borderStyle: "dashed" },
  msgHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  msgUser: { fontSize: 12, fontWeight: "900", letterSpacing: 1 },
  msgTime: { fontSize: 10, color: theme.textMuted },
  msgText: { color: theme.textPrimary, fontSize: 14, lineHeight: 20 },
  msgSystemText: { color: theme.secondary, fontSize: 12, fontStyle: "italic", textAlign: "center" },
  msgAdmin: { borderColor: theme.secondary + "66", borderWidth: 1.5, backgroundColor: theme.secondary + "11" },
  msgAdminText: { color: theme.textPrimary, fontWeight: "500" },
  inputArea: { flexDirection: "row", padding: 16, paddingBottom: Platform.OS === "ios" ? 32 : 16, backgroundColor: theme.bg, borderTopWidth: 1, borderTopColor: theme.border, gap: 12, alignItems: "center" },
  input: { flex: 1, backgroundColor: theme.surface, color: theme.textPrimary, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, fontSize: 14, maxHeight: 100 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.primary, alignItems: "center", justifyContent: "center" },
  premiumInputLock: { height: 60, marginHorizontal: 16, marginBottom: Platform.OS === "ios" ? 32 : 16, borderRadius: 16, borderWidth: 1, borderColor: theme.primary + "44", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, overflow: "hidden" },
  lockText: { color: theme.primary, fontWeight: "900", fontSize: 11, letterSpacing: 1 },
  adminPanel: { position: 'absolute', bottom: 120, right: 20, backgroundColor: theme.secondary, width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', ...theme.glows.secondary },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  time: { color: theme.textMuted, fontSize: 11, fontWeight: "700" },
  user: { color: theme.textPrimary, fontWeight: "700", fontSize: 14 },
  note: { color: theme.textSecondary, fontSize: 13, marginTop: 8 },
});
