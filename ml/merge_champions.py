"""
Script de merge: une new_champions_metadata.json con mokiMetadata.json.
Los 60 nuevos mokis ya tienen el nombre correcto de la API.
"""
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent

source = ROOT / "ml" / "data" / "new_champions_metadata.json"
target = ROOT / "src" / "data" / "mokiMetadata.json"

with open(source, "r", encoding="utf-8") as f:
    new_champs = json.load(f)

with open(target, "r", encoding="utf-8") as f:
    existing = json.load(f)

# Verificar cuáles ya existen por ID para evitar duplicados
existing_ids = {str(v.get("id", "")) for v in existing.values()}
added = 0
skipped = 0

for key, entry in new_champs.items():
    if str(entry.get("id", "")) in existing_ids:
        print(f"[SKIP] #{entry['id']} {entry['name']} — ya existe")
        skipped += 1
    else:
        existing[key] = entry
        print(f"[ADD]  #{entry['id']} {entry['name']} | fur={entry['fur']} | traits={entry['traits']}")
        added += 1

with open(target, "w", encoding="utf-8") as f:
    json.dump(existing, f, indent=2, ensure_ascii=False)

print(f"\n[OK] mokiMetadata.json actualizado: +{added} nuevos, {skipped} ya existían. Total: {len(existing)} mokis.")
