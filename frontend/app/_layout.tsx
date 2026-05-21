import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as SplashScreen from "expo-splash-screen";
import { AuthProvider, useAuth } from "../src/auth";

// Impedisce la chiusura automatica dello splash screen
SplashScreen.preventAutoHideAsync();

import WebAdBanner from "../src/components/WebAdBanner";

function RootContent() {
  const { loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      // Quando l'app è pronta, nasconde lo splash screen con un piccolo delay per sicurezza
      setTimeout(() => {
        SplashScreen.hideAsync();
      }, 500);
    }
  }, [loading]);

  return (
    <>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#0A0A0A" } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="premium" options={{ presentation: "modal" }} />
        <Stack.Screen name="navigation" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: "#0A0A0A" }}>
      <SafeAreaProvider>
        <AuthProvider>
          <RootContent />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
