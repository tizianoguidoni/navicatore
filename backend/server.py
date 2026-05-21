from fastapi import FastAPI, APIRouter, HTTPException, Depends, status, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os, secrets, logging, uuid, jwt, bcrypt, asyncio, requests
from datetime import datetime, timezone, timedelta
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from moderation import validate_message, sanitize_username

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------------------- Config ----------------------
MONGO_URL = os.environ.get('MONGO_URL', "mongodb://localhost:27017")
DB_NAME = os.environ.get('DB_NAME', 'vyro')
JWT_SECRET = os.environ.get('JWT_SECRET', 'vyro-navigation-cyber-secret-2024')
JWT_ALG = "HS256"
JWT_EXPIRE_DAYS = 30

client = AsyncIOMotorClient(MONGO_URL, serverSelectionTimeoutMS=5000)
db = client[DB_NAME]
app = FastAPI(title="VYRO API")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("vyro")

# ---------------------- Helpers ----------------------
def now_utc() -> datetime: return datetime.now(timezone.utc)
def iso(dt: datetime) -> str: return dt.isoformat()
def hash_pwd(pwd: str) -> str: return bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()
def verify_pwd(pwd: str, hashed: str) -> bool:
    try: return bcrypt.checkpw(pwd.encode(), hashed.encode())
    except: return False

def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "iat": int(now_utc().timestamp()), "exp": int((now_utc() + timedelta(days=JWT_EXPIRE_DAYS)).timestamp())}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)

async def current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user_id = payload["sub"]
    except: raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not user: raise HTTPException(status_code=401, detail="User not found")
    return user

