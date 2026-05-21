import csv
import struct
import os
import glob
from pymongo import MongoClient

# Connetti al DB MongoDB locale (lo stesso usato da server.py)
client = MongoClient("mongodb://localhost:27017")
db = client["vyro"]
collection = db["pois"]

# Pulizia vecchi POI
collection.delete_many({})
print("Vecchi POI cancellati.")

# 1. Caricamento ZTL_Italia.csv
ztl_file = "../../ZTL_Italia/ZTL_Italia.csv"
if os.path.exists(ztl_file):
    with open(ztl_file, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        ztl_docs = []
        for row in reader:
            if len(row) >= 3:
                try:
                    lon = float(row[0])
                    lat = float(row[1])
                    desc = row[2]
                    ztl_docs.append({
                        "type": "ztl",
                        "location": { "type": "Point", "coordinates": [lon, lat] },
                        "description": desc
                    })
                except ValueError:
                    pass
        if ztl_docs:
            collection.insert_many(ztl_docs)
            print(f"✅ Importate {len(ztl_docs)} ZTL in Italia.")
else:
    print("ZTL_Italia.csv non trovato!")

# 2. Caricamento Autovelox Fissi (.ov2)
def parse_ov2(filename):
    pois = []
    with open(filename, 'rb') as f:
        while True:
            t = f.read(1)
            if not t:
                break
            type_byte = t[0]
            if type_byte == 2:
                length = struct.unpack('<I', f.read(4))[0]
                lon = struct.unpack('<i', f.read(4))[0] / 100000.0
                lat = struct.unpack('<i', f.read(4))[0] / 100000.0
                str_len = length - 13
                str_bytes = f.read(str_len)
                try:
                    f.read(1) # read null byte
                except:
                    pass
                desc = str_bytes.decode('windows-1252', 'replace')
                pois.append((lon, lat, desc))
            elif type_byte == 0 or type_byte == 1 or type_byte == 3:
                try:
                    length = struct.unpack('<I', f.read(4))[0]
                    f.read(length - 5)
                except:
                    break
            else:
                break
    return pois

ov2_files = glob.glob("../../Autovelox_tomtom/**/*.ov2", recursive=True)
total_velox = 0
for ov2_file in ov2_files:
    # Per ora prendiamo solo i fissi per evitare spam di semafori o falsi mobili
    if "fissi" in ov2_file.lower():
        pts = parse_ov2(ov2_file)
        if pts:
            velox_docs = []
            for lon, lat, desc in pts:
                velox_docs.append({
                    "type": "speed_camera",
                    "location": { "type": "Point", "coordinates": [lon, lat] },
                    "description": desc
                })
            collection.insert_many(velox_docs)
            total_velox += len(pts)

print(f"✅ Importati {total_velox} Autovelox Fissi dal database TomTom.")

# Creazione indice geospaziale per query rapide
collection.create_index([("location", "2dsphere")])
print("Indice geospaziale creato. DB pronto!")
