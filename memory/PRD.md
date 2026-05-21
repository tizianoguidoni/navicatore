# VYRO — Product Requirements Document

## Overview
VYRO is a next-generation mobile navigation app that combines real-time traffic navigation, vehicle-aware routing, AI-driven personalization, community reports, and gamification — delivered in a dark, game-inspired, tactical HUD aesthetic.

## Tech Stack (Core MVP)
- Frontend: Expo (React Native) SDK 54, expo-router, TypeScript
- Backend: FastAPI + Motor (async MongoDB), JWT auth, bcrypt
- AI Layer: Claude Sonnet 4.5 via EMERGENT_LLM_KEY (emergentintegrations)
- Map: Dark image-based visual mock with HUD overlay (OSM/real map deferred to post-MVP)

## Core MVP Features (delivered)
1. **Auth (JWT)**: email/password signup & login; token stored in AsyncStorage; bcrypt hashing; `/api/auth/me`.
2. **Onboarding**: 3-slide tactical onboarding with skip/next.
3. **Map Screen (tab)**: Mock dark map with HUD (speed, level), floating destination search, route line, nearby report pins, bottom ETA/route sheet, FAB for reports.
4. **Community Reports**:
   - POST /api/reports (accident / police / hazard / closure)
   - GET /api/reports (live feed)
   - POST /api/reports/vote (confirm/deny) → adjusts reporter trust, awards voter XP
   - AI validation via Claude → `ai_score`, `ai_reason`
5. **Vehicle Profile (Garage tab)**: type (car/van/camper/truck), height/width/length/weight, driving mode (fast/safe/eco/scenic). PUT /api/vehicle.
6. **AI Route Suggestion**: POST /api/route/suggest — Claude returns ETA, distance, tips, warnings (bridge/weight warnings for camper/truck).
7. **Gamification**: XP (10 per report, 2 per vote), auto level (100 XP/level), trust score, badges grid, leaderboard (GET /api/leaderboard).
8. **Premium Paywall (UI-only)**: Yearly/Monthly plans, 7-day trial CTA (payments deferred).

## Smart Business Enhancement
Every confirmed community report increases reporter trust (+1) and voter XP (+2) → gamifies real-world data contribution, driving organic growth loop and higher data quality for route AI.

## Deferred / Next Iterations
- Live GPS tracking + real OSM/Mapbox map rendering
- Voice navigation TTS
- B2B fleet dashboard
- Custom 3D avatars
- Stripe payments for premium
- Real-time websocket sync for reports

## API Surface (MVP)
```
GET  /api/                     health
POST /api/auth/signup          -> {token, user}
POST /api/auth/login           -> {token, user}
GET  /api/auth/me              -> user
PUT  /api/vehicle              -> {ok, vehicle}
POST /api/reports              -> {ok, report, xp_gained}
GET  /api/reports              -> {reports: [...]}
POST /api/reports/vote         -> {ok}
GET  /api/leaderboard          -> {leaderboard: [...]}
POST /api/route/suggest        -> {ok, suggestion}
```
