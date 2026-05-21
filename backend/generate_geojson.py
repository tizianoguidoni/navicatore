import struct
import glob
import os
import csv
import json

pois = []

# 1. Caricamento ZTL_Italia.csv
ztl_file = "/Users/tiziano/Desktop/proggetti /navicatore/ZTL_Italia/ZTL_Italia.csv"
if os.path.exists(ztl_file):
    with open(ztl_file, "r", encoding="utf-8", errors="ignore") as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) >= 3:
                try:
                    lon = float(row[0])
                    lat = float(row[1])
                    desc = row[2]
                    pois.append({
                        "type": "Feature",
                        "geometry": { "type": "Point", "coordinates": [lon, lat] },
                        "properties": { "type": "ztl", "description": desc }
                    })
                except ValueError:
                    pass

# 2. Caricamento Autovelox Fissi (.ov2)
def parse_ov2(filename):
    pts = []
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
                desc = str_bytes.decode('windows-1252', 'replace').strip('\x00')
                pts.append((lon, lat, desc))
            elif type_byte == 0:
                length = struct.unpack('<I', f.read(4))[0]
                f.read(length - 5) # skip deleted record
            elif type_byte == 1:
                # Type 1: block with coords (1 byte type + 4 len + 16 coords)
                f.read(20)
            elif type_byte == 3:
                # Type 3: block with coords (1 byte type + 16 coords + 4 len)
                f.read(20)
            else:
                # unknown type? skip file or just continue?
                pass
    return pts

ov2_files = []
for root, dirs, files in os.walk("/Users/tiziano/Desktop/proggetti /navicatore/Autovelox_tomtom"):
    for file in files:
        if file.endswith(".ov2"):
            ov2_files.append(os.path.join(root, file))

for ov2_file in ov2_files:
    if "fissi" in ov2_file.lower():
        pts = parse_ov2(ov2_file)
        print(f"Parsed {len(pts)} points from {ov2_file}")
        for lon, lat, desc in pts:
            pois.append({
                "type": "Feature",
                "geometry": { "type": "Point", "coordinates": [lon, lat] },
                "properties": { "type": "speed_camera", "description": desc }
            })

geojson = {
    "type": "FeatureCollection",
    "features": pois
}

output_path = "/Users/tiziano/Desktop/proggetti /navicatore/navicatore-main/frontend/assets/pois.json"
os.makedirs(os.path.dirname(output_path), exist_ok=True)
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(geojson, f)

print(f"✅ Generato GeoJSON con {len(pois)} elementi (ZTL e Velox Fissi). Salvato in {output_path}")
