export const theme = {
  bg: "#0B0B14", // Midnight Black
  surface: "#1A0B3D", // Dark Purple (Secondary)
  surface2: "#2D1B5A", // Lighter variant for cards
  border: "#6C2BFF33", // Faint purple glow
  borderLight: "#6C2BFF66",
  textPrimary: "#FFFFFF",
  textSecondary: "#A0A0B8",
  textMuted: "#62627A",
  
  // Brand
  primary: "#6C2BFF", // Vyro Purple
  primaryLight: "#9F5BFF",
  secondary: "#1A0B3D", 
  accent: "#FF7A00", // Vyro Orange
  
  // Status
  danger: "#FF4444",
  warning: "#FF7A00",
  success: "#00F3FF", // Cyan for success feels futuristic
  info: "#6C2BFF",
  
  // Route
  routeActive: "#FF7A00", // Orange as requested
  routeHeavy: "#FF4444",
  routeModerate: "#9F5BFF",
  
  // Gradients
  gradients: {
    hero: ["#6C2BFF", "#9F5BFF", "#FF7A00"] as string[],
    background: ["#0B0B14", "#1A0B3D"] as string[],
    button: ["#6C2BFF", "#9F5BFF"] as string[],
    hud: ["rgba(26,11,61,0.95)", "rgba(11,11,20,0.85)"] as string[],
  },
  
  // Glows
  glows: {
    primary: {
      boxShadow: "0px 0px 15px rgba(108, 43, 255, 0.8)",
    },
    accent: {
      boxShadow: "0px 0px 15px rgba(255, 122, 0, 0.8)",
    },
    secondary: {
      boxShadow: "0px 0px 15px rgba(26, 11, 61, 0.8)",
    },
    danger: {
      boxShadow: "0px 0px 15px rgba(255, 68, 68, 0.8)",
    },
  },
  
  glass: {
    backgroundColor: "rgba(26,11,61,0.7)",
    borderColor: "rgba(108,43,255,0.3)",
    borderWidth: 1,
  }
};

export const reportColors: Record<string, string> = {
  accident: "#FF4444",
  police: "#6C2BFF",
  hazard: "#FF7A00",
  closure: "#A0A0B8",
};

export const reportLabels: Record<string, string> = {
  accident: "ACCIDENT",
  police: "POLICE",
  hazard: "HAZARD",
  closure: "CLOSURE",
};

export const reportIcons: Record<string, string> = {
  accident: "alert-circle",
  police: "shield",
  hazard: "warning",
  closure: "construct",
};