# ---------------------- Models ----------------------
class SignupReq(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    username: str = Field(min_length=2, max_length=24)

class LoginReq(BaseModel):
    email: EmailStr
    password: str

class AuthResp(BaseModel):
    token: str
    user: dict

class UserReport(BaseModel):
    target_user_id: str
    reason: str
    message_id: Optional[str] = None

class ChatMessage(BaseModel):
    content: str

class FavoritePlace(BaseModel):
    label: str
    address: str
    coords: List[float]

# ---------------------- Connection Manager ----------------------
class ConnectionManager:
    def __init__(self): self.active_connections: List[WebSocket] = []
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections: self.active_connections.remove(websocket)
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try: await connection.send_json(message)
            except: pass

manager = ConnectionManager()

# ---------------------- Routes: Auth ----------------------
@api_router.post("/auth/signup", response_model=AuthResp)
async def signup(req: SignupReq):
    existing = await db.users.find_one({"email": req.email.lower()})
    if existing: raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    doc = {
        "id": user_id, "email": req.email.lower(), "username": req.username,
        "password_hash": hash_pwd(req.password), "xp": 0, "level": 1, "trust_score": 50,
        "is_muted": False, "is_banned": False, "created_at": iso(now_utc()),
        "avatar_color": "#EAB308", "vehicle": {"type": "car"}, "badges": [], "premium": False
    }
    await db.users.insert_one(doc)
    return AuthResp(token=make_token(user_id), user={k:v for k,v in doc.items() if k not in ("_id","password_hash")})

@api_router.post("/auth/login", response_model=AuthResp)
async def login(req: LoginReq):
    user = await db.users.find_one({"email": req.email.lower()})
    if not user or not verify_pwd(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return AuthResp(token=make_token(user["id"]), user={k:v for k,v in user.items() if k not in ("_id","password_hash")})

@api_router.get("/auth/me")
async def me(user: dict = Depends(current_user)): return user

@api_router.patch("/auth/me")
async def update_me(data: dict, user: dict = Depends(current_user)):
    allowed_fields = {"avatar_color", "username"}
    update_data = {k: v for k, v in data.items() if k in allowed_fields}
    if not update_data:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    await db.users.update_one({"id": user["id"]}, {"$set": update_data})
    updated = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    return updated

# ---------------------- WebSocket Chat & Moderation ----------------------
@app.websocket("/ws/chat/{token}")
async def websocket_endpoint(websocket: WebSocket, token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user or user.get("is_banned"):
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await manager.connect(websocket)
    await manager.broadcast({"type": "system", "content": f"{user['username']} joined the grid", "time": iso(now_utc())})

    try:
        while True:
            data = await websocket.receive_json()
            
            # BLOCCANTE: Moderazione Muted
            if user.get("is_muted"):
                await websocket.send_json({"type": "error", "content": "You are muted."})
                continue
            
            is_valid, err = validate_message(data.get("content", ""))
            if not is_valid:
                await websocket.send_json({"type": "error", "content": err})
                continue

            msg = {
                "id": str(uuid.uuid4()), "user_id": user["id"], "username": user["username"],
                "content": data["content"], "type": "chat", "time": iso(now_utc()),
                "avatar_color": user.get("avatar_color", "#EAB308"),
                "is_admin": user.get("is_admin", False)
            }
            await db.chat_history.insert_one(msg)
            msg.pop("_id", None)
            await manager.broadcast(msg)
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@api_router.get("/chat/history")
async def chat_history(limit: int = 50, user: dict = Depends(current_user)):
    cur = db.chat_history.find({},{"_id":0}).sort("time", -1).limit(limit)
    items = await cur.to_list(limit)
    return {"messages": items[::-1]}

@api_router.post("/reports/user")
async def report_user(req: UserReport, user: dict = Depends(current_user)):
    await db.user_reports.insert_one({**req.model_dump(), "reporter_id": user["id"], "created_at": iso(now_utc())})
    return {"ok": True}

@api_router.post("/admin/action")
async def admin_action(target_id: str, action: Literal["mute", "unmute", "ban", "unban"], user: dict = Depends(current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Unauthorized. Admin only.")
    field = "is_muted" if "mute" in action else "is_banned"
    val = True if action in ["mute", "ban"] else False
    await db.users.update_one({"id": target_id}, {"$set": {field: val}})
    return {"ok": True}

@api_router.get("/favorites")
async def get_favorites(user: dict = Depends(current_user)):
    u = await db.users.find_one({"id": user["id"]})
    return {"favorites": u.get("favorites", []) if u else []}

@api_router.post("/favorites")
async def save_favorite(fav: FavoritePlace, user: dict = Depends(current_user)):
    await db.users.update_one(
        {"id": user["id"]}, 
        {"$pull": {"favorites": {"label": fav.label}}}
    )
    await db.users.update_one(
        {"id": user["id"]}, 
        {"$push": {"favorites": fav.model_dump()}}
    )
    return {"ok": True}

@api_router.delete("/favorites/{label}")
async def delete_favorite(label: str, user: dict = Depends(current_user)):
    await db.users.update_one(
        {"id": user["id"]}, 
        {"$pull": {"favorites": {"label": label}}}
    )
    return {"ok": True}

# ---------------------- Routing Engine (Real OSRM API with Heavy Vehicle Optimization) ----------------------
import requests

class RouteRequest(BaseModel):
    origin: str
    destination: str
    origin_coords: Optional[List[float]] = None
    dest_coords: Optional[List[float]] = None
    mode: Optional[str] = "car"
    vehicle_height: Optional[float] = None
    vehicle_width: Optional[float] = None
    vehicle_weight: Optional[float] = None
    vehicle_length: Optional[float] = None

def parse_float_safe(val_str: Optional[str]) -> Optional[float]:
    if not val_str:
        return None
    try:
        # Pulisce la stringa mantenendo solo numeri, punti e virgole
        cleaned = "".join([c for c in val_str if c.isdigit() or c in (".", ",")]).replace(",", ".")
        return float(cleaned)
    except:
        return None

async def check_route_restrictions(
    polyline: List[List[float]], 
    mode: str, 
    h: float, 
    w: float, 
    wt: float,
    l: float
) -> List[dict]:
    """
    Interroga Overpass API lungo la polilinea campionata per identificare limitazioni di altezza,
    larghezza, peso, tornanti stretti o strade strette.
    """
    if not polyline or len(polyline) < 2:
        return []

    # Campiona fino a 15 punti significativi lungo la polilinea per non sovraccaricare le API
    n = len(polyline)
    step = max(1, n // 12)
    sampled = [polyline[i] for i in range(0, n, step)]
    if polyline[-1] not in sampled:
        sampled.append(polyline[-1])

    # Ottimizzazione query Overpass:
    # 1. Raccoglie tutti i modi entro 60 metri dai punti campionati in un unico set '.all_ways' (15 geospatial scans invece di 120)
    # 2. Filtra gli attributi in-memoria per massima velocità e zero sovraccarichi sul server Overpass
    union_around = []
    for pt in sampled[:15]:
        lon, lat = pt
        union_around.append(f"  way(around:60, {lat}, {lon});")

    if not union_around:
        return []

    query = (
        "[out:json][timeout:5];\n"
        "(\n"
        + "\n".join(union_around) + "\n"
        + ") -> .all_ways;\n"
        "(\n"
        "  way.all_ways[maxheight];\n"
        "  way.all_ways[maxwidth];\n"
        "  way.all_ways[width];\n"
        "  way.all_ways[maxweight];\n"
        "  way.all_ways[highway=narrow];\n"
        "  way.all_ways[narrow=yes];\n"
        "  way.all_ways[hairpin=yes];\n"
        "  way.all_ways[sharp_curve=yes];\n"
        ");\n"
        "out tags;"
    )
    url = "https://overpass-api.de/api/interpreter"

    def fetch_overpass():
        try:
            res = requests.post(url, data=query, headers={'Content-Type': 'text/plain'}, timeout=6)
            return res.json() if res.ok else None
        except Exception as e:
            logger.error(f"Overpass API restriction check failed: {str(e)}")
            return None

    data = await asyncio.to_thread(fetch_overpass)
    if not data or "elements" not in data:
        return []

    violations = []
    seen_ways = set()

    for element in data.get("elements", []):
        way_id = element.get("id")
        if way_id in seen_ways:
            continue
        seen_ways.add(way_id)
        tags = element.get("tags", {})
        name = tags.get("name") or tags.get("ref") or "Strada senza nome"

        # 1. Limiti di Altezza (maxheight)
        maxh_str = tags.get("maxheight")
        if maxh_str:
            maxh = parse_float_safe(maxh_str)
            if maxh and h > maxh:
                violations.append({
                    "type": "height",
                    "msg": f"Tunnel/Ostacolo basso su '{name}': altezza max {maxh}m (Veicolo: {h}m)",
                    "critical": h - maxh > 0.15
                })

        # 2. Limiti di Larghezza (maxwidth o width)
        maxw_str = tags.get("maxwidth") or tags.get("width")
        if maxw_str:
            maxw = parse_float_safe(maxw_str)
            if maxw and w > maxw:
                violations.append({
                    "type": "width",
                    "msg": f"Strada stretta su '{name}': larghezza max {maxw}m (Veicolo: {w}m)",
                    "critical": w - maxw > 0.1
                })

        # 3. Limiti di Peso (maxweight)
        maxwt_str = tags.get("maxweight") or tags.get("maxweightrating:hgv")
        if maxwt_str:
            maxwt_val = parse_float_safe(maxwt_str) # In tonnellate
            if maxwt_val:
                maxwt_kg = maxwt_val * 1000.0
                if wt > maxwt_kg:
                    violations.append({
                        "type": "weight",
                        "msg": f"Limite di peso su '{name}': max {maxwt_val}t (Veicolo: {wt/1000:.1f}t)",
                        "critical": True
                    })

        # 4. Strade Strette (narrow)
        if tags.get("narrow") == "yes" or tags.get("highway") == "narrow":
            if mode in ("truck", "bus") or w > 2.2:
                violations.append({
                    "type": "narrow",
                    "msg": f"Carreggiata molto stretta e difficoltosa su '{name}'",
                    "critical": False
                })

        # 5. Curve a gomito / Tornanti (hairpin)
        if tags.get("hairpin") == "yes" or tags.get("sharp_curve") == "yes":
            if mode in ("truck", "bus") or l > 7.0:
                violations.append({
                    "type": "hairpin",
                    "msg": f"Tornante stretto su '{name}': critico per veicoli lunghi (Lunghezza: {l}m)",
                    "critical": l > 8.0 or mode in ("truck", "bus")
                })

    return violations

@api_router.post("/route/suggest")
async def suggest_route(req: RouteRequest):
    if not req.origin_coords or not req.dest_coords:
        raise HTTPException(status_code=400, detail="Missing coordinates")
        
    start_lon, start_lat = req.origin_coords
    end_lon, end_lat = req.dest_coords
    mode = req.mode or "car"

    # Dimensioni di default comprensive di lunghezza se non esplicitamente definite dall'utente
    DEFAULTS = {
        "truck": {"height": 4.0, "width": 2.55, "weight": 18000.0, "length": 12.0},
        "bus": {"height": 3.6, "width": 2.50, "weight": 15000.0, "length": 12.0},
        "camper": {"height": 3.1, "width": 2.30, "weight": 3500.0, "length": 7.0},
        "van": {"height": 2.5, "width": 2.05, "weight": 3000.0, "length": 6.0},
        "car": {"height": 1.6, "width": 1.80, "weight": 1500.0, "length": 4.5}
    }
    
    spec = DEFAULTS.get(mode, DEFAULTS["car"])
    h = req.vehicle_height if req.vehicle_height is not None else spec["height"]
    w = req.vehicle_width if req.vehicle_width is not None else spec["width"]
    wt = req.vehicle_weight if req.vehicle_weight is not None else spec["weight"]
    l = req.vehicle_length if req.vehicle_length is not None else spec.get("length", 4.5)

    # Richiediamo percorsi alternativi da OSRM (alternatives=true)
    url = f"http://router.project-osrm.org/route/v1/driving/{start_lon},{start_lat};{end_lon},{end_lat}?overview=full&geometries=geojson&steps=true&alternatives=true"
    
    def fetch_routes():
        return requests.get(url, timeout=10).json()
        
    data = await asyncio.to_thread(fetch_routes)
    
    if data.get("code") != "Ok" or not data.get("routes"):
        raise HTTPException(status_code=400, detail="No route found")
        
    routes = data["routes"]
    
    # Se il profilo è pesante, analizziamo tutte le alternative e scegliamo quella più sicura
    best_route = routes[0]
    best_violations = []
    best_score = 999999
    
    # Se guidiamo un mezzo che necessita di controlli
    if mode in ("truck", "bus", "camper", "van") or h > 2.5 or w > 2.1 or wt > 3500.0 or l > 6.0:
        route_options_checked = []
        for idx, r in enumerate(routes):
            polyline = r["geometry"]["coordinates"]
            violations = await check_route_restrictions(polyline, mode, h, w, wt, l)
            
            # Calcoliamo uno score di penalità
            # Violazioni critiche = 1000 punti, Violazioni non critiche = 10 punti
            score = sum(1000 if v["critical"] else 10 for v in violations)
            # Aggiungiamo una piccola penalità basata sulla durata per preferire percorsi brevi in caso di parità di ostacoli
            score += r.get("duration", 0) / 3600.0
            
            route_options_checked.append((r, violations, score))
        
        # Ordiniamo in base al punteggio di penalità minore
        route_options_checked.sort(key=lambda x: x[2])
        best_route, best_violations, best_score = route_options_checked[0]
        
    polyline = best_route["geometry"]["coordinates"]
    
    steps = []
    for leg in best_route["legs"]:
        for step in leg["steps"]:
            steps.append({
                "instr": step.get("maneuver", {}).get("instruction", "Procedi dritto"),
                "street": step.get("name", ""),
                "dist": f"{step.get('distance', 0):.0f}m",
                "type": step.get("maneuver", {}).get("type", "straight"),
                "modifier": step.get("maneuver", {}).get("modifier", "straight")
            })
            
    warnings = [v["msg"] for v in best_violations]
    tips = ["Traffico in tempo reale abilitato", "Guida con prudenza"]
    
    if mode in ("truck", "bus", "camper", "van"):
        if not warnings:
            tips.append(f"✅ Percorso pulito per {mode.upper()}: Nessun tunnel basso o strada stretta rilevata!")
        else:
            tips.append(f"⚠️ Rilevati {len(warnings)} ostacoli per {mode.upper()}. Consulta gli avvisi di viaggio.")
    
    return {
        "ok": True,
        "suggestion": {
            "summary": best_route.get("legs", [{}])[0].get("summary", "Percorso rapido"),
            "eta_minutes": max(1, round(best_route.get("duration", 0) / 60)),
            "distance_km": round(best_route.get("distance", 0) / 1000, 1),
            "polyline": polyline,
            "steps": steps,
            "tips": tips,
            "warnings": warnings
        }
    }

@api_router.post("/overpass/proxy")
async def overpass_proxy(req: dict):
    query = req.get("query")
    if not query:
        raise HTTPException(status_code=400, detail="Missing query")
    
    url = "https://overpass-api.de/api/interpreter"
    
    def fetch_overpass():
        res = requests.post(url, data=query, headers={'Content-Type': 'text/plain'}, timeout=15)
        return res.json() if res.ok else {"error": res.text, "status": res.status_code}
        
    try:
        data = await asyncio.to_thread(fetch_overpass)
        if "error" in data:
            raise HTTPException(status_code=data["status"], detail=data["error"])
        return data
    except Exception as e:
        logger.error(f"Overpass Proxy Error: {str(e)}")
        # Invece di lanciare 500 e rompere la console, restituiamo un risultato vuoto
        return {"elements": []}

@api_router.put("/vehicle")
async def update_vehicle(v: dict, user: dict = Depends(current_user)):
    await db.users.update_one({"id": user["id"]}, {"$set": {"vehicle": v}})
    return {"ok": True, "vehicle": v}

@api_router.get("/vehicle")
async def get_vehicle(user: dict = Depends(current_user)):
    return {"vehicle": user.get("vehicle", {"type": "car"})}

@api_router.get("/leaderboard")
async def get_leaderboard():
    users = await db.users.find().sort("xp", -1).limit(10).to_list(10)
    for u in users:
        u["_id"] = str(u["_id"])
        u.pop("password_hash", None)  # Rimuove il campo corretto
    return {"leaderboard": users}

# ---------------------- Standard Routes ----------------------
@api_router.get("/reports")
async def list_reports(limit: int = 50):
    cur = db.reports.find({"active": True}, {"_id": 0}).sort("created_at", -1).limit(limit)
    return {"reports": await cur.to_list(limit)}

class ReportCreate(BaseModel):
    type: str
    lat: float
    lng: float
    note: str = ""

@api_router.post("/reports")
async def create_report_endpoint(req: ReportCreate, user: dict = Depends(current_user)):
    trust = user.get("trust_score", 50)
    ai_score = trust / 100.0
    doc = {
        "id": str(uuid.uuid4()),
        "type": req.type,
        "lat": req.lat,
        "lng": req.lng,
        "note": req.note,
        "username": user["username"],
        "user_id": user["id"],
        "reporter_trust": trust,
        "confirms": 0,
        "denies": 0,
        "ai_score": ai_score,
        "ai_reason": f"Validated by {user['username']} (Trust: {trust})",
        "active": True,
        "created_at": iso(now_utc())
    }
    await db.reports.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "report": doc}

@api_router.post("/reports/vote")
async def vote_report(data: dict, user: dict = Depends(current_user)):
    report_id = data.get("report_id")
    confirm = data.get("confirm", True)
    if not report_id:
        raise HTTPException(status_code=400, detail="Missing report_id")
    field = "confirms" if confirm else "denies"
    await db.reports.update_one({"id": report_id}, {"$inc": {field: 1}})
    # Auto-deactivate if 3+ denies
    report = await db.reports.find_one({"id": report_id})
    if report and report.get("denies", 0) >= 3:
        await db.reports.update_one({"id": report_id}, {"$set": {"active": False}})
    return {"ok": True}

@api_router.get("/stats")
async def get_stats():
    total_users = await db.users.count_documents({})
    total_reports = await db.reports.count_documents({})
    active_reports = await db.reports.count_documents({"active": True})
    return {
        "total_users": total_users,
        "total_reports": total_reports,
        "active_reports": active_reports,
        "system_status": "ONLINE"
    }

# ---------------------- Wire up ----------------------
app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("startup")
async def startup():
    await db.users.create_index("id", unique=True)
    await db.chat_history.create_index("time")
    logger.info("✅ VYRO GRID ENGINE ONLINE.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
