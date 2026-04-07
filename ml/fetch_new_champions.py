"""
Script auxiliar: Obtiene los 60 nuevos Champions y genera entradas listas 
para agregar a mokiMetadata.json.

Usa el endpoint bulk de la API para traer:
  - imageUrl (portraitUrl)
  - Fur (Rainbow, Gold, Shadow, Spirit → valor directo; otro → "Common"; sin valor → "1 of 1")
  - traits (filtrados por los valores reconocidos por el Lineup Generator)

Traits reconocidos por esquemas (coincidencia parcial, case-insensitive):
  Shapeshifting:       Tongue Out, Tanuki, Kitsune, Cat Mask
  Tear Jerking:        Crying Eye
  Costume Party:       Onesie, Lemon, Kappa, Tomato, Blob Head
  Dress To Impress:    Kimono
  Call To Arms:        Ronin, Samurai, Ronin Aurora, Ronin Moon
  Malicious Intent:    Devious Mouth, Oni, Tengu, Skull Mask, Horns, TMA Noble Skull
  Housekeeping:        Apron, Garbage Can, Gold Can, Toilet Paper
  Dungaree Duel:       Pink Overalls, Blue Overalls, Green Overalls

Uso:
    cd ml && .\\venv\\Scripts\\python.exe fetch_new_champions.py

Salida:
    data/new_champions_metadata.json  — Listo para merge en src/data/mokiMetadata.json
"""

import requests
import json
import os
from pathlib import Path
from dotenv import load_dotenv

ENV_PATH = Path(__file__).parent.parent / ".env.local"
if ENV_PATH.exists(): load_dotenv(ENV_PATH)
else: load_dotenv()

API_KEY      = os.getenv("GA_API_KEY")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

LEADERBOARD_ID = "6997a23dfe65385c3bd784e5"
DATA_DIR = Path(__file__).parent / "data"

HEADERS = {
    "Accept": "application/json",
    "Authorization": f"Bearer {API_KEY}",
}

# ─── Fur mapping ─────────────────────────────────────────────────────────────
SPECIAL_FURS = {"Rainbow", "Gold", "Shadow", "Spirit"}

# ─── Trait matching ──────────────────────────────────────────────────────────
# (keyword_a_buscar_en_lower, traitType_requerido_o_None)
#   Si traitType_requerido != None → solo se extrae cuando el traitType coincida.
# Se guarda el valor EXACTO de la API en mokiMetadata para que
# hasTrait() en el TS funcione vía regex `\bkeyword\b`.

TRAIT_KEYWORDS: list[tuple[str, str | None]] = [
    # Shapeshifting — valores exactos de la API
    ("tongue out",      None),
    ("tanuki mask",     None),
    ("kitsune mask",    None),
    ("cat mask",        None),
    # Tear Jerking
    ("crying eye",      None),
    # Costume Party
    ("onesie",          None),    # Parcial: "Banana Onesie", "Kappa Onesie", etc.
    ("lemon head",      None),
    ("kappa head",      None),
    ("tomato head",     None),
    ("blob head",       None),
    # Dress To Impress
    ("kimono",          None),    # Parcial: "Gold Kimono", "Straw Kimono", etc.
    # Call To Arms
    ("ronin",           None),    # Parcial: "Ronin", "Ronin Aurora", "Ronin Moon", "Ronin Head"
    ("samurai",         None),
    # Malicious Intent — valores exactos de la API
    ("devious mouth",   None),
    ("oni mask",        None),
    ("tengu mask",      None),
    ("skull mask",      None),
    ("horns",           None),
    ("tma noble skull", None),
    # Housekeeping
    ("apron",           None),    # Parcial: "Maid Apron", "Blue Artist Apron"
    ("garbage can",     None),
    ("gold can",        None),
    ("toilet paper",    "clothing"),  # SOLO cuando traitType == "Clothing"
    # Dungaree Duel
    ("pink overalls",   None),
    ("blue overalls",   None),
    ("green overalls",  None),
]


