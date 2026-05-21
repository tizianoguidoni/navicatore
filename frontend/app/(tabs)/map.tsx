import { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Animated,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Location from "expo-location";
import { theme, reportColors, reportLabels, reportIcons } from "../../src/theme";
import { useAuth } from "../../src/auth";
import { useTranslation } from "../../src/i18n";
import { createReport, listReports, suggestRoute, getFavorites, saveFavorite, FavoritePlace, ReportItem, updateVehicle, VehicleProfile, advancedGeocode, GeocodeResult, geocodeCivico } from "../../src/api";
import MapLibreView from "../../src/components/MapLibreView";

// ─── Geolocalizzazione cross-platform ────────────────────────────────────────
// Su web usa navigator.geolocation direttamente (più affidabile di expo-location)
const getWebPosition = (): Promise<[number, number]> =>
  new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('geolocation_unavailable'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.longitude, pos.coords.latitude]),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  });

let webWatchId: number | null = null;
const watchWebPosition = (cb: (coords: [number, number]) => void) => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return;
  if (webWatchId !== null) navigator.geolocation.clearWatch(webWatchId);
  webWatchId = navigator.geolocation.watchPosition(
    (pos) => cb([pos.coords.longitude, pos.coords.latitude]),
    () => { },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
  );
};
const clearWebWatch = () => {
  if (webWatchId !== null && typeof navigator !== 'undefined') {
    navigator.geolocation.clearWatch(webWatchId);
    webWatchId = null;
  }
};



const REPORT_TYPES: ("accident" | "police" | "hazard" | "closure")[] = [
  "accident",
  "police",
  "hazard",
  "closure",
];

// ─── Garage: Auto / Camper / Van ─────────────────────────────────────────────
type GarageCategory = "auto" | "camper" | "van";

const GARAGE_DATA: Record<GarageCategory, { brand: string; models: { model: string; height: number; length: number; width: number }[] }[]> = {
  auto: [
    {
      brand: "Fiat", models: [
        { model: "Panda", height: 1.56, length: 3.69, width: 1.64 },
        { model: "500", height: 1.49, length: 3.57, width: 1.65 },
        { model: "Tipo", height: 1.50, length: 4.37, width: 1.79 },
      ]
    },
    {
      brand: "Ford", models: [
        { model: "Fiesta", height: 1.47, length: 4.04, width: 1.72 },
        { model: "Focus", height: 1.45, length: 4.38, width: 1.83 },
        { model: "Kuga", height: 1.68, length: 4.61, width: 1.88 },
      ]
    },
    {
      brand: "Toyota", models: [
        { model: "Yaris", height: 1.50, length: 3.94, width: 1.74 },
        { model: "Corolla", height: 1.44, length: 4.37, width: 1.79 },
        { model: "RAV4", height: 1.69, length: 4.60, width: 1.86 },
      ]
    },
    {
      brand: "Mercedes", models: [
        { model: "Classe A", height: 1.43, length: 4.42, width: 1.80 },
        { model: "Classe C", height: 1.44, length: 4.75, width: 1.82 },
        { model: "GLA", height: 1.62, length: 4.41, width: 1.83 },
      ]
    },
    {
      brand: "Audi", models: [
        { model: "A1", height: 1.42, length: 4.03, width: 1.74 },
        { model: "A3", height: 1.45, length: 4.35, width: 1.82 },
        { model: "Q5", height: 1.66, length: 4.67, width: 1.89 },
      ]
    },
  ],
  camper: [
    {
      brand: "Fiat", models: [
        { model: "Ducato Camper", height: 2.60, length: 6.36, width: 2.05 },
        { model: "Ducato Maxi", height: 2.75, length: 7.20, width: 2.05 },
      ]
    },
    {
      brand: "Ford", models: [
        { model: "Transit Camper", height: 2.60, length: 6.00, width: 2.00 },
      ]
    },
    {
      brand: "Volkswagen", models: [
        { model: "California", height: 1.99, length: 4.90, width: 1.94 },
        { model: "Crafter Camper", height: 2.80, length: 7.40, width: 2.07 },
      ]
    },
    {
      brand: "Knaus", models: [
        { model: "Van TI Plus", height: 2.60, length: 5.99, width: 2.10 },
        { model: "Van TI 650 MEG", height: 2.80, length: 6.49, width: 2.28 },
      ]
    },
    {
      brand: "Bürstner", models: [
        { model: "Lyseo TD 744", height: 2.90, length: 7.46, width: 2.35 },
      ]
    },
  ],
  van: [
    {
      brand: "Fiat", models: [
        { model: "Doblò Cargo", height: 1.84, length: 4.39, width: 1.83 },
        { model: "Ducato", height: 2.52, length: 5.41, width: 2.03 },
        { model: "Ducato XL", height: 2.52, length: 6.36, width: 2.03 },
      ]
    },
    {
      brand: "Ford", models: [
        { model: "Transit Connect", height: 1.83, length: 4.42, width: 1.83 },
        { model: "Transit Custom", height: 1.98, length: 4.97, width: 2.04 },
        { model: "Transit", height: 2.37, length: 5.53, width: 2.06 },
      ]
    },
    {
      brand: "Volkswagen", models: [
        { model: "Caddy Cargo", height: 1.79, length: 4.50, width: 1.86 },
        { model: "Transporter", height: 1.97, length: 4.90, width: 1.90 },
        { model: "Crafter", height: 2.59, length: 5.99, width: 2.07 },
      ]
    },
    {
      brand: "Mercedes", models: [
        { model: "Vito Cargo", height: 1.90, length: 4.90, width: 1.93 },
        { model: "Sprinter", height: 2.59, length: 5.91, width: 1.99 },
        { model: "Sprinter Extra Long", height: 2.59, length: 7.37, width: 1.99 },
      ]
    },
    {
      brand: "Renault", models: [
        { model: "Kangoo Express", height: 1.80, length: 4.28, width: 1.83 },
        { model: "Trafic", height: 1.97, length: 4.99, width: 1.96 },
        { model: "Master", height: 2.47, length: 5.55, width: 2.07 },
      ]
    },
  ],
};

