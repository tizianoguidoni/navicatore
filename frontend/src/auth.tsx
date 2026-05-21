import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchMe, login as apiLogin, signup as apiSignup, VyroUser } from "./api";

type AuthCtx = {
  user: VyroUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<VyroUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me);
      await AsyncStorage.setItem("vyro_cached_user", JSON.stringify(me));
    } catch (err) {
      // Se è un errore di rete (es. connessione assente o instabile), non effettuiamo il logout.
      // Verifichiamo se il token è ancora in memoria.
      const token = await AsyncStorage.getItem("vyro_token");
      if (!token) {
        setUser(null);
      } else {
        // Carica i dati utente memorizzati offline se il profilo non è già impostato in memoria
        const cached = await AsyncStorage.getItem("vyro_cached_user");
        if (cached) {
          try {
            setUser(JSON.parse(cached));
          } catch (_) {}
        }
      }
    }
  }, []);

  useEffect(() => {
    (async () => {
      const token = await AsyncStorage.getItem("vyro_token");
      if (token) {
        // Prima prova a caricare la cache locale per mostrare subito l'interfaccia utente (ottimizzazione tempo di boot)
        const cached = await AsyncStorage.getItem("vyro_cached_user");
        if (cached) {
          try { setUser(JSON.parse(cached)); } catch (_) {}
        }
        await refresh();
      }
      setLoading(false);
    })();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const { token, user } = await apiLogin(email, password);
    await AsyncStorage.setItem("vyro_token", token);
    setUser(user);
  };
  const signup = async (email: string, password: string, username: string) => {
    const { token, user } = await apiSignup(email, password, username);
    await AsyncStorage.setItem("vyro_token", token);
    setUser(user);
  };
  const logout = async () => {
    await AsyncStorage.removeItem("vyro_token");
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, signup, logout, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
