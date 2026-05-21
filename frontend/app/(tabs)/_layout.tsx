import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarStyle: {
          backgroundColor: "#09090b",
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: 72,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 1.5,
        },
      }}
    >
      <Tabs.Screen
        name="map"
        options={{
          title: "MAP",
          tabBarIcon: ({ color }) => <Ionicons name="navigate" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "COMMUNITY",
          tabBarIcon: ({ color }) => <Ionicons name="radio" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="garage"
        options={{
          title: "GARAGE",
          tabBarIcon: ({ color }) => <Ionicons name="car-sport" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "PROFILE",
          tabBarIcon: ({ color }) => <Ionicons name="person-circle" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
