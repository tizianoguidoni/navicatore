import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL || "";
export const API = axios.create({ baseURL: `${BASE}/api`, timeout: 30000 });

// Interceptor: aggiunge il token JWT a ogni richiesta
API.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem("vyro_token");
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor: gestisce la scadenza del token (401) con logout automatico
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Token scaduto o non valido: rimuove le credenziali locali
      await AsyncStorage.removeItem("vyro_token");
    }
    return Promise.reject(error);
  }
);

export type ReportType = "accident" | "police" | "hazard" | "closure";

export type VehicleProfile = {
  type?: "car" | "van" | "camper" | "truck";
  category?: string;
  brand?: string;
  model?: string;
  height?: number;
  width?: number;
  length?: number;
  height_m?: number;
  width_m?: number;
  length_m?: number;
  weight_kg?: number;
  driving_mode?: "fast" | "safe" | "eco" | "scenic" | string;
};

export type VyroUser = {
  id: string;
  email: string;
  username: string;
  xp: number;
  level: number;
  trust_score: number;
  badges: string[];
  premium: boolean;
  is_admin?: boolean;
  avatar_color: string;
  vehicle: VehicleProfile;
  created_at: string;
};

export type ReportItem = {
  id: string;
  type: ReportType;
  lat: number;
  lng: number;
  note: string;
  username: string;
  reporter_trust: number;
  confirms: number;
  denies: number;
  ai_score: number;
  ai_reason: string;
  active: boolean;
  created_at: string;
};

export async function signup(email: string, password: string, username: string) {
  const r = await API.post("/auth/signup", { email, password, username });
  return r.data as { token: string; user: VyroUser };
}

export async function login(email: string, password: string) {
  const r = await API.post("/auth/login", { email, password });
  return r.data as { token: string; user: VyroUser };
}

export async function fetchMe() {
  const r = await API.get("/auth/me");
  return r.data as VyroUser;
}

export async function updateMe(data: Partial<VyroUser>) {
  const r = await API.patch("/auth/me", data);
  return r.data as VyroUser;
}

export async function updateVehicle(v: VehicleProfile) {
  const r = await API.put("/vehicle", v);
  return r.data as { ok: boolean; vehicle: VehicleProfile };
}

export async function createReport(type: ReportType, lat: number, lng: number, note: string) {
  const r = await API.post("/reports", { type, lat, lng, note });
  return r.data;
}

export async function listReports() {
  const r = await API.get("/reports");
  return r.data as { reports: ReportItem[] };
}

export async function voteReport(report_id: string, confirm: boolean) {
  const r = await API.post("/reports/vote", { report_id, confirm });
  return r.data;
}

export async function getLeaderboard() {
  const r = await API.get("/leaderboard");
  return r.data as { leaderboard: VyroUser[] };
}

export let LAST_ROUTE_DATA: any = null;

