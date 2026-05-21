import struct

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
                str_bytes = f.read(length - 13)
                desc = str_bytes.decode('windows-1252', 'replace').strip('\x00')
                pts.append((lon, lat, desc))
            elif type_byte in [0, 1, 3]:
                try:
                    length = struct.unpack('<I', f.read(4))[0]
                    f.read(length - 5)
                except:
                    break
            else:
                break
    return pts

print(parse_ov2("/Users/tiziano/Desktop/proggetti /navicatore/Autovelox_tomtom/Autovelox fissi Unico/Autovelox_Fissi.ov2")[:5])
