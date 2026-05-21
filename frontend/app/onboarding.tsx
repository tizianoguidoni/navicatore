import { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Dimensions,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { theme } from "../src/theme";
import { useTranslation } from "../src/i18n";

const { width } = Dimensions.get("window");

const slides = [
  {
    title: "TACTICAL\nNAVIGATION",
    subtitle: "Real-time traffic intel, community-verified. Drive smarter.",
    img: "https://images.unsplash.com/photo-1584735414166-8c436d5854ac?auto=format&fit=crop&q=80&w=800&fm=webp",
  },
  {
    title: "VEHICLE-AWARE\nROUTING",
    subtitle: "Cars. Vans. Campers. Trucks. VYRO adapts to your ride.",
    img: "https://images.unsplash.com/photo-1759926953612-e48779f26629?auto=format&fit=crop&q=80&w=800&fm=webp",
  },
  {
    title: "LEVEL UP\nEVERY DRIVE",
    subtitle: "Earn XP, unlock badges, climb the leaderboard.",
    img: "https://images.pexels.com/photos/5322558/pexels-photo-5322558.jpeg?auto=compress&cs=tinysrgb&w=800",
  },
];

export default function Onboarding() {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(0);
  const ref = useRef<ScrollView>(null);
  const router = useRouter();

  const slides = [
    {
      title: t("welcome"),
      subtitle: "Real-time traffic intel, community-verified. Drive smarter.",
      img: "https://images.unsplash.com/photo-1584735414166-8c436d5854ac?auto=format&fit=crop&q=80&w=800&fm=webp",
    },
    {
      title: "VEHICLE-AWARE\nROUTING",
      subtitle: "Cars. Vans. Campers. Trucks. VYRO adapts to your ride.",
      img: "https://images.unsplash.com/photo-1759926953612-e48779f26629?auto=format&fit=crop&q=80&w=800&fm=webp",
    },
    {
      title: "LEVEL UP\nEVERY DRIVE",
      subtitle: "Earn XP, unlock badges, climb the leaderboard.",
      img: "https://images.pexels.com/photos/5322558/pexels-photo-5322558.jpeg?auto=compress&cs=tinysrgb&w=800",
    },
  ];

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== idx) setIdx(i);
  };

  const next = async () => {
    if (idx < slides.length - 1) {
      const n = idx + 1;
      setIdx(n);
      ref.current?.scrollTo({ x: n * width, animated: true });
    } else {
      await AsyncStorage.setItem("vyro_onboarded", "1");
      router.replace("/auth/signup");
    }
  };

  const skip = async () => {
    await AsyncStorage.setItem("vyro_onboarded", "1");
    router.replace("/auth/login");
  };

  return (
    <View style={styles.container} testID="onboarding-screen">
      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
      >
        {slides.map((s, i) => (
          <View key={i} style={[styles.slide, { width }]}>
            <Image source={{ uri: s.img }} style={styles.img} resizeMode="cover" />
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.7)", "#0A0A0A"]}
              style={styles.grad}
            />
          </View>
        ))}
      </ScrollView>

      <SafeAreaView style={[styles.overlay, { pointerEvents: "box-none" }]}>
        <View style={styles.top}>
          <Text 
            style={styles.brand} 
            accessibilityRole="header" 
            aria-level="1"
          >
            VYRO
          </Text>
          <TouchableOpacity 
            onPress={skip} 
            testID="onboarding-skip"
            accessibilityRole="button"
            accessibilityLabel={t("skip")}
            accessibilityHint="Ti porta direttamente al login"
          >
            <Text style={styles.skip}>{t("skip")}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottom}>
          <Text 
            style={styles.title}
            accessibilityRole="header"
            aria-level="2"
          >
            {slides[idx].title}
          </Text>
          <Text style={styles.subtitle}>{slides[idx].subtitle}</Text>

          <View style={styles.dots} accessibilityLabel={`Slide ${idx + 1} di ${slides.length}`}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === idx ? styles.dotActive : undefined,
                ]}
              />
            ))}
          </View>

          <TouchableOpacity 
            style={styles.cta} 
            onPress={next} 
            testID="onboarding-next"
            accessibilityRole="button"
            accessibilityLabel={idx === slides.length - 1 ? t("start") : t("next")}
          >
            <Text style={styles.ctaText}>
              {idx === slides.length - 1 ? t("start") : t("next")}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  slide: { flex: 1 },
  img: { width: "100%", height: "100%", opacity: 0.55 },
  grad: { position: "absolute", inset: 0 as any, top: 0, left: 0, right: 0, bottom: 0 },
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "space-between" },
  top: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingTop: 24,
  },
  brand: { color: theme.primary, fontSize: 28, fontWeight: "900", letterSpacing: 3 },
  skip: { color: theme.textSecondary, fontSize: 12, letterSpacing: 2, fontWeight: "700" },
  bottom: { paddingHorizontal: 28, paddingBottom: 48 },
  title: {
    color: theme.textPrimary,
    fontSize: 44,
    fontWeight: "900",
    letterSpacing: -1,
    lineHeight: 48,
    textTransform: "uppercase",
  },
  subtitle: {
    color: theme.textSecondary,
    fontSize: 15,
    marginTop: 12,
    lineHeight: 22,
  },
  dots: { flexDirection: "row", gap: 8, marginTop: 32, marginBottom: 24 },
  dot: { width: 24, height: 4, backgroundColor: theme.border, borderRadius: 2 },
  dotActive: { backgroundColor: theme.primary, width: 40 },
  cta: {
    backgroundColor: theme.primary,
    paddingVertical: 18,
    borderRadius: 999,
    alignItems: "center",
  },
  ctaText: {
    color: "#000",
    fontWeight: "900",
    fontSize: 15,
    letterSpacing: 2,
  },
});