export async function suggestRoute(
  origin: string,
  destination: string,
  origin_coords?: [number, number],
  dest_coords?: [number, number],
  mode: "car" | "walking" | "bicycle" | "truck" | "bus" | "camper" | "van" = "car",
  vehicle?: VehicleProfile
) {
  try {
      const r = await API.post("/route/suggest", {
        origin,
        destination,
        origin_coords,
        dest_coords,
        mode,
        vehicle_height: vehicle?.height_m ?? vehicle?.height,
        vehicle_width: vehicle?.width_m ?? vehicle?.width,
        vehicle_weight: vehicle?.weight_kg ?? vehicle?.weight,
        vehicle_length: vehicle?.length_m ?? vehicle?.length
      });
      LAST_ROUTE_DATA = r.data;
      return r.data as any;
  } catch (e) {
    console.warn("Backend unreachable. Falling back to direct OSRM API.");
    if (!origin_coords || !dest_coords) throw new Error("Missing coordinates for fallback routing");

    // Fallback locale diretto tramite OSRM pubblico (senza CORS)
    const url = `https://router.project-osrm.org/route/v1/driving/${origin_coords[0]},${origin_coords[1]};${dest_coords[0]},${dest_coords[1]}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.code !== "Ok") throw new Error("OSRM Fallback failed");

    const route = data.routes[0];
    const result = {
      ok: true,
      suggestion: {
        summary: "Percorso Diretto (Fallback)",
        eta_minutes: Math.round(route.duration / 60),
        distance_km: parseFloat((route.distance / 1000).toFixed(1)),
        polyline: route.geometry.coordinates,
        steps: route.legs[0].steps.map((s: any) => ({
          instr: s.maneuver?.instruction || "Procedi dritto",
          street: s.name || "",
          dist: Math.round(s.distance) + "m",
          type: s.maneuver?.type || "straight",
          modifier: s.maneuver?.modifier || "straight"
        })),
        tips: ["Server offline: navigazione locale attiva"],
        warnings: []
      }
    };
    LAST_ROUTE_DATA = result;
    return result;
  }
}

export async function listChatHistory() {
  const r = await API.get("/chat/history");
  return r.data as { messages: any[] };
}

export async function getStats() {
  const r = await API.get("/stats");
  return r.data as {
    total_users: number;
    total_reports: number;
    active_reports: number;
    system_status: string;
  };
}

export interface FavoritePlace {
  label: string;
  address: string;
  coords: [number, number];
}

export async function getFavorites() {
  const r = await API.get("/favorites");
  return r.data as { favorites: FavoritePlace[] };
}

export async function saveFavorite(fav: FavoritePlace) {
  const r = await API.post("/favorites", fav);
  return r.data;
}

// ─── ADVANCED GEOCODING ENGINE ───────────────────────────────────────────────

export interface GeocodeResult {
  display_name: string;
  lat: number;
  lon: number;
  importance: number;
  source: "photon" | "nominatim" | "mapbox";
  type?: string;
}

/**
 * Motore di ricerca avanzato con Fallback
 * Cerca di individuare il civico esatto usando più layer di dati
 */
export async function advancedGeocode(query: string, userLoc?: [number, number]): Promise<GeocodeResult[]> {
  try {
    const hasNumber = /\d/.test(query);
    let results: GeocodeResult[] = [];

    // SE C'È UN NUMERO: Forziamo Nominatim con ricerca strutturata
    if (hasNumber) {
      // Pulizia della query per estrarre la parte numerica
      const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5&accept-language=it&dedupe=1&polygon_geojson=0`;
      const nRes = await fetch(nomUrl, { headers: { "User-Agent": "VyroTacticalNav/1.2" } });
      if (nRes.ok) {
        const nData = await nRes.json();
        results = nData.map((item: any) => ({
          display_name: item.display_name,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
          importance: (item.type === 'house' || item.type === 'building' || item.class === 'place') ? 1.0 : (parseFloat(item.importance) || 0.6),
          source: "nominatim",
          type: item.type
        }));
      }
    }

    // LAYER 2: PHOTON (Veloce, ottimo per autocomplete di vie e civici)
    let photonUrl = `https://photon.komoot.io/api?q=${encodeURIComponent(query)}&limit=10`;
    if (userLoc) photonUrl += `&lon=${userLoc[0]}&lat=${userLoc[1]}`;

    const pRes = await fetch(photonUrl);
    const pData = await pRes.json();

    const pResults: GeocodeResult[] = pData.features.map((f: any) => ({
      display_name: [f.properties.name, f.properties.housenumber, f.properties.street, f.properties.city, f.properties.postcode]
        .filter(Boolean).join(", "),
      lat: f.geometry.coordinates[1],
      lon: f.geometry.coordinates[0],
      importance: f.properties.housenumber ? 0.95 : (f.properties.importance || 0.5),
      source: "photon",
      type: f.properties.type
    }));

    results = [...results, ...pResults];

    // FILTRAGGIO E RANKING INTELLIGENTE
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    return results
      .filter((v, i, a) => a.findIndex(t => t.lat === v.lat && t.lon === v.lon) === i) // Deduplicazione
      .map(res => {
        let score = res.importance || 0.5;
        const nameLower = res.display_name.toLowerCase();

        // Boost per match con parole chiave della query (es. nome via)
        queryWords.forEach(word => {
          if (nameLower.includes(word)) score += 0.2;
        });

        // Boost enorme se contiene un numero civico quando richiesto
        if (hasNumber) {
          const resultHasNum = /\d/.test(nameLower);
          if (resultHasNum) score += 0.5;

          // Se il numero esatto cercato è nel risultato, ulteriore boost
          const searchNum = query.match(/\d+/);
          if (searchNum && nameLower.includes(searchNum[0])) score += 0.3;
        }

        return { ...res, score };
      })
      .sort((a, b) => (b as any).score - (a as any).score)
      .slice(0, 8);
  } catch (e) {
    console.error("Geocoding failed", e);
    return [];
  }
}

export async function deleteFavorite(label: string) {
  const r = await API.delete(`/favorites/${label}`);
  return r.data;
}

export const geocodeCivico = async (
  fullAddress: string,
  fallbackCoords: [number, number]
): Promise<{ coords: [number, number]; precise: boolean }> => {
  // Pulizia preliminare: se l'indirizzo contiene già un civico ed è stato aggiunto un secondo civico
  let query = fullAddress;
  const parts = fullAddress.split(',').map(p => p.trim());
  
  if (parts.length >= 3 && /^\d+/.test(parts[parts.length - 1])) {
    const civico = parts.pop();
    parts[0] = parts[0].replace(/\s\d+$/, "");
    query = `${parts[0]}, ${civico}, ${parts.slice(1).join(', ')}`;
  }

  console.log("Geocoding target:", query);

  // Tentativo 1: Nominatim (Specifico per civici)
  const result = await tryGeocode(query);
  if (result) return { coords: result, precise: true };

  // Tentativo 2: Advanced Geocode (Photon/Nominatim blend)
  const advanced = await advancedGeocode(query);
  if (advanced.length > 0 && advanced[0].score > 0.8) {
    return { coords: [advanced[0].lon, advanced[0].lat], precise: true };
  }

  // Tentativo 3: Senza esponente
  const withoutExponent = query.replace(/\/[A-Za-z0-9]+/, "").trim();
  if (withoutExponent !== query) {
    const result2 = await tryGeocode(withoutExponent);
    if (result2) return { coords: result2, precise: true };
  }

  // Tentativo 4: Solo via e città
  const streetOnly = query.replace(/(?:,\s*)?\b\d+(?:\/[A-Za-z0-9]+)?\b/g, "").trim();
  const result3 = await tryGeocode(streetOnly);
  if (result3) {
    console.warn("📍 Civico non trovato, uso posizione via:", streetOnly);
    return { coords: result3, precise: false };
  }

  return { coords: fallbackCoords, precise: false };
};

const tryGeocode = async (
  query: string
): Promise<[number, number] | null> => {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=1&countrycodes=it`;
    const res = await fetch(url, {
      headers: { "Accept-Language": "it", "User-Agent": "VyroApp/1.0" }
    });
    const data = await res.json();
    if (data.length > 0) return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
    return null;
  } catch {
    return null;
  }
};
