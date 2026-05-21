import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as Location from "expo-location";
import { theme } from "../src/theme";
import MapLibreView from "../src/components/MapLibreView";
import { suggestRoute, LAST_ROUTE_DATA } from "../src/api";
import { useAuth } from "../src/auth";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function haversine([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getBearing(p1: [number, number], p2: [number, number]) {
  const y = Math.sin((p2[0] - p1[0]) * (Math.PI / 180)) * Math.cos(p2[1] * (Math.PI / 180));
  const x = Math.cos(p1[1] * (Math.PI / 180)) * Math.sin(p2[1] * (Math.PI / 180)) -
    Math.sin(p1[1] * (Math.PI / 180)) * Math.cos(p2[1] * (Math.PI / 180)) * Math.cos((p2[0] - p1[0]) * (Math.PI / 180));
  return (Math.atan2(y, x) * (180 / Math.PI) + 360) % 360;
}

const VOICE_DISTANCE = 120;
const ARRIVED_DISTANCE = 30;

let speechModule: any = null;
if (Platform.OS !== 'web') {
  speechModule = require('expo-speech');
}

function speak(text: string) {
  if (!text) return;
  if (Platform.OS === 'web') {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'it-IT';
    utt.rate = 0.95;
    window.speechSynthesis.speak(utt);
  } else {
    speechModule?.stop();
    speechModule?.speak(text, { language: 'it-IT', rate: 0.95 });
  }
}

function stopSpeech() {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel();
  } else {
    speechModule?.stop();
  }
}

const getManeuverIcon = (type: string, modifier: string): string => {
  if (type === "arrive") return "flag";
  if (type === "depart") return "navigate";
  switch (modifier) {
    case "right": case "sharp right": return "arrow-forward";
    case "left": case "sharp left": return "arrow-back";
    case "uturn": return "refresh";
    default: return "arrow-up";
  }
};

// ─── Math for Rerouting ──────────────────────────────────────────────────────
function distanceToSegment(p: [number, number], v: [number, number], w: [number, number]) {
  if (!p || !v || !w) return 0;
  const l2 = (v[0] - w[0]) ** 2 + (v[1] - w[1]) ** 2;
  if (l2 === 0) return haversine(p, v);
  let t = ((p[0] - v[0]) * (w[0] - v[0]) + (p[1] - v[1]) * (w[1] - v[1])) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj: [number, number] = [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
  return haversine(p, proj);
}

function findClosestPointIndex(p: [number, number], poly: [number, number][]) {
  if (!poly || poly.length < 2) return 0;
  let minDist = Infinity;
  let index = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const d = distanceToSegment(p, poly[i], poly[i + 1]);
    if (d < minDist) { minDist = d; index = i; }
  }
  return index;
}

function getMinDistanceToPath(p: [number, number], poly: [number, number][]): number {
  if (!poly || poly.length < 2) return 0;
  let minDist = Infinity;
  for (let i = 0; i < poly.length - 1; i++) {
    const d = distanceToSegment(p, poly[i], poly[i + 1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
}

function advancePositionAlongPolyline(currentPos: [number, number], distance: number, poly: [number, number][]): [number, number] | null {
  if (!poly || poly.length < 2) return null;
  const closestIdx = findClosestPointIndex(currentPos, poly);
  let remainingDist = distance;
  let p = currentPos;
  for (let i = closestIdx; i < poly.length - 1; i++) {
    const nextPt = poly[i + 1];
    const distToNext = haversine(p, nextPt);
    if (distToNext >= remainingDist) {
      const ratio = remainingDist / distToNext;
      const nextLng = p[0] + ratio * (nextPt[0] - p[0]);
      const nextLat = p[1] + ratio * (nextPt[1] - p[1]);
      return [nextLng, nextLat];
    } else {
      remainingDist -= distToNext;
      p = nextPt;
    }
  }
  return poly[poly.length - 1];
}

// ─── Component ───────────────────────────────────────────────────────────────

const GlassContainer = ({ children, style }: any) => {
  if (Platform.OS === 'ios') {
    return (
      <BlurView intensity={80} tint="dark" style={[styles.glass, style]}>
        {children}
      </BlurView>
    );
  }
  return <View style={[styles.glass, styles.glassAndroid, style]}>{children}</View>;
};

export default function Navigation() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const mapRef = useRef<any>(null);
  const { width } = useWindowDimensions();
  const { user } = useAuth();
  const lastGpsUpdateRef = useRef<number>(Date.now());

  const [mounted, setMounted] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [isGpsLost, setIsGpsLost] = useState(false);
  const [speedLimit] = useState(50);
  const [bearing, setBearing] = useState(0);
  const [step, setStep] = useState(0);
  const [voice, setVoice] = useState(true);
  const [eta, setEta] = useState(Number(params.eta) || 0);
  const [distLeft, setDistLeft] = useState(Number(params.dist) || 0);
  const [currentLoc, setCurrentLoc] = useState<[number, number] | null>(() => {
    const lng = Number(params.startLng);
    const lat = Number(params.startLat);
    return !isNaN(lng) && !isNaN(lat) && lng !== 0 && lat !== 0 ? [lng, lat] : null;
  });
  const [arrived, setArrived] = useState(false);
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [isRerouting, setIsRerouting] = useState(false);
  const [showRouteOptions, setShowRouteOptions] = useState(false);

  // Polyline e progress tracking
  const [originalPolyline, setOriginalPolyline] = useState<[number, number][]>(() => {
    if (LAST_ROUTE_DATA?.suggestion?.polyline) return LAST_ROUTE_DATA.suggestion.polyline;
    try {
      return params.polyline ? JSON.parse(params.polyline as string) : [];
    } catch { return []; }
  });
  const [displayPolyline, setDisplayPolyline] = useState<[number, number][]>(originalPolyline);
  const [maneuvers, setManeuvers] = useState<any[]>(() => {
    if (LAST_ROUTE_DATA?.suggestion?.steps) return LAST_ROUTE_DATA.suggestion.steps;
    try {
      return params.steps ? JSON.parse(params.steps as string) : [];
    } catch { return []; }
  });
  const destLabel = (() => {
    const name = (params.destName as string) || "";
    // Cerca il civico in vari formati (es. "Via Roma, 10" o "Via Roma 10" o "Via Roma 10/A")
    const civicoMatch = name.match(/,\s*(\d+[A-Za-z0-9\/\-]*)/) || name.match(/\s(\d+[A-Za-z0-9\/\-]*)$/);
    if (civicoMatch) return `N° ${civicoMatch[1].toUpperCase()}`;
    return "";
  })();
  const [destCoord] = useState<[number, number] | null>(
    (params.destLng && params.destLat && !isNaN(Number(params.destLng)))
      ? [Number(params.destLng), Number(params.destLat)]
      : (originalPolyline.length > 0 ? originalPolyline[originalPolyline.length - 1] : null)
  );

  const lastLocRef = useRef<[number, number] | null>(currentLoc);
  const lastBearingRef = useRef<number>(0);
  const stepRef = useRef(0);
  const voiceSpoken = useRef<Set<number>>(new Set());
  const polylineRef = useRef(originalPolyline);
  const isReroutingRef = useRef(false);
  const speedRef = useRef(0);

  useEffect(() => { stepRef.current = step; }, [step]);
  useEffect(() => { polylineRef.current = originalPolyline; }, [originalPolyline]);
  useEffect(() => { isReroutingRef.current = isRerouting; }, [isRerouting]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { setMounted(true); }, []);

  const m = maneuvers[step] || { instr: "Procedi dritto", street: "", dist: "—", type: "straight", modifier: "straight" };

  // ── GPS Tracking & Logic ─────────────────────────────────────────────
  useEffect(() => {
    if (!mounted) return;
    let cleanup: (() => void) | null = null;

    const handlePosition = (pos: [number, number], spd: number, gpsHeading: number | null, isSimulated = false) => {
      if (!pos || typeof pos[0] !== 'number') return;
      if (!isSimulated) {
        lastGpsUpdateRef.current = Date.now();
        setIsGpsLost(false);
      }
      // 1. Bearing Calculation
      let targetBearing = lastBearingRef.current;
      if (lastLocRef.current && haversine(lastLocRef.current, pos) > 1.0) {
        targetBearing = getBearing(lastLocRef.current, pos);
      } else if (gpsHeading !== null && gpsHeading >= 0 && spd > 2) {
        targetBearing = gpsHeading;
      }

      lastBearingRef.current = targetBearing;
      setBearing(targetBearing);
      lastLocRef.current = pos;
      setCurrentLoc(pos);
      setSpeed(Math.max(0, Math.round(spd)));

      // 2. Path Trimming
      const curPoly = polylineRef.current;
      if (curPoly.length > 2) {
        const closestIdx = findClosestPointIndex(pos, curPoly);
        if (closestIdx > 0) {
          const newPoly = curPoly.slice(closestIdx);
          setDisplayPolyline([pos, ...newPoly]);
        }
      }

      // 3. Maneuver Logic
      const curStep = stepRef.current;
      if (maneuvers.length > 0 && curStep < maneuvers.length) {
        const cur = maneuvers[curStep];
        if (cur?.coords) {
          const dist = haversine(pos, cur.coords as [number, number]);
          if (dist < VOICE_DISTANCE && !voiceSpoken.current.has(curStep)) {
            voiceSpoken.current.add(curStep);
            if (voice) speak(cur.instr);
          }
          if (dist < 25 && curStep < maneuvers.length - 1) {
            setStep(s => s + 1);
          }
        }
      }

      // 4. Rerouting Check
      if (curPoly.length > 1 && !isReroutingRef.current && destCoord) {
        const distFromPath = getMinDistanceToPath(pos, curPoly);
        if (distFromPath > 60) {
          setIsRerouting(true);
          speak("Ricalcolo percorso");
          suggestRoute("Posizione", params.destName as string, pos, destCoord, (params.mode as any) || "car", user?.vehicle)
            .then(res => {
              if (res.suggestion.polyline) {
                setOriginalPolyline(res.suggestion.polyline);
                setDisplayPolyline(res.suggestion.polyline);
              }
              if (res.suggestion.steps) setManeuvers(res.suggestion.steps);
              setStep(0);
              voiceSpoken.current.clear();
            })
            .catch(() => { })
            .finally(() => setIsRerouting(false));
        }
      }

      // 5. Arrival & ETA
      if (destCoord) {
        const d = haversine(pos, destCoord);
        setDistLeft(parseFloat((d / 1000).toFixed(1)));
        const initialDist = Number(params.dist) || 1;
        const initialEta = Number(params.eta) || 1;
        const progressFactor = (d / 1000) / initialDist;
        setEta(Math.max(1, Math.round(initialEta * progressFactor)));
        if (d < ARRIVED_DISTANCE && !arrived) {
          setArrived(true);
          speak("Hai raggiunto la tua meta.");
        }
      }
    };

    let isSubscribed = true;
    let subscription: Location.LocationSubscription | null = null;

    const startWatching = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isSubscribed) return;
        if (status !== 'granted') return;
        
        subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 500, distanceInterval: 1 },
          (loc) => {
            if (isSubscribed) {
              handlePosition([loc.coords.longitude, loc.coords.latitude], (loc.coords.speed || 0) * 3.6, loc.coords.heading);
            }
          }
        );
      } catch (err) {
        console.warn("GPS tracking setup failed:", err);
      }
    };

    startWatching();

    const deadReckoningInterval = setInterval(() => {
      const now = Date.now();
      const timeSinceLastUpdate = now - lastGpsUpdateRef.current;
      
      // Se non riceviamo segnale GPS da più di 2.5 secondi e il veicolo era in marcia (> 5 km/h)
      if (timeSinceLastUpdate > 2500 && lastLocRef.current && speedRef.current > 5 && polylineRef.current.length > 1) {
        setIsGpsLost(true);
        // Calcola distanza stimata in 1 secondo: (speed / 3.6) * 1s
        const distMeters = (speedRef.current / 3.6) * 1.0;
        
        const nextPos = advancePositionAlongPolyline(lastLocRef.current, distMeters, polylineRef.current);
        if (nextPos) {
          handlePosition(nextPos, speedRef.current, lastBearingRef.current, true);
          // Aggiorna il finto timestamp per il passo successivo
          lastGpsUpdateRef.current = now;
        }
      }
    }, 1000);

    return () => {
      isSubscribed = false;
      clearInterval(deadReckoningInterval);
      if (subscription) {
        try {
          subscription.remove();
        } catch (_) {}
      }
      stopSpeech();
    };
  }, [mounted]);

  if (!mounted) return <View style={{ flex: 1, backgroundColor: "#000" }} />;

  if (arrived) {
    return (
      <View style={styles.arrivedScreen}>
        <Ionicons name="checkmark-circle" size={100} color={theme.success} />
        <Text style={styles.arrivedTitle}>ARRIVATO</Text>
        <TouchableOpacity style={styles.arrivedBtn} onPress={() => router.back()}>
          <Text style={styles.arrivedBtnText}>FINE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapLibreView
        ref={mapRef}
        center={currentLoc || undefined}
        zoom={18}
        pitch={65}
        route={displayPolyline}
        destCoord={destCoord || undefined}
        destLabel={destLabel}
        bearing={bearing}
      />

      <SafeAreaView style={[styles.uiLayer, { pointerEvents: "box-none" }]}>
        {/* TOP MANEUVER CARD */}
        <View style={styles.topContainer}>
          <GlassContainer style={styles.maneuverCard}>
            <View style={styles.maneuverIconBox}>
              <Ionicons name={getManeuverIcon(m.type, m.modifier) as any} size={42} color="#FFF" />
            </View>
            <View style={styles.maneuverText}>
              <Text style={styles.maneuverDist}>{m.dist}</Text>
              <Text style={styles.maneuverStreet} numberOfLines={1}>{m.street || m.instr}</Text>
            </View>
            <TouchableOpacity onPress={() => setVoice(!voice)} style={styles.voiceBtn}>
              <Ionicons name={voice ? "volume-high" : "volume-mute"} size={22} color="#FFF" />
            </TouchableOpacity>
          </GlassContainer>
          {params.isFallback === "1" && (
            <View style={styles.fallbackBadge}>
              <Ionicons name="cloud-offline" size={12} color="#FF9500" />
              <Text style={styles.fallbackText}>TRAFFICO NON DISPONIBILE (OFFLINE)</Text>
            </View>
          )}
          {isGpsLost && (
            <View style={[styles.fallbackBadge, { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: 'rgba(239, 68, 68, 0.4)' }]}>
              <Ionicons name="warning" size={12} color="#EF4444" style={{ marginRight: 2 }} />
              <Text style={[styles.fallbackText, { color: '#EF4444' }]}>STIMATORE IN GALLERIA ATTIVO (NO GPS)</Text>
            </View>
          )}
        </View>
        {/* SPEEDOMETER */}
        <View style={[styles.speedContainer, { pointerEvents: "none" }]}>
          <GlassContainer style={styles.speedGauge}>
            <Text style={styles.speedValue}>{speed}</Text>
            <Text style={styles.speedUnit}>KM/H</Text>
          </GlassContainer>
          <View style={styles.speedLimitBadge}>
            <Text style={styles.speedLimitText}>{speedLimit}</Text>
          </View>
        </View>
        {/* BOTTOM HUD */}
        <View style={styles.bottomContainer}>
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.circularBtn} onPress={() => setReportModalVisible(true)}>
              <Ionicons name="warning" size={24} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.circularBtn} onPress={() => setShowRouteOptions(true)}>
              <Ionicons name="options" size={24} color="#6C2BFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.circularBtn, { backgroundColor: '#FFF' }]}
              onPress={() => mapRef.current?.recenter()}
            >
              <Ionicons name="navigate" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>

          <GlassContainer style={styles.hudPill}>
            <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>

            <View style={styles.hudInfo}>
              <Text style={styles.etaText}>{eta} min</Text>
              <Text style={styles.metaText}>{distLeft} km · {new Date(Date.now() + eta * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>

            <View style={styles.infoAccent} />
          </GlassContainer>
        </View>
      </SafeAreaView>

      {/* MODALS (Simplified for Brevity) */}
      {reportModalVisible && (
        <View style={styles.modalOverlay}>
          <GlassContainer style={styles.modalBox}>
            <Text style={styles.modalTitle}>SEGNALA</Text>
            <View style={styles.reportGrid}>
              {['accident', 'police', 'hazard'].map(type => (
                <TouchableOpacity key={type} style={styles.reportItem} onPress={() => setReportModalVisible(false)}>
                  <Ionicons name={type === 'accident' ? 'car' : type === 'police' ? 'shield' : 'warning'} size={32} color="#FFF" />
                  <Text style={styles.reportLabel}>{type.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={() => setReportModalVisible(false)}><Text style={{ color: '#FFF', textAlign: 'center' }}>CHIUDI</Text></TouchableOpacity>
          </GlassContainer>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  uiLayer: { ...StyleSheet.absoluteFillObject, padding: 16, justifyContent: 'space-between' },

  glass: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  glassAndroid: {
    backgroundColor: 'rgba(30, 30, 40, 0.95)',
  },

  topContainer: { marginTop: 8 },
  maneuverCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 16,
    boxShadow: '0 10 30 rgba(0,0,0,0.5)',
  },
  maneuverIconBox: { width: 50, alignItems: 'center' },
  maneuverText: { flex: 1 },
  maneuverDist: { color: '#FFF', fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  maneuverStreet: { color: '#FFF', fontSize: 16, fontWeight: '600', opacity: 0.8 },
  voiceBtn: { padding: 8 },

  fallbackBadge: {
    backgroundColor: 'rgba(255, 149, 0, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  fallbackText: {
    color: '#FF9500',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },

  speedContainer: { position: 'absolute', left: 16, bottom: 120, alignItems: 'center' },
  speedGauge: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 4, borderColor: '#6C2BFF',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  speedValue: { color: '#FFF', fontSize: 28, fontWeight: '900' },
  speedUnit: { color: '#6C2BFF', fontSize: 9, fontWeight: '800' },
  speedLimitBadge: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFF', borderWidth: 3, borderColor: '#EF4444',
    justifyContent: 'center', alignItems: 'center',
    marginTop: -10,
  },
  speedLimitText: { color: '#000', fontWeight: '900', fontSize: 14 },

  bottomContainer: { gap: 12 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  circularBtn: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(30, 30, 40, 0.9)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  hudPill: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingHorizontal: 20,
    gap: 20,
    backgroundColor: 'rgba(20, 20, 25, 0.8)',
  },
  closeBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#EF4444',
    justifyContent: 'center', alignItems: 'center',
  },
  hudInfo: { flex: 1, alignItems: 'center' },
  etaText: { color: '#FF9500', fontSize: 26, fontWeight: '900' },
  metaText: { color: '#AAA', fontSize: 13, fontWeight: '600' },
  infoAccent: { width: 4, height: 40, backgroundColor: '#6C2BFF', borderRadius: 2 },

  arrivedScreen: { flex: 1, backgroundColor: "#000", justifyContent: 'center', alignItems: 'center' },
  arrivedTitle: { color: '#FFF', fontSize: 32, fontWeight: '900', marginTop: 20 },
  arrivedBtn: { marginTop: 40, backgroundColor: '#6C2BFF', paddingHorizontal: 60, paddingVertical: 20, borderRadius: 40 },
  arrivedBtnText: { color: '#FFF', fontWeight: '900', fontSize: 18 },

  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalBox: { width: '85%', padding: 24, gap: 24 },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', textAlign: 'center' },
  reportGrid: { flexDirection: 'row', justifyContent: 'space-around' },
  reportItem: { alignItems: 'center', gap: 8 },
  reportLabel: { color: '#FFF', fontSize: 10, fontWeight: '700' },
});

