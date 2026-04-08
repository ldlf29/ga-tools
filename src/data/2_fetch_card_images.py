import json
import time
import requests
from pathlib import Path
from datetime import datetime

FILES_TXT   = Path(__file__).parent / "files.txt"
CATALOG     = Path(__file__).parent / "catalog.json"
OUTPUT_JSON = Path(__file__).parent / "fetched_cards.json"
REPORT_MD   = Path(__file__).parent / "missing_cards_report.md"
API_BASE    = "https://fantasy.grandarena.gg/api/nft/cards"

NEW_CHAMP_IDS_PATH = Path(__file__).resolve().parent.parent.parent / "ml" / "data" / "new_champions_metadata.json"

def fetch_card(card_id):
    url = f"{API_BASE}/{card_id}"
    try:
        r = requests.get(url, timeout=10)
        if r.status_code == 200:
            return r.json()
        print(f"  [WARN] {url} -> {r.status_code}")
    except Exception as e:
        print(f"  [ERROR] {url}: {e}")
    return None

def parse_card(data):
    attrs      = data.get("attributes", [])
    rarity     = next((a["value"] for a in attrs if a.get("trait_type") == "Rarity"), None)
    champ_id   = next((a["value"] for a in attrs if a.get("trait_type") == "Champion Token ID"), None)
    return {
        "name":        data.get("name", ""),
        "image":       data.get("image", ""),
        "rarity":      rarity,
        "champion_id": str(champ_id) if champ_id is not None else None,
    }

def main():
    if not FILES_TXT.exists():
        print(f"[ERROR] No existe {FILES_TXT}")
        return

    links = list(dict.fromkeys(             # deduplica manteniendo orden
        l.strip()
        for l in FILES_TXT.read_text(encoding="utf-8").splitlines()
        if l.strip().startswith("http")
    ))
    print(f"[INFO] {len(links)} links unicos en files.txt")

    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))

    fetched        = []
    name_mismatches = []
    api_errors     = []

    for link in links:
        card_id = link.rstrip("/").split("/")[-1]
        print(f"  Fetching {card_id}...", end=" ")
        data = fetch_card(card_id)
        if not data:
            api_errors.append(link)
            print("ERROR")
            continue

        parsed = parse_card(data)
        parsed["source_link"] = link
        parsed["card_id"]     = card_id
        fetched.append(parsed)
        print(f"{parsed['name']} | {parsed['rarity']} | ChampID={parsed['champion_id']}")
        time.sleep(0.2)

    OUTPUT_JSON.write_text(json.dumps(fetched, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"\n[OK] {len(fetched)} cards guardadas en fetched_cards.json")

    # ─── Upsert en catalog.json ──────────────────────────────────────────────
    updated = 0
    not_found_in_catalog = []

    for card in fetched:
        if not card["champion_id"] or not card["rarity"] or not card["image"]:
            continue
        matched = False
        for entry in catalog:
            if str(entry["id"]) == card["champion_id"] and entry["rarity"].lower() == card["rarity"].lower():
                # Detectar incongruencia de nombre
                if entry["name"].strip().lower() != card["name"].strip().lower():
                    name_mismatches.append({
                        "champion_id": card["champion_id"],
                        "rarity":      card["rarity"],
                        "catalog_name": entry["name"],
                        "api_name":     card["name"],
                        "market":       entry.get("market", ""),
                    })
                entry["image"] = card["image"]
                updated += 1
                matched = True
        if not matched:
            not_found_in_catalog.append(card)

    CATALOG.write_text(json.dumps(catalog, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[OK] catalog.json actualizado: {updated} imagenes insertadas.")

    # ─── Detectar imagenes faltantes en los nuevos 60 champs ─────────────────
    new_ids = set()
    if NEW_CHAMP_IDS_PATH.exists():
        new_meta = json.loads(NEW_CHAMP_IDS_PATH.read_text(encoding="utf-8"))
        new_ids  = {str(v["id"]) for v in new_meta.values()}

    missing = [
        e for e in catalog
        if str(e["id"]) in new_ids and not e.get("image")
    ]

    # ─── Generar reporte .md ─────────────────────────────────────────────────
    lines = [
        f"# Reporte de Cartas Faltantes",
        f"_Generado: {datetime.now().strftime('%Y-%m-%d %H:%M')}_",
        f"",
        f"## Resumen",
        f"- Links procesados: **{len(links)}**",
        f"- Imagenes insertadas: **{updated}**",
        f"- Cartas nuevas sin imagen: **{len(missing)}**",
        f"- Incongruencias de nombre: **{len(name_mismatches)}**",
        f"- Errores de API: **{len(api_errors)}**",
        f"",
    ]

    if missing:
        lines += [
            f"## Cartas sin imagen ({len(missing)})",
            f"",
            f"| Champion ID | Nombre | Rareza | Market Link |",
            f"|-------------|--------|--------|-------------|",
        ]
        for e in sorted(missing, key=lambda x: (x["id"], x["rarity"])):
            market = e.get("market", "")
            lines.append(f"| {e['id']} | {e['name']} | {e['rarity']} | [Ver marketplace]({market}) |")
        lines.append("")
    else:
        lines += ["## Cartas sin imagen", "", "_Ninguna — todas tienen imagen!_", ""]

    if name_mismatches:
        lines += [
            f"## Incongruencias de Nombre ({len(name_mismatches)})",
            f"",
            f"| Champion ID | Rareza | Nombre en catalog.json | Nombre en API | Market |",
            f"|-------------|--------|------------------------|---------------|--------|",
        ]
        for m in name_mismatches:
            lines.append(
                f"| {m['champion_id']} | {m['rarity']} | {m['catalog_name']} | {m['api_name']} | [Ver]({m['market']}) |"
            )
        lines.append("")
    else:
        lines += ["## Incongruencias de Nombre", "", "_Ninguna detectada._", ""]

    if not_found_in_catalog:
        lines += [
            f"## Cards de la API no encontradas en catalog.json ({len(not_found_in_catalog)})",
            f"",
        ]
        for c in not_found_in_catalog:
            lines.append(f"- ChampID={c['champion_id']} | {c['name']} | {c['rarity']} | [Link]({c['source_link']})")
        lines.append("")

    if api_errors:
        lines += [f"## Errores de API ({len(api_errors)})", ""]
        for l in api_errors:
            lines.append(f"- {l}")

    REPORT_MD.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] Reporte generado: {REPORT_MD}")
    print(f"\n    Faltantes: {len(missing)} | Incongruencias: {len(name_mismatches)}")

if __name__ == "__main__":
    main()
