"""
Genera las 60×4 = 240 entradas para catalog.json con las nuevas champions.
Lee de ml/data/new_champions_metadata.json y las inserta al final de catalog.json.
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent

new_meta_path = ROOT / "ml" / "data" / "new_champions_metadata.json"
catalog_path  = ROOT / "src" / "data" / "catalog.json"

RARITIES = ["Basic", "Rare", "Epic", "Legendary"]
MARKET_BASE = "https://marketplace.roninchain.com/collections/0x9e8ed4ff354bd11602255b3d8e1ed13a1bb26b4b"

with open(new_meta_path, "r", encoding="utf-8") as f:
    new_meta = json.load(f)

with open(catalog_path, "r", encoding="utf-8") as f:
    catalog = json.load(f)

# Verificar IDs ya en el catálogo para evitar duplicados
existing_ids = {str(entry["id"]) for entry in catalog}
print(f"[INFO] Entradas actuales en catálogo: {len(catalog)}")

new_entries = []
skipped = 0

for key, moki in new_meta.items():
    moki_id   = str(moki["id"])
    moki_name = moki["name"]

    if moki_id in existing_ids:
        print(f"[SKIP] #{moki_id} {moki_name} — ya existe en el catálogo")
        skipped += 1
        continue

    for rarity in RARITIES:
        market_url = (
            f"{MARKET_BASE}"
            f"?Champion%20Token%20ID_max={moki_id}"
            f"&Champion%20Token%20ID_min={moki_id}"
            f"&Rarity={rarity}"
        )
        new_entries.append({
            "id":     moki_id,
            "name":   moki_name,
            "rarity": rarity,
            "image":  "",        # Se llenará luego con el script de imágenes
            "market": market_url
        })

print(f"[INFO] Nuevas entradas a agregar: {len(new_entries)} ({len(new_entries)//4} champions × 4 rarezas)")
print(f"[INFO] Skipped: {skipped}")

catalog.extend(new_entries)

with open(catalog_path, "w", encoding="utf-8") as f:
    json.dump(catalog, f, indent=2, ensure_ascii=False)

print(f"\n[OK] catalog.json actualizado: {len(catalog)} entradas totales.")
print(f"     Los 60 nuevos Champions están al final del archivo (fácil de identificar).")