const GARAGE_ICONS: Record<GarageCategory, string> = {
  auto: "car-sport",
  camper: "home",
  van: "cube",
};
const GARAGE_LABELS: Record<GarageCategory, string> = {
  auto: "AUTO",
  camper: "CAMPER",
  van: "VAN / FURGONE",
};

export default function MapScreen() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const { t } = useTranslation();
  const [reportOpen, setReportOpen] = useState(false);
  const [routeOpen, setRouteOpen] = useState(false);
  const [origin, setOrigin] = useState("Current location");
  const [destination, setDestination] = useState("");
  const [housenumber, setHousenumber] = useState("");
  const [exponent, setExponent] = useState("");
  const mapRef = useRef<any>(null);

  const buildCivico = () => {
    if (!housenumber.trim()) return "";
    return exponent.trim()
      ? `${housenumber.trim()}/${exponent.trim().toUpperCase()}`
      : housenumber.trim();
  };
  const [suggestion, setSuggestion] = useState<any>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [posting, setPosting] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [currentLoc, setCurrentLoc] = useState<[number, number] | null>(null);
  const [geocodedAddress, setGeocodedAddress] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    requestLocation();
  }, []);

  const routeAnim = useRef(new Animated.Value(0)).current;

  // Nuovi state per il routing
  const [transportMode, setTransportMode] = useState<"auto" | "moto" | "mezzi" | "piedi">("auto");
  const [avoidTolls, setAvoidTolls] = useState(false);
  const [avoidZTL, setAvoidZTL] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedOriginCoords, setSelectedOriginCoords] = useState<[number, number] | null>(null);
  const [selectedDestCoords, setSelectedDestCoords] = useState<[number, number] | null>(null);
  const searchTimeout = useRef<any>(null);
  const [favorites, setFavorites] = useState<FavoritePlace[]>([]);

  // Garage
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [garageCategory, setGarageCategory] = useState<GarageCategory>("auto");
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleProfile | null>(null);
  const [customHeight, setCustomHeight] = useState("");
  const [customLength, setCustomLength] = useState("");
  const [customWidth, setCustomWidth] = useState("");

  useEffect(() => {
    if (user?.vehicle) {
      setSelectedVehicle(user.vehicle);
    }
  }, [user?.vehicle]);

  const requestLocation = async () => {
    try {
      if (Platform.OS === 'web') {
        // Su web usa navigator.geolocation direttamente
        const coords = await getWebPosition();
        setCurrentLoc(coords);
        return;
      }
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        if (!currentLoc) setCurrentLoc([12.4964, 41.9028]);
        return;
      }
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000))
      ]) as Location.LocationObject;
      setCurrentLoc([loc.coords.longitude, loc.coords.latitude]);
    } catch (e) {
      console.warn('Location error:', e);
      if (!currentLoc) setCurrentLoc([12.4964, 41.9028]);
    }
  };

  useEffect(() => {
    requestLocation();

    // Fallback di sicurezza dopo 10s
    const safetyTimer = setTimeout(() => {
      setCurrentLoc(prev => prev ?? [12.4964, 41.9028]);
    }, 10000);

    if (Platform.OS === 'web') {
      // Watch position tramite browser API nativa
      watchWebPosition((coords) => setCurrentLoc(coords));
      return () => { clearTimeout(safetyTimer); clearWebWatch(); };
    } else {
      // Watch position tramite expo-location su native
      const subPromise = Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 10 },
        (loc) => setCurrentLoc([loc.coords.longitude, loc.coords.latitude])
      );
      return () => {
        clearTimeout(safetyTimer);
        subPromise.then(s => { try { s?.remove(); } catch (_) { } });
      };
    }
  }, []);

  useEffect(() => {
    if (suggestion) {
      Animated.timing(routeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: false,
      }).start();
    } else {
      routeAnim.setValue(0);
    }
  }, [suggestion]);

  const loadReports = useCallback(async () => {
    try {
      const r = await listReports();
      setReports(r.reports);
    } catch { }
  }, []);

  useEffect(() => {
    loadReports();
    const t = setInterval(loadReports, 15000);
    return () => clearInterval(t);
  }, [loadReports]);

  const loadFavorites = useCallback(async () => {
    try {
      const r = await getFavorites();
      setFavorites(r.favorites);
    } catch (e) {
      console.warn("Load favorites error:", e);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadFavorites();
    }
  }, [user, loadFavorites]);

  const submitReport = async (type: string) => {
    setPosting(type);
    try {
      let lat: number;
      let lng: number;

      if (Platform.OS === 'web') {
        const pos = await getWebPosition();
        [lng, lat] = pos;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Posizione non disponibile", "Autorizza l'accesso alla posizione per inviare segnalazioni.");
          setPosting(null);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      const r = await createReport(type as any, lat, lng, note);
      setReportOpen(false);
      setNote("");
      await loadReports();
      await refresh();
      Alert.alert("✅ SEGNALAZIONE INVIATA", `Grazie per il contributo alla community!\nVerifica AI: ${(r.report?.ai_score * 100)?.toFixed(0) ?? 80}/100`);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail || "Failed to post report");
    } finally {
      setPosting(null);
    }
  };

  const submitRoute = async () => {
    if (!destination.trim() || !selectedDestCoords) {
      Alert.alert("Missing", "Please select a destination from the suggestions");
      return;
    }
    setLoadingRoute(true);
    setSuggestion(null);

    try {
      const civico = buildCivico();
      const fullDest = civico
        ? `${destination}, ${civico}`
        : destination;

      const origin_coords = selectedOriginCoords || currentLoc || [12.4964, 41.9028];
      let apiMode: "car" | "walking" | "bicycle" | "truck" | "bus" | "camper" | "van" = "car";
      
      if (transportMode === "piedi") {
        apiMode = "walking";
      } else if (transportMode === "moto") {
        apiMode = "bicycle";
      } else if (transportMode === "auto") {
        const vType = selectedVehicle?.type || selectedVehicle?.category || user?.vehicle?.type || "car";
        if (vType === "truck") apiMode = "truck";
        else if (vType === "camper") apiMode = "camper";
        else if (vType === "van") apiMode = "van";
        else apiMode = "car";
      }

      // ─── FIX: se c'è un numero civico (digitato separatamente o direttamente), geocodifica le coordinate precise ───
      const hasDirectCivico = /\b\d+(?:\/[A-Za-z0-9]+)?\b/.test(destination);
      const { coords: finalDestCoords, precise } = (civico.trim() || hasDirectCivico)
        ? await geocodeCivico(fullDest, selectedDestCoords)
        : { coords: selectedDestCoords, precise: true };

      if (!precise) {
        Alert.alert(
          "📍 Posizione approssimativa",
          "Non ho trovato il numero civico esatto. La bandierina è posizionata sulla via — verifica l'arrivo.",
          [{ text: "Continua comunque", onPress: () => { } }]
        );
      }
      // ────────────────────────────────────────────────────────────────────────

      const r = await suggestRoute(
        origin,
        fullDest,
        origin_coords as [number, number],
        finalDestCoords,
        apiMode,
        selectedVehicle || user?.vehicle
      );

      if (r.ok && r.suggestion) {
        setSuggestion(r.suggestion);
        // Aggiorniamo le coordinate di destinazione con quelle finali (più precise col civico)
        setSelectedDestCoords(finalDestCoords);
        setGeocodedAddress(fullDest);
        setRouteOpen(false);
      }
    } catch (e: any) {
      Alert.alert("Error", "Could not fetch route");
    } finally {
      setLoadingRoute(false);
    }
  };

  const searchAddress = async (query: string, field: "origin" | "destination", updateText = true) => {
    if (updateText) {
      if (field === "origin") {
        setOrigin(query);
        if (query === "Current location") setSelectedOriginCoords(null);
      } else {
        setDestination(query);
      }
    }

    if (query.length < 3 || query === "Current location") {
      setSearchResults([]);
      setSearching(false);
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
      return;
    }

    setSearching(true);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(async () => {
      try {
        const results = await advancedGeocode(query, currentLoc || undefined);

        // Se stiamo cercando un civico (updateText = false), prendiamo il migliore e aggiorniamo la mappa
        if (!updateText && results.length > 0) {
          const best = results[0];
          // Verifichiamo che il risultato sia effettivamente più specifico (contenga un numero)
          if (/\d/.test(best.display_name)) {
            const lon = parseFloat(best.lon as any);
            const lat = parseFloat(best.lat as any);
            if (!isNaN(lon) && !isNaN(lat)) {
              setSelectedDestCoords([lon, lat]);
              // Feedback visivo immediato: centriamo sul civico trovato
              setCurrentLoc([lon, lat]);
            }
          }
        }
        setSearchResults(results.map(r => ({ ...r, field })));
      } catch (e) {
        console.warn("Search error:", e);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const selectResult = (item: any) => {
    const lon = parseFloat(item.lon);
    const lat = parseFloat(item.lat);
    if (!isNaN(lon) && !isNaN(lat)) {
      if (item.field === "origin") {
        setOrigin(item.display_name);
        setSelectedOriginCoords([lon, lat]);
      } else {
        setDestination(item.display_name);
        setSelectedDestCoords([lon, lat]);
      }
      setSearchResults([]);
    }
  };

  const selectFavorite = (fav: FavoritePlace) => {
    setDestination(fav.address);
    setSelectedDestCoords(fav.coords);
    setSearchResults([]);
  };

  const setAsFavorite = async (label: string) => {
    if (!destination || !selectedDestCoords) return;
    try {
      await saveFavorite({ label, address: destination, coords: selectedDestCoords });
      await loadFavorites();
      Alert.alert("SAVED", `${label} set to: ${destination}`);
    } catch (e) {
      Alert.alert("Error", "Could not save favorite");
    }
  };



  if (!mounted) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator color="#6C2BFF" />
        <Text style={{ color: "#6C2BFF", marginTop: 12, fontSize: 10, letterSpacing: 2 }}>VYRO INITIALIZING...</Text>
      </View>
    );
  }

  return (<View style={styles.container} testID="map-screen"><View style={styles.mapContainer}><MapLibreView ref={mapRef} center={currentLoc || undefined} zoom={15} route={suggestion?.polyline} reports={reports} />{/* Floating Recenter Button */}<TouchableOpacity style={styles.recenterBtn} onPress={() => mapRef.current?.recenter()} testID="recenter-btn" accessibilityRole="button" accessibilityLabel="Ricentra mappa sulla tua posizione"><Ionicons name="locate" size={24} color={theme.primary} /></TouchableOpacity><SafeAreaView style={[styles.overlay, { pointerEvents: "box-none" }]}>
          {/* Top HUD */}
          <View style={styles.topHud}><TouchableOpacity style={styles.hudPill} onPress={() => setRouteOpen(true)} testID="map-search-btn" accessibilityRole="button" accessibilityLabel="Cerca destinazione"><Ionicons name="search" size={16} color={theme.textPrimary} /><Text style={styles.hudPillText} numberOfLines={1}>{destination || t("whereTo")}</Text></TouchableOpacity><View style={styles.hudTrust} testID="map-trust-pill" accessibilityRole="text" accessibilityLabel={`Il tuo punteggio di fiducia è ${user?.trust_score ?? 50}`}><Ionicons name="shield-checkmark" size={14} color={theme.secondary} /><Text style={styles.hudTrustText}>{user?.trust_score ?? 50}</Text></View></View><View style={styles.sideHud}><View style={styles.hudCard} accessibilityRole="header" aria-level="3"><Text style={styles.hudLabel}>{t("speed")}</Text><Text style={styles.hudValue}>0</Text><Text style={styles.hudUnit}>KM/H</Text></View><View style={[styles.hudCard, { marginTop: 10 }]} accessibilityRole="header" aria-level="3"><Text style={styles.hudLabel}>{t("level")}</Text><Text style={[styles.hudValue, { color: theme.secondary }]}>{user?.level ?? 1}</Text><Text style={styles.hudUnit}>{user?.xp ?? 0} XP</Text></View></View>
      {/* Route Summary (GO Button) */}
      {suggestion && (
        <View style={styles.summarySheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.summaryTitle}>{destination}</Text>
              <Text style={styles.summaryMeta}>{suggestion.eta_minutes} min · {suggestion.distance_km} km</Text>
            </View>
            <TouchableOpacity 
              style={styles.goBtn}
              onPress={() => {
                const civico = buildCivico();
                const fullDest = civico ? `${destination}, ${civico}` : destination;
                const origin_coords = selectedOriginCoords || currentLoc || [12.4964, 41.9028];
                router.push({
                  pathname: "/navigation",
                  params: {
                    eta: suggestion.eta_minutes,
                    dist: suggestion.distance_km,
                    polyline: JSON.stringify(suggestion.polyline),
                    steps: JSON.stringify(suggestion.steps),
                    startLng: origin_coords?.[0],
                    startLat: origin_coords?.[1],
                    destName: geocodedAddress || fullDest,
                    destLng: selectedDestCoords?.[0],
                    destLat: selectedDestCoords?.[1],
                    tollPrice: suggestion.tollPrice || "",
                    mode: transportMode === "piedi" ? "walking" : "car",
                    isFallback: (suggestion.tips?.some((t: string) => t.includes("offline")) || !suggestion.hasTraffic) ? "1" : "0"
                  }
                });
              }}
            >
              <Text style={styles.goBtnText}>GO 🚀</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.closeSummary} onPress={() => setSuggestion(null)}>
            <Text style={styles.closeSummaryText}>ANNULLA</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
      {/* Report Modal */}
      <Modal
        visible={reportOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setReportOpen(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalSheet} testID="report-modal">
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>REPORT TO COMMUNITY</Text>
            <Text style={styles.modalSub}>+10 XP per verified report</Text>

            <View style={{ marginTop: 16 }}>
              <Text style={styles.label}>ADD NOTE (OPTIONAL)</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Right lane blocked"
                placeholderTextColor={theme.textMuted}
                value={note}
                onChangeText={setNote}
              />
            </View>

            <View style={styles.reportGrid}>
              {REPORT_TYPES.map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.reportCard, { borderColor: reportColors[t] + "55" }]}
                  onPress={() => submitReport(t)}
                  disabled={posting !== null}
                  testID={`report-${t}`}
                >
                  <View style={[styles.reportIcon, { backgroundColor: reportColors[t] + "22" }]}>
                    {posting === t ? (
                      <ActivityIndicator color={reportColors[t]} />
                    ) : (
                      <Ionicons name={reportIcons[t] as any} size={22} color={reportColors[t]} />
                    )}
                  </View>
                  <Text style={styles.reportLabel}>{reportLabels[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setReportOpen(false)}
              testID="report-modal-cancel"
            >
              <Text style={styles.modalCancelText}>CANCEL</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Route Modal */}
      <Modal
        visible={routeOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setRouteOpen(false)}
      >
        <View style={styles.modalBg}>
          <View style={styles.modalSheet} testID="route-modal">
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>PLAN ROUTE</Text>
            <Text style={styles.modalSub}>
              {transportMode === "auto" ? "AI calculates fastest car route" :
                transportMode === "moto" ? "AI optimizing for motorcycle speed" :
                  transportMode === "mezzi" ? "AI analyzing public transit flow" :
                    "AI pathfinding for pedestrians"}
            </Text>

            <View style={{ marginTop: 16 }}>
              <Text style={styles.label}>FROM</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={origin}
                  onChangeText={(txt) => searchAddress(txt, "origin")}
                  placeholder="Origin"
                  placeholderTextColor={theme.textMuted}
                  testID="route-origin"
                />
                {searching && searchResults[0]?.field === "origin" && <ActivityIndicator size="small" color={theme.primary} style={{ position: 'absolute', right: 12 }} />}
              </View>

              <Text style={[styles.label, { marginTop: 12 }]}>TO</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  value={destination}
                  onChangeText={(txt) => searchAddress(txt, "destination")}
                  placeholder="Destination"
                  placeholderTextColor={theme.textMuted}
                  testID="route-destination"
                />
                {searching && searchResults[0]?.field === "destination" && <ActivityIndicator size="small" color={theme.primary} style={{ position: 'absolute', right: 12 }} />}
              </View>

              {/* Riga numero civico + esponente */}
              <View style={styles.civicoRow}>
                <TextInput
                  style={[styles.input, styles.civicoInput]}
                  placeholder="N° civico"
                  placeholderTextColor={theme.textMuted}
                  value={housenumber}
                  onChangeText={setHousenumber}
                  keyboardType="default"
                  maxLength={6}
                  testID="route-housenumber"
                />
                {housenumber.trim() !== "" && (
                  <Text style={styles.slash}>/</Text>
                )}
                {housenumber.trim() !== "" && (
                  <TextInput
                    style={[styles.input, styles.exponentInput]}
                    placeholder="es. A"
                    placeholderTextColor={theme.textMuted}
                    value={exponent}
                    onChangeText={text => setExponent(text.replace(/[^a-zA-Z0-9]/g, ""))}
                    maxLength={3}
                    autoCapitalize="characters"
                  />
                )}
                {(housenumber || exponent) && (
                  <Text style={styles.civicoPreview}>
                    → {buildCivico()}
                  </Text>
                )}
              </View>

              {searchResults.length > 0 && (
                <View style={styles.resultsContainer}>
                  {searchResults.map((item, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={styles.resultItem}
                      onPress={() => selectResult(item)}
                    >
                      <Ionicons name="location-outline" size={16} color={theme.textSecondary} />
                      <Text style={styles.resultText} numberOfLines={1}>{item.display_name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Quick Favorites Row */}
              <View style={styles.favRow}>
                {['Casa', 'Lavoro'].map((label) => {
                  const fav = favorites.find(f => f.label === label);
                  return (
                    <TouchableOpacity
                      key={label}
                      style={[styles.favPill, fav && styles.favPillActive]}
                      onPress={() => fav ? selectFavorite(fav) : setAsFavorite(label)}
                    >
                      <Ionicons name={label === 'Casa' ? 'home' : 'briefcase'} size={14} color={fav ? "#000" : theme.textMuted} />
                      <Text style={[styles.favLabel, fav && { color: "#000" }]}>
                        {fav ? label.toUpperCase() : `SET ${label.toUpperCase()}`}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Transport Mode Selector */}
            <View style={styles.transportRow}>
              {[
                { id: "auto", icon: "car-sport", label: "AUTO" },
                { id: "moto", icon: "bicycle", label: "MOTO" },
                { id: "mezzi", icon: "bus", label: "MEZZI" },
                { id: "piedi", icon: "walk", label: "A PIEDI" },
              ].map((m) => {
                const active = transportMode === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[styles.tModeBtn, active && styles.tModeBtnActive]}
                    onPress={() => setTransportMode(m.id as any)}
                  >
                    <Ionicons
                      name={m.icon as any}
                      size={20}
                      color={active ? theme.primary : theme.textMuted}
                    />
                    <Text style={[styles.tModeLabel, active && { color: theme.primary }]}>
                      {m.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Route Options (Tolls, ZTL) */}
            <View style={styles.optionsRow}>
              <TouchableOpacity
                style={[styles.optBtn, avoidTolls && styles.optBtnActive]}
                onPress={() => setAvoidTolls(!avoidTolls)}
              >
                <Ionicons name="logo-euro" size={16} color={avoidTolls ? theme.danger : theme.textMuted} />
                <Text style={[styles.optLabel, avoidTolls && { color: theme.danger }]}>
                  {avoidTolls ? "SENZA PEDAGGI" : "CON PEDAGGI"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.optBtn, avoidZTL && styles.optBtnActive]}
                onPress={() => setAvoidZTL(!avoidZTL)}
              >
                <View style={[styles.ztlBadge, avoidZTL && { backgroundColor: theme.danger }]}>
                  <Text style={[styles.ztlText, avoidZTL && { color: "#fff" }]}>Z</Text>
                </View>
                <Text style={[styles.optLabel, avoidZTL && { color: theme.danger }]}>
                  {avoidZTL ? "EVITA ZTL" : "ZTL PERMESSE"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* ── GARAGE: selezione veicolo ─────────────────── */}
            <TouchableOpacity
              style={styles.vehicleBtn}
              onPress={() => setVehicleModalOpen(true)}
            >
              <Ionicons
                name={(selectedVehicle ? GARAGE_ICONS[selectedVehicle.category as GarageCategory] : "car-sport") as any}
                size={16}
                color={selectedVehicle ? theme.primary : theme.textMuted}
              />
              <Text style={[styles.vehicleBtnText, selectedVehicle && { color: theme.primary }]}>
                {selectedVehicle?.brand && selectedVehicle?.model
                  ? `${selectedVehicle.brand} ${selectedVehicle.model}`
                  : "CONFIGURA VEICOLO NEL GARAGE"}
              </Text>
              {selectedVehicle && selectedVehicle.height && (
                <Text style={styles.vehicleDims}>
                  H {selectedVehicle.height}m · L {selectedVehicle.length}m
                </Text>
              )}
              <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.searchBtn, loadingRoute && { opacity: 0.7 }]}
              onPress={submitRoute}
              disabled={loadingRoute}
              testID="route-submit"
            >
              {loadingRoute ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.searchBtnText}>FIND ROUTE</Text>
              )}
            </TouchableOpacity>


            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setRouteOpen(false)}
              testID="route-modal-close"
            >
              <Text style={styles.modalCancelText}>CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── MODAL GARAGE ──────────────────────────────────────────── */}
      <Modal visible={vehicleModalOpen} animationType="slide" transparent onRequestClose={() => setVehicleModalOpen(false)}>
        <View style={styles.modalBg}>
          <View style={[styles.modalSheet, { maxHeight: '92%' }]}>
            <View style={styles.sheetHandle} />
            <Text style={styles.modalTitle}>🅿️ GARAGE</Text>
            <Text style={styles.modalSub}>Seleziona il tuo veicolo per ottimizzare il percorso</Text>

            {/* Tab categorie */}
            <View style={styles.garageTabs}>
              {(Object.keys(GARAGE_LABELS) as GarageCategory[]).map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.garageTab, garageCategory === cat && styles.garageTabActive]}
                  onPress={() => setGarageCategory(cat)}
                >
                  <Ionicons name={GARAGE_ICONS[cat] as any} size={16} color={garageCategory === cat ? "#000" : theme.textMuted} />
                  <Text style={[styles.garageTabText, garageCategory === cat && { color: "#000" }]}>{GARAGE_LABELS[cat]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
              {GARAGE_DATA[garageCategory].map((brand) => (
                <View key={brand.brand}>
                  <Text style={styles.brandLabel}>{brand.brand.toUpperCase()}</Text>
                  {brand.models.map((model) => {
                    const isActive = selectedVehicle?.brand === brand.brand && selectedVehicle?.model === model.model;
                    return (
                      <TouchableOpacity
                        key={model.model}
                        style={[styles.vehicleRow, isActive && styles.vehicleRowActive]}
                        onPress={async () => {
                          const v = { category: garageCategory, brand: brand.brand, ...model };
                          setSelectedVehicle(v);
                          setVehicleModalOpen(false);
                          try {
                            await updateVehicle(v as any);
                            if (refresh) await refresh();
                          } catch (e) {
                            console.error("Failed to save vehicle", e);
                          }
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.vehicleRowName, isActive && { color: theme.primary }]}>{model.model}</Text>
                          <Text style={styles.vehicleRowDims}>H: {model.height}m · L: {model.length}m · W: {model.width}m</Text>
                        </View>
                        {isActive && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}

              {/* Custom */}
              <Text style={styles.brandLabel}>PERSONALIZZATO</Text>
              <View style={styles.customVehicleBox}>
                <TextInput
                  style={styles.input}
                  placeholder="es. 2.10"
                  placeholderTextColor={theme.textMuted}
                  value={customHeight}
                  onChangeText={(txt) => {
                    setCustomHeight(txt);
                    if (txt) {
                      setSelectedVehicle(prev => ({
                        ...prev,
                        category: garageCategory,
                        brand: 'Altro',
                        model: 'Custom',
                        height: parseFloat(txt) || 0
                      } as any));
                    }
                  }}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.label, { marginTop: 10 }]}>LUNGHEZZA (m)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="es. 5.50"
                  placeholderTextColor={theme.textMuted}
                  value={customLength}
                  onChangeText={(txt) => {
                    setCustomLength(txt);
                    if (txt) {
                      setSelectedVehicle(prev => ({
                        ...prev,
                        category: garageCategory,
                        brand: 'Altro',
                        model: 'Custom',
                        length: parseFloat(txt) || 0
                      } as any));
                    }
                  }}
                  keyboardType="decimal-pad"
                />
                <Text style={[styles.label, { marginTop: 10 }]}>LARGHEZZA (m)</Text>
                <TextInput style={styles.input} placeholder="es. 2.00" placeholderTextColor={theme.textMuted} value={customWidth} onChangeText={setCustomWidth} keyboardType="decimal-pad" />
                <TouchableOpacity
                  style={[styles.searchBtn, { marginTop: 14 }]}
                  onPress={async () => {
                    if (customHeight && customLength) {
                      const v = { category: garageCategory, brand: 'Altro', model: 'Custom', height: parseFloat(customHeight), length: parseFloat(customLength), width: parseFloat(customWidth || '2.0') };
                      setSelectedVehicle(v);
                      setVehicleModalOpen(false);
                      try {
                        await updateVehicle(v as any);
                        if (refresh) await refresh();
                      } catch (e) {
                        console.error("Failed to save custom vehicle", e);
                      }
                    }
                  }}
                >
                  <Text style={styles.searchBtnText}>SALVA VEICOLO CUSTOM</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity style={styles.modalCancel} onPress={() => setVehicleModalOpen(false)}>
              <Text style={styles.modalCancelText}>CHIUDI</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  mapContainer: { flex: 1 },
  routeLine: {
    position: "absolute",
    top: "30%",
    left: "20%",
    width: "60%",
    height: 4,
    backgroundColor: theme.routeActive,
    borderRadius: 2,
    transform: [{ rotate: "18deg" }],
    boxShadow: `0px 0px 8px ${theme.routeActive}`,
  },
  pin: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#000",
  },
  overlay: { flex: 1, justifyContent: "space-between" },
  topHud: {
    flexDirection: "row",
    padding: 16,
    gap: 10,
    alignItems: "center",
  },
  hudPill: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  hudPillText: {
    color: theme.textPrimary,
    fontSize: 13,
    letterSpacing: 1.5,
    fontWeight: "700",
    flex: 1,
  },
  hudTrust: {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderWidth: 1,
    borderColor: theme.secondary + "66",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  hudTrustText: { color: theme.secondary, fontWeight: "900", fontSize: 13 },
  sideHud: {
    position: "absolute",
    left: 16,
    top: 120,
  },
  hudCard: {
    backgroundColor: "rgba(0,0,0,0.7)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: "center",
    minWidth: 76,
  },
  hudLabel: {
    color: theme.textMuted,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "900",
  },
  hudValue: {
    color: theme.textPrimary,
    fontSize: 26,
    fontWeight: "900",
    marginTop: 2,
  },
  hudUnit: {
    color: theme.textMuted,
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
  },
  bottomSheet: {
    margin: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: "rgba(18,18,18,0.95)",
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: theme.border,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 12,
  },
  sheetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sheetEta: {
    color: theme.primary,
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -1,
  },
  sheetDist: {
    color: theme.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  startBtn: {
    backgroundColor: theme.primary,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 30,
    gap: 10,
    ...theme.glows.primary,
  },
  startBtnText: { color: "#000", fontWeight: "900", letterSpacing: 1.5 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(26,11,61,0.85)",
    margin: 20,
    marginTop: 60,
    paddingHorizontal: 15,
    height: 55,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    ...theme.glows.primary,
  },
  warnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    padding: 10,
    backgroundColor: theme.warning + "15",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.warning + "44",
  },
  warnText: { color: theme.warning, fontSize: 12, flex: 1, fontWeight: "600" },
  fab: {
    position: "absolute",
    right: 16,
    bottom: 140,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: theme.danger,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0px 0px 12px rgba(255, 68, 68, 0.5)`,
    elevation: 8,
  },
  modalBg: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 200,
  },
  sheetCard: {
    backgroundColor: theme.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    borderWidth: 1,
    borderColor: theme.border,
    minHeight: 200,
  },
  modalTitle: {
    color: theme.textPrimary,
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  modalSub: {
    color: theme.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  reportGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 20,
  },
  reportCard: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
    backgroundColor: theme.surface2,
  },
  reportIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  reportLabel: {
    color: theme.textPrimary,
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: 1.5,
  },
  modalCancel: {
    marginTop: 16,
    alignItems: "center",
    paddingVertical: 14,
  },
  modalCancelText: {
    color: theme.textMuted,
    letterSpacing: 2,
    fontWeight: "700",
    fontSize: 12,
  },
  label: {
    color: theme.textMuted,
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "800",
    marginBottom: 6,
  },
  input: {
    backgroundColor: theme.surface2,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 14,
  },
  searchBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 18,
  },
  searchBtnText: { color: "#000", fontWeight: "900", letterSpacing: 2 },
  suggSummary: { color: theme.textPrimary, fontWeight: "900", fontSize: 14 },
  suggMeta: { color: theme.primary, fontWeight: "700", fontSize: 12, marginTop: 2 },
  suggRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  suggText: { color: theme.textSecondary, fontSize: 12, flex: 1 },
  driverDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.accent,
    borderWidth: 1,
    borderColor: "#fff",
    boxShadow: `0px 0px 4px ${theme.accent}`,
  },
  ztlBadge: {
    backgroundColor: theme.textMuted,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: "#000",
  },
  ztlText: {
    color: "#000",
    fontSize: 10,
    fontWeight: "900",
  },
  transportRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  tModeBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: theme.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  tModeBtnActive: {
    backgroundColor: theme.primary + "15",
    borderColor: theme.primary,
  },
  tModeLabel: {
    color: theme.textMuted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1,
    marginTop: 4,
  },
  optionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  optBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    backgroundColor: theme.surface2,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
  },
  optBtnActive: {
    borderColor: theme.danger,
    backgroundColor: theme.danger + "15",
  },
  optLabel: {
    color: theme.textSecondary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  recenterBtn: {
    position: "absolute",
    right: 16,
    bottom: 220,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.85)",
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0px 0px 5px rgba(0,0,0,0.3)`,
    elevation: 5,
  },
  resultsContainer: {
    backgroundColor: theme.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    marginTop: 4,
    maxHeight: 200,
    overflow: "hidden",
    zIndex: 100,
  },
  resultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  resultText: {
    color: theme.textPrimary,
    fontSize: 13,
    flex: 1,
  },
  favRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  favPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: theme.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    minWidth: 80,
    alignItems: "center",
  },
  pillActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primaryLight,
  },
  favPillActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  favLabel: {
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    justifyContent: "center",
    alignItems: "center",
    gap: 20,
  },
  loadingText: {
    color: theme.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 2,
  },
  vehicleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.surface2,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
  },
  vehicleBtnText: {
    flex: 1,
    color: theme.textMuted,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1,
  },
  vehicleDims: {
    color: theme.textSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  brandLabel: {
    color: theme.secondary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 2,
    marginTop: 16,
    marginBottom: 6,
  },
  vehicleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: theme.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 6,
  },
  vehicleRowActive: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + "15",
  },
  vehicleRowName: {
    color: theme.textPrimary,
    fontWeight: "800",
    fontSize: 13,
  },
  vehicleRowDims: {
    color: theme.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  customVehicleBox: {
    backgroundColor: theme.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 8,
  },
  garageTabs: {
    flexDirection: "row",
    gap: 8,
    marginTop: 16,
  },
  garageTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: theme.surface2,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  garageTabActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
  },
  garageTabText: {
    color: theme.textMuted,
    fontSize: 9,
    fontWeight: "900" as const,
    letterSpacing: 0.5,
  },
  civicoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginVertical: 8,
  },
  civicoInput: {
    flex: 2,
  },
  exponentInput: {
    flex: 1,
    textAlign: "center",
    fontWeight: "bold",
  },
  slash: {
    color: "#aaa",
    fontSize: 18,
    fontWeight: "bold",
  },
  civicoPreview: {
    flex: 2,
    color: "#2e7df7",
    fontSize: 13,
    fontWeight: "600",
  },
  summarySheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    paddingBottom: 40,
    zIndex: 1000,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  summaryTitle: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    maxWidth: '70%',
  },
  summaryMeta: {
    color: theme.primary,
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
  },
  goBtn: {
    backgroundColor: theme.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 20,
  },
  goBtnText: {
    color: '#000',
    fontSize: 18,
    fontWeight: '900',
  },
  closeSummary: {
    alignItems: 'center',
  },
  closeSummaryText: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
