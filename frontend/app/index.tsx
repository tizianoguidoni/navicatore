import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Image } from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../src/auth";
import { theme } from "../src/theme";
import SplashAd from "../src/components/SplashAd";

// Variabile globale per tracciare se l'ad è stato mostrato in questa sessione (non persiste tra riavvii totali)
let adShownThisSession = false;

export default function Index() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [showAd, setShowAd] = useState(!adShownThisSession);

  useEffect(() => {
    if (loading || showAd) return;
    
    (async () => {
      // Segna come mostrato per evitare ripetizioni nello stesso ciclo di vita
      adShownThisSession = true;

      if (user) {
        // Controllo se c'è una navigazione attiva (es. salvata in AsyncStorage)
        const activeNav = await AsyncStorage.getItem("vyro_active_nav");
        if (activeNav === "1") {
          router.replace("/navigation"); // Salta l'ad e torna in navigazione
          return;
        }
        router.replace("/(tabs)/map");
        return;
      }
      
      const seen = await AsyncStorage.getItem("vyro_onboarded");
      if (seen === "1") {
        router.replace("/auth/login");
      } else {
        router.replace("/onboarding");
      }
    })();
  }, [user, loading, router, showAd]);

  // Se l'ad è già stato mostrato o siamo in caricamento, non lo mostriamo di nuovo
  if (showAd && !adShownThisSession) {
    return <SplashAd onFinish={() => setShowAd(false)} />;
  }

  return (
    <View style={styles.container} testID="splash-screen">
      <Image 
        source={require('../assets/logo.png')} 
        style={{ width: 180, height: 180 }}
        resizeMode="contain"
      />
      <Text style={styles.tag}>NAVIGATE. REPORT. DOMINATE.</Text>
      <ActivityIndicator color={theme.primary} style={{ marginTop: 24 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    color: theme.primary,
    fontSize: 72,
    fontWeight: "900",
    letterSpacing: 4,
  },
  tag: {
    color: theme.textSecondary,
    fontSize: 12,
    letterSpacing: 4,
    marginTop: 8,
    fontWeight: "700",
  },
});
