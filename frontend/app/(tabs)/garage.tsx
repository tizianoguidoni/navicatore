import { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../../src/theme";
import { useAuth } from "../../src/auth";
import { updateVehicle, VehicleProfile } from "../../src/api";

const VEHICLES = [
  { id: "car", label: "CAR", icon: "car-sport" },
  { id: "van", label: "VAN", icon: "bus" },
  { id: "camper", label: "CAMPER", icon: "home" },
  { id: "truck", label: "TRUCK", icon: "cube" },
] as const;

const MODES = [
  { id: "fast", label: "FAST", desc: "Minimum ETA", color: theme.primary },
  { id: "safe", label: "SAFE", desc: "Avoid risks", color: theme.info },
  { id: "eco", label: "ECO", desc: "Save fuel", color: theme.secondary },
  { id: "scenic", label: "SCENIC", desc: "Beautiful roads", color: theme.accent },
] as const;

const PRESETS: Record<string, any[]> = {
  car: [
    { id: 'fiat500', brand: 'Fiat', model: '500', h: 1.49, w: 1.63, l: 3.57, kg: 1050 },
    { id: 'fordfocus', brand: 'Ford', model: 'Focus', h: 1.48, w: 1.83, l: 4.38, kg: 1350 },
    { id: 'toyotacorolla', brand: 'Toyota', model: 'Corolla', h: 1.43, w: 1.79, l: 4.37, kg: 1400 },
    { id: 'audia4', brand: 'Audi', model: 'A4', h: 1.43, w: 1.85, l: 4.76, kg: 1550 },
    { id: 'mercedesglc', brand: 'Mercedes', model: 'GLC', h: 1.64, w: 1.89, l: 4.71, kg: 1800 },
    { id: 'custom', brand: 'Altro', model: '(Custom)' }
  ],
  van: [
    { id: 'fiatducato', brand: 'Fiat', model: 'Ducato', h: 2.52, w: 2.05, l: 5.41, kg: 2800 },
    { id: 'fordtransit', brand: 'Ford', model: 'Transit', h: 2.5, w: 2.06, l: 5.53, kg: 2500 },
    { id: 'custom', brand: 'Altro', model: '(Custom)' }
  ],
  camper: [
    { id: 'hymer', brand: 'Hymer', model: 'B-Class', h: 2.96, w: 2.35, l: 7.39, kg: 3500 },
    { id: 'fiatducato_camper', brand: 'Fiat', model: 'Ducato Camper', h: 2.75, w: 2.05, l: 6.00, kg: 3300 },
    { id: 'custom', brand: 'Altro', model: '(Custom)' }
  ],
  truck: [
    { id: 'ivecostralis', brand: 'Iveco', model: 'Stralis', h: 3.8, w: 2.55, l: 16.5, kg: 18000 },
    { id: 'custom', brand: 'Altro', model: '(Custom)' }
  ]
};

const VEHICLE_IMAGES: Record<string, string> = {
  car: "https://images.unsplash.com/photo-1759926953612-e48779f26629?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjh8MHwxfHNlYXJjaHwxfHxzcG9ydHMlMjBjYXIlMjBuZW9uJTIwZGFya3xlbnwwfHx8fDE3N755391980&ixlib=rb-4.1.0&q=85",
  van: "https://images.unsplash.com/photo-1518331647614-7a1f04cd34cf?q=80&w=1000&auto=format&fit=crop",
  camper: "https://images.unsplash.com/photo-1523987355523-c7b5b0dd90a7?q=80&w=1000&auto=format&fit=crop",
  truck: "https://images.unsplash.com/photo-1586191712102-141e6e4d9f9d?q=80&w=1000&auto=format&fit=crop",
};

export default function Garage() {
  const { user, refresh } = useAuth();
  const [v, setV] = useState<VehicleProfile>(
    user?.vehicle || {
      type: "car",
      height_m: 1.5,
      width_m: 1.8,
      length_m: 4.5,
      weight_kg: 1500,
      driving_mode: "fast",
    }
  );
  const [selectedPreset, setSelectedPreset] = useState("custom");
  const [saving, setSaving] = useState(false);
  const [fuel, setFuel] = useState("gasoline");

  useEffect(() => {
    if (user?.vehicle) setV(user.vehicle);
  }, [user]);

  const save = async () => {
    setSaving(true);
    try {
      await updateVehicle(v);
      await refresh();
      Alert.alert("SAVED", "Vehicle profile updated");
    } catch (e: any) {
      Alert.alert("Error", "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof VehicleProfile>(k: K, val: VehicleProfile[K]) =>
    setV((p) => ({ ...p, [k]: val }));

  const applyPreset = (p: any) => {
    setSelectedPreset(p.id);
    if (p.id !== 'custom') {
      setV((prev) => ({
        ...prev,
        height_m: p.h,
        width_m: p.w,
        length_m: p.l,
        weight_kg: p.kg,
      }));
    }
  };

  const isOversized = v.type === "truck" || (v.height_m ?? 0) > 3.0 || (v.weight_kg ?? 0) > 7500;

  return (
    <SafeAreaView style={styles.safe} testID="garage-screen">
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ paddingHorizontal: 24, paddingTop: 8 }}>
            <Text style={styles.overline}>YOUR RIDE</Text>
            <Text style={styles.title}>GARAGE</Text>
            <Text style={styles.sub}>Route engine adapts to vehicle dimensions</Text>
          </View>

          <Image
            source={{
              uri: VEHICLE_IMAGES[v.type ?? "car"] || VEHICLE_IMAGES.car,
            }}
            style={styles.hero}
            resizeMode="cover"
          />

          {isOversized && (
            <View style={styles.warnBanner}>
              <Ionicons name="warning" size={18} color="#000" />
              <Text style={styles.warnBannerText}>TRUCK RESTRICTIONS APPLY: Bridges & narrow roads will be avoided.</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.secTitle}>VEHICLE TYPE</Text>
            <View style={styles.grid}>
              {VEHICLES.map((vt) => {
                const active = v.type === vt.id;
                return (
                  <TouchableOpacity
                    key={vt.id}
                    style={[styles.vCard, active && styles.vCardActive]}
                    onPress={() => {
                      update("type", vt.id);
                      setSelectedPreset("custom"); // reset preset on type change
                    }}
                    testID={`vehicle-${vt.id}`}
                  >
                    <Ionicons
                      name={vt.icon as any}
                      size={28}
                      color={active ? theme.primary : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.vLabel,
                        active && { color: theme.primary },
                      ]}
                    >
                      {vt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.secTitle}>BRAND & MODEL</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24, paddingHorizontal: 24 }}>
              {PRESETS[v.type ?? "car"]?.map((p: any) => {
                const active = selectedPreset === p.id;
                return (
                  <TouchableOpacity
                    key={p.id}
                    style={[styles.presetCard, active && styles.presetCardActive]}
                    onPress={() => applyPreset(p)}
                  >
                    <Text style={[styles.presetBrand, active && { color: theme.primary }]}>{p.brand}</Text>
                    <Text style={[styles.presetModel, active && { color: '#fff' }]}>{p.model}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <Text style={styles.secTitle}>DIMENSIONS</Text>
            <View style={styles.dimRow}>
              <DimField
                label="HEIGHT (M)"
                value={v.height_m ?? 0}
                onChange={(n) => update("height_m", n)}
                tid="dim-height"
              />
              <DimField
                label="WIDTH (M)"
                value={v.width_m ?? 0}
                onChange={(n) => update("width_m", n)}
                tid="dim-width"
              />
            </View>
            <View style={styles.dimRow}>
              <DimField
                label="LENGTH (M)"
                value={v.length_m ?? 0}
                onChange={(n) => update("length_m", n)}
                tid="dim-length"
              />
              <DimField
                label="WEIGHT (KG)"
                value={v.weight_kg ?? 0}
                onChange={(n) => update("weight_kg", n)}
                tid="dim-weight"
                wide
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.secTitle}>DRIVING MODE</Text>
            <View style={styles.grid}>
              {MODES.map((m) => {
                const active = v.driving_mode === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.mCard,
                      active && { borderColor: m.color, backgroundColor: m.color + "15" },
                    ]}
                    onPress={() => update("driving_mode", m.id)}
                    testID={`mode-${m.id}`}
                  >
                    <Text
                      style={[
                        styles.mLabel,
                        active && { color: m.color },
                      ]}
                    >
                      {m.label}
                    </Text>
                    <Text style={styles.mDesc}>{m.desc}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.secTitle}>FUEL TYPE</Text>
            <View style={styles.grid}>
              {["DIESEL", "GASOLINE", "ELECTRIC"].map((f) => {
                const active = fuel === f.toLowerCase();
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.fCard, active && styles.fCardActive]}
                    onPress={() => setFuel(f.toLowerCase())}
                  >
                    <Text style={[styles.fLabel, active && { color: theme.primary }]}>{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.save, saving && { opacity: 0.7 }]}
            onPress={save}
            disabled={saving}
            testID="garage-save"
          >
            <Text style={styles.saveText}>{saving ? "SAVING..." : "SAVE PROFILE"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function DimField({
  label,
  value,
  onChange,
  tid,
  wide,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  tid: string;
  wide?: boolean;
}) {
  return (
    <View style={[styles.dim, wide && { flex: 1 }]}>
      <Text style={styles.dimLabel}>{label}</Text>
      <TextInput
        style={styles.dimInput}
        value={String(value)}
        onChangeText={(t) => onChange(parseFloat(t) || 0)}
        keyboardType="decimal-pad"
        placeholderTextColor={theme.textMuted}
        testID={tid}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  scroll: { paddingBottom: 120 },
  overline: {
    color: theme.primary,
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: "900",
  },
  title: {
    color: theme.textPrimary,
    fontSize: 40,
    fontWeight: "900",
    letterSpacing: -1,
    marginTop: 4,
  },
  sub: { color: theme.textSecondary, fontSize: 13, marginTop: 4 },
  hero: {
    width: "100%",
    height: 180,
    marginTop: 16,
    opacity: 0.9,
  },
  section: { paddingHorizontal: 24, marginTop: 24 },
  secTitle: {
    color: theme.textMuted,
    fontSize: 11,
    letterSpacing: 2.5,
    fontWeight: "900",
    marginBottom: 12,
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  vCard: {
    flexBasis: "47%",
    flexGrow: 1,
    paddingVertical: 20,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    backgroundColor: theme.surface,
    alignItems: "center",
    gap: 8,
  },
  vCardActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + "10",
  },
  vLabel: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
  },
  dimRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  dim: { flex: 1 },
  dimLabel: {
    color: theme.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "900",
    marginBottom: 6,
  },
  dimInput: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 18,
    fontWeight: "700",
  },
  mCard: {
    flexBasis: "47%",
    flexGrow: 1,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    backgroundColor: theme.surface,
  },
  mLabel: { color: theme.textPrimary, fontWeight: "900", letterSpacing: 2 },
  mDesc: { color: theme.textMuted, fontSize: 11, marginTop: 4 },
  save: {
    marginHorizontal: 24,
    marginTop: 28,
    paddingVertical: 18,
    backgroundColor: theme.primary,
    borderRadius: 999,
    alignItems: "center",
  },
  saveText: { color: "#000", fontWeight: "900", letterSpacing: 2 },
  warnBanner: {
    backgroundColor: theme.primary,
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
    gap: 10,
    marginHorizontal: 24,
    borderRadius: 12,
    marginTop: -20,
    zIndex: 10,
  },
  warnBannerText: {
    color: "#000",
    fontSize: 11,
    fontWeight: "900",
    flex: 1,
  },
  fCard: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: theme.surface,
  },
  fCardActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + "10",
  },
  fLabel: {
    color: theme.textSecondary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  presetCard: {
    width: 140,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 16,
    backgroundColor: theme.surface,
  },
  presetCardActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + "10",
  },
  presetBrand: {
    color: theme.textSecondary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginBottom: 4,
  },
  presetModel: {
    color: theme.textPrimary,
    fontSize: 16,
    fontWeight: "800",
  },
});