def map_fur(api_fur_value: str | None) -> str:
    """
    Mapea el valor de Fur de la API:
      - Rainbow / Gold / Shadow / Spirit → valor directo
      - Cualquier otro valor (ej: Brown)  → 'Common'
      - Sin valor (None / '')             → 'Common' (fallback. "1 of 1" solo aplica a custom Mokis)
    """
    if not api_fur_value:
        return "Common"
    if api_fur_value in SPECIAL_FURS:
        return api_fur_value
    return "Common"


def extract_traits(api_attributes: list) -> list[str]:
    """
    Extrae los traits reconocidos de los atributos de la API.
    Guarda el valor EXACTO de la API (no el keyword parcial) para compatibilidad
    con hasTrait() en TS (que usa regex `\\bkeyword\\b` sobre el string de traits).
    """
    found = []
    for attr in api_attributes:
        trait_type  = str(attr.get("traitType", "")).strip().lower()
        trait_value = str(attr.get("value", "")).strip()
        value_lower = trait_value.lower()

        if not trait_value or value_lower in ("none", "n/a", ""):
            continue

        for keyword, required_type in TRAIT_KEYWORDS:
            # Verificar restricción de traitType si aplica
            if required_type and trait_type != required_type:
                continue
            # Coincidencia: el keyword está contenido dentro del value
            if keyword in value_lower:
                if trait_value not in found:
                    found.append(trait_value)  # Valor exacto de la API
                break  # Un atributo solo mapea un keyword

    return found




def fetch_page(page: int) -> list:
    url = f"https://api.grandarena.gg/api/v1/leaderboards/{LEADERBOARD_ID}/scores?page={page}&limit=100&sort=score&order=desc"
    print(f"[INFO] Fetching leaderboard page {page}...")
    r = requests.get(url, headers=HEADERS)
    if r.status_code != 200:
        print(f"[ERROR] Page {page} returned {r.status_code}")
        return []
    data = r.json()
    entries = data.get("data", data) if isinstance(data, dict) else data
    return entries if isinstance(entries, list) else []


def fetch_moki_bulk(token_ids: list[int]) -> dict[int, dict]:
    """Llama al endpoint bulk de la API y retorna dict {tokenId: moki_data}."""
    batch_size = 90
    result = {}
    for i in range(0, len(token_ids), batch_size):
        batch = token_ids[i:i+batch_size]
        ids_str = ",".join(str(x) for x in batch)
        url = f"https://api.grandarena.gg/api/v1/mokis/bulk?ids={ids_str}"
        print(f"[INFO] Fetching bulk data for {len(batch)} mokis ({i+1}–{i+len(batch)})...")
        r = requests.get(url, headers=HEADERS)
        if r.status_code != 200:
            print(f"[WARN] Bulk API error: {r.status_code}")
            continue
        data = r.json()
        mokis = data.get("data", []) if isinstance(data, dict) else data
        for m in mokis:
            # La API puede devolver el ID numérico en distintos campos.
            # "id" / "tokenId" suelen ser el ObjectId de MongoDB (hex) — no sirven.
            # Buscamos el campo que tenga el token ID numérico.
            tid = (
                m.get("mokiTokenId") or    # leaderboard field
                m.get("token_id") or       # snake_case variant
                m.get("nftId")             # otro campo posible
            )
            # Si todavía no encontramos uno válido, intentar "tokenId" solo si es numérico
            if not tid:
                raw = m.get("tokenId") or m.get("id") or ""
                try:
                    tid = int(raw)
                except (ValueError, TypeError):
                    tid = None

            if tid:
                try:
                    result[int(tid)] = m
                except (ValueError, TypeError):
                    pass  # Descartar IDs no numéricos (ObjectIds de MongoDB)

    return result


