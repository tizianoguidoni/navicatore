import { useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Language = "it" | "en" | "es" | "fr";

const translations = {
  it: {
    welcome: "BENVENUTO",
    signup: "CREA ACCOUNT",
    signin: "ACCEDI",
    email: "EMAIL",
    password: "PASSWORD",
    callsign: "NOME UTENTE",
    start: "INIZIA MOTORE",
    next: "AVANTI",
    skip: "SALTA",
    whereTo: "DOVE ANDIAMO?",
    speed: "VELOCITÀ",
    level: "LIVELLO",
    trust: "FIDUCIA",
    reports: "SEGNALAZIONI",
    settings: "IMPOSTAZIONI",
  },
  en: {
    welcome: "WELCOME",
    signup: "CREATE ACCOUNT",
    signin: "SIGN IN",
    email: "EMAIL",
    password: "PASSWORD",
    callsign: "CALLSIGN",
    start: "START ENGINE",
    next: "NEXT",
    skip: "SKIP",
    whereTo: "WHERE TO?",
    speed: "SPEED",
    level: "LEVEL",
    trust: "TRUST",
    reports: "REPORTS",
    settings: "SETTINGS",
  },
  es: {
    welcome: "BIENVENIDO",
    signup: "CREAR CUENTA",
    signin: "INICIAR SESIÓN",
    email: "CORREO",
    password: "CONTRASEÑA",
    callsign: "APODO",
    start: "ARRANCAR",
    next: "SIGUIENTE",
    skip: "SALTAR",
    whereTo: "¿A DÓNDE?",
    speed: "VELOCIDAD",
    level: "NIVEL",
    trust: "CONFIANZA",
    reports: "REPORTES",
    settings: "AJUSTES",
  },
  fr: {
    welcome: "BIENVENUE",
    signup: "CRÉER UN COMPTE",
    signin: "CONNEXION",
    email: "E-MAIL",
    password: "MOT DE PASSE",
    callsign: "PSEUDO",
    start: "DÉMARRER",
    next: "SUIVANT",
    skip: "PASSER",
    whereTo: "OÙ ALLER ?",
    speed: "VITESSE",
    level: "NIVEAU",
    trust: "CONFIANCE",
    reports: "RAPPORTS",
    settings: "RÉGLAGES",
  },
};

export function useTranslation() {
  const [lang, setLang] = useState<Language>("it");

  useEffect(() => {
    (async () => {
      const saved = await AsyncStorage.getItem("vyro_lang");
      if (saved) setLang(saved as Language);
    })();
  }, []);

  const t = (key: keyof typeof translations.it) => {
    return translations[lang][key] || translations.en[key];
  };

  const changeLang = async (newLang: Language) => {
    setLang(newLang);
    await AsyncStorage.setItem("vyro_lang", newLang);
  };

  return { t, lang, changeLang };
}
