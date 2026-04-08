import json
from pathlib import Path

ROOT        = Path(__file__).resolve().parent.parent.parent
meta_path   = ROOT / "ml" / "data" / "new_champions_metadata.json"
output_path = Path(__file__).parent / "linksdirectos.txt"

MARKET_BASE = "https://marketplace.roninchain.com/collections/0x9e8ed4ff354bd11602255b3d8e1ed13a1bb26b4b"

with open(meta_path, encoding="utf-8") as f:
    new_meta = json.load(f)

lines = []
for key, moki in new_meta.items():
    moki_id   = moki["id"]
    moki_name = moki["name"]
    url = f"{MARKET_BASE}?Champion%20Token%20ID_max={moki_id}&Champion%20Token%20ID_min={moki_id}"
    lines.append(f"{moki_name}: {url}")

output_path.write_text("\n".join(lines), encoding="utf-8")
print(f"[OK] {len(lines)} links generados en {output_path}")
for l in lines[:5]:
    print(f"  {l}")
print("  ...")
