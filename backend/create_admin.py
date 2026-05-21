import asyncio
import uuid
from datetime import datetime, timezone
import bcrypt
from motor.motor_asyncio import AsyncIOMotorClient

def hash_pwd(pwd: str) -> str:
    return bcrypt.hashpw(pwd.encode(), bcrypt.gensalt()).decode()

def iso(dt: datetime) -> str:
    return dt.isoformat()

def now_utc() -> datetime:
    return datetime.now(timezone.utc)

async def create_or_update_admin():
    client = AsyncIOMotorClient("mongodb://localhost:27017", serverSelectionTimeoutMS=5000)
    db = client["vyro"]
    
    email = "admin@vyro.com"
    password = "Golia2013@"
    
    existing = await db.users.find_one({"email": email})
    
    if existing:
        await db.users.update_one(
            {"email": email}, 
            {"$set": {"is_admin": True, "password_hash": hash_pwd(password)}}
        )
        print(f"Utente {email} aggiornato! is_admin=True, password aggiornata.")
    else:
        user_id = str(uuid.uuid4())
        doc = {
            "id": user_id, 
            "email": email, 
            "username": "Admin",
            "password_hash": hash_pwd(password), 
            "xp": 9999, 
            "level": 99, 
            "trust_score": 100,
            "is_muted": False, 
            "is_banned": False, 
            "created_at": iso(now_utc()),
            "avatar_color": "#FF4444", 
            "vehicle": {"type": "car"}, 
            "badges": ["Admin"], 
            "premium": True,
            "is_admin": True
        }
        await db.users.insert_one(doc)
        print(f"Admin creato! Email: {email} | Password: {password}")

if __name__ == "__main__":
    asyncio.run(create_or_update_admin())
