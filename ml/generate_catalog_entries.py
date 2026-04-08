import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
new_meta_path = ROOT / "ml" / "data" / "new_champions_metadata.json"
catalog_path  = ROOT / "src" / "data" / "catalog.json"

RARITIES = ["Basic", "Rare", "Epic", "Legendary"]
MARKET_BASE = "https://marketplace.roninchain.com/collections/0x9e8ed4ff354bd11602255b3d8e1ed13a1bb26b4b"

print(f"[INFO] ROOT: {ROOT}")
print(f"[INFO] new_meta: {new_meta_path}")
print(f"[INFO] catalog: {catalog_path}")

with open(new_meta_path, "r", encoding="utf-8") as f:
    new_meta = json.load(f)

with open(catalog_path, "r", encoding="utf-8") as f:
    catalog = json.load(f)

existing_ids = {str(e["id"]) for e in catalog}
print(f"[INFO] Entradas actuales: {len(catalog)}")

new_entries = []
skipped = 0

for key, moki in new_meta.items():
    moki_id   = str(moki["id"])
    moki_name = moki["name"]
    if moki_id in existing_ids:
        skipped += 1
        continue
    for rarity in RARITIES:
        url = (
            f"{MARKET_BASE}"
            f"?Champion%20Token%20ID_max={moki_id}"
            f"&Champion%20Token%20ID_min={moki_id}"
            f"&Rarity={rarity}"
        )
        new_entries.append({
            "id":     moki_id,
            "name":   moki_name,
            "rarity": rarity,
            "image":  "",
            "market": url
        })

print(f"[INFO] Nuevas entradas: {len(new_entries)} | Skipped: {skipped}")
catalog.extend(new_entries)

with open(catalog_path, "w", encoding="utf-8") as f:
    json.dump(catalog, f, indent=2, ensure_ascii=False)

print(f"[OK] catalog.json actualizado: {len(catalog)} entradas totales.")