def get_existing_moki_ids() -> set:
    meta_path = Path(__file__).parent.parent / "src" / "data" / "mokiMetadata.json"
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    return {str(v.get("id", "")) for v in meta.values() if v.get("id")}


def main():
    if not API_KEY:
        print("[ERROR] GA_API_KEY no configurada en .env.local")
        return

    # 1. Obtener IDs de páginas 2 y 3
    all_entries = []
    for page in [2, 3]:
        all_entries.extend(fetch_page(page))

    existing_ids = get_existing_moki_ids()
    new_entries  = [e for e in all_entries if str(e.get("mokiTokenId", "")) not in existing_ids]
    print(f"\n[INFO] Nuevos Champions: {len(new_entries)}")

    new_token_ids = [e["mokiTokenId"] for e in new_entries if e.get("mokiTokenId")]

    # 2. Fetch bulk para obtener imageUrl, fur, traits
    bulk_data = fetch_moki_bulk(new_token_ids)

    # Diagnóstico: ¿cuántos mokis encontramos en el bulk?
    found_in_bulk = sum(1 for tid in new_token_ids if int(tid) in bulk_data)
    print(f"[INFO] Bulk data obtenida para {found_in_bulk}/{len(new_token_ids)} mokis.")
    if found_in_bulk == 0:
        print("[WARN] Bulk API no devolvió datos con tokenId numérico.")
        print("[WARN] Revisa qué campo usa la API con: print(list(bulk_data.values())[0].keys()) si bulk_data no está vacío.")

    # Diagnóstico: estructura real de attrs del primer moki
    if new_entries and bulk_data:
        first_tid = int(new_entries[0]["mokiTokenId"])
        sample = bulk_data.get(first_tid, {})
        sample_attrs = sample.get("attributes", sample.get("nftAttributes", sample.get("traits", [])))
        print(f"\n[DEBUG] Estructura de attrs del primer moki (#{first_tid}):")
        for a in sample_attrs[:5]:
            print(f"  {a}")

    # 3. Construir metadata
    metadata_entries = {}

    for e in new_entries:
        token_id = e.get("mokiTokenId")
        name     = e.get("name", f"Moki #{token_id}")

        bulk      = bulk_data.get(int(token_id), {})
        image_url = bulk.get("imageUrl", e.get("imageUrl", ""))

        # Buscar atributos en posibles nombres de campo
        attrs = (
            bulk.get("attributes") or
            bulk.get("nftAttributes") or
            bulk.get("traits") or
            []
        )

        # Buscar Fur probando camelCase y snake_case para el campo del tipo
        def get_attr_type(a):
            return str(a.get("traitType") or a.get("trait_type") or a.get("type") or "").strip().lower()

        fur_attr  = next((a for a in attrs if get_attr_type(a) == "fur"), None)
        fur_value = fur_attr.get("value") if fur_attr else None
        fur       = map_fur(fur_value)

        # Traits reconocidos
        traits = extract_traits(attrs)

        key = name.upper().replace(" ", "_")
        metadata_entries[key] = {
            "id": str(token_id),
            "name": name,
            "portraitUrl": image_url,
            "fur": fur,
            "traits": traits,
            "marketLink": f"https://marketplace.roninchain.com/collections/moki-genesis/{token_id}"
        }

        traits_str = ", ".join(traits) if traits else "(ninguno)"
        print(f"  ✅ #{token_id} | {name} | fur={fur} | traits=[{traits_str}]")

    # 4. Guardar
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    out_path = DATA_DIR / "new_champions_metadata.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(metadata_entries, f, indent=2, ensure_ascii=False)

    print(f"\n[OK] {len(metadata_entries)} nuevos Champions guardados en: {out_path}")
    print("\n[NEXT STEP] Agregar el contenido de ese archivo al final de src/data/mokiMetadata.json")
    print("            (antes del último '}' cierre del JSON raíz)")


if __name__ == "__main__":
    main()
